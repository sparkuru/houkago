import { type FetchLike, fetchDanmakuCues } from "houkago-eisha"
import {
  type MediaEpisodeMatchCandidate,
  type MediaReleaseMatchInput,
  extractFilenameEvidence,
  rankMediaReleaseCandidates,
} from "houkago-kokuban"
import {
  BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
  type BaiduMediaFingerprint,
  type DanmakuEpisodeMatchCandidate,
  type DanmakuEvidence,
  type DanmakuRevision,
  type DanmakuTrack,
  type Enmoku,
  type MediaRelease,
} from "houkago-kousoku"
import { type BaiduSourceRecord, getBaiduSource } from "../db/queries/baidu"
import {
  findDanmakuTrack,
  findDanmakuTrackByReleaseAndEpisode,
  findGlobalReleaseEpisodeMatch,
  findMediaRelease,
  findMediaReleaseByProvider,
  listDanmakuRevisions,
  listMediaReleaseEvidence,
  listReleaseEpisodeMatches,
} from "../db/queries/danmaku"
import { DanmakuMatchInvalid, Forbidden } from "../lib/errors"
import { newId } from "../lib/id"
import { isPresent } from "../ws/housou"
import { fetchBangumi, fetchBushitsu } from "./bushitsu"
import {
  ingestDanmakuRevision,
  recordDanmakuRefreshFailure,
  recordMediaReleaseEvidence,
  registerDanmakuTrack,
  registerMediaRelease,
  resolveDanmakuCandidates,
  searchDanmakuEpisodes,
} from "./danmaku"

// A candidate read is a use-triggered refresh boundary. Keeping this window
// finite lets an active track update without turning every room render into an
// upstream request.
export const BILIBILI_DANMAKU_FRESHNESS_MS = 15 * 60 * 1000
export const BILIBILI_DANMAKU_REFRESH_INTERVAL_MS = BILIBILI_DANMAKU_FRESHNESS_MS

export type BilibiliDanmakuRefreshOptions = {
  now?: number
  freshnessMs?: number
  fetcher?: FetchLike
  duration?: number
  fingerprint?: BaiduMediaFingerprint
}

export type BilibiliDanmakuTrackRefresh = {
  attempted: boolean
  changed: boolean
  failed: boolean
  revision: DanmakuRevision | null
}

export type BilibiliDanmakuSourceResult = {
  release: MediaRelease | null
  tracks: DanmakuTrack[]
  refreshedTrackIds: string[]
  failedTrackIds: string[]
}

export type BaiduDanmakuSourceResult = {
  release: MediaRelease | null
  matchCandidates: DanmakuEpisodeMatchCandidate[]
}

const refreshesInFlight = new Map<string, Promise<BilibiliDanmakuTrackRefresh>>()

/**
 * Resolve a queued Bilibili reference into the pool when an explicit identity
 * match is already visible to the acting viewer. Unmatched legacy items keep
 * their old eisha candidate and do not create a provider-neutral episode.
 */
export async function ensureBilibiliDanmakuSource(
  actorSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  options: BilibiliDanmakuRefreshOptions = {},
): Promise<BilibiliDanmakuSourceResult> {
  const normalizedOptions = normalizeOptions(options)
  const room = fetchBushitsu(bushitsuId)
  if (!isPresent(bushitsuId, actorSeitoId)) {
    throw new Forbidden("room admission is required")
  }
  const enmoku = fetchBangumi(bushitsuId).find((item) => item.id === enmokuId)
  if (!enmoku) throw new DanmakuMatchInvalid("Enmoku does not belong to the room")

  const source = bilibiliSource(enmoku)
  if (!source) {
    return { release: null, tracks: [], refreshedTrackIds: [], failedTrackIds: [] }
  }

  const release = ensureBilibiliMediaRelease(source, normalizedOptions.now)
  const tracks = ensureMatchedOfficialTracks(
    actorSeitoId,
    room.id,
    enmoku.id,
    release,
    source.reference,
    normalizedOptions.now,
  )
  const refreshResults = await Promise.all(
    tracks.map((track) =>
      refreshBilibiliDanmakuTrack(track.id, source.reference, normalizedOptions),
    ),
  )

  return {
    release,
    tracks: tracks.map((track) => findDanmakuTrack(track.id) ?? track),
    refreshedTrackIds: tracks.flatMap((track, index) =>
      refreshResults[index]?.attempted ? [track.id] : [],
    ),
    failedTrackIds: tracks.flatMap((track, index) =>
      refreshResults[index]?.failed ? [track.id] : [],
    ),
  }
}

/**
 * Candidate REST reads use this wrapper so provider fetching stays server-side
 * and the response can immediately contain the persisted active revision.
 */
export async function resolveDanmakuCandidatesWithRefresh(
  actorSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  releaseId?: string,
  options: BilibiliDanmakuRefreshOptions = {},
) {
  await ensureBilibiliDanmakuSource(actorSeitoId, bushitsuId, enmokuId, options)
  const baidu = ensureBaiduDanmakuSource(actorSeitoId, bushitsuId, enmokuId, options)
  const resolution = resolveDanmakuCandidates(actorSeitoId, bushitsuId, enmokuId, releaseId)
  return baidu.matchCandidates.length === 0
    ? resolution
    : { ...resolution, matchCandidates: baidu.matchCandidates }
}

export const refreshBilibiliDanmaku = ensureBilibiliDanmakuSource

/**
 * Derive safe Baidu release evidence and rank existing canonical episodes. The
 * source record is room-bound, while the resulting match candidates remain
 * suggestions until an authenticated user confirms one through the common
 * match route.
 */
export function ensureBaiduDanmakuSource(
  actorSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  options: BilibiliDanmakuRefreshOptions = {},
): BaiduDanmakuSourceResult {
  const room = fetchBushitsu(bushitsuId)
  if (!isPresent(bushitsuId, actorSeitoId)) {
    throw new Forbidden("room admission is required")
  }
  const enmoku = fetchBangumi(bushitsuId).find((item) => item.id === enmokuId)
  if (!enmoku) throw new DanmakuMatchInvalid("Enmoku does not belong to the room")
  const provider = enmoku.provider
  if (provider?.kind !== "baidu") return { release: null, matchCandidates: [] }

  const source = getBaiduSource(provider.sourceId)
  if (
    !source ||
    source.bushitsuId !== room.id ||
    source.enmokuId !== enmoku.id ||
    !safeBaiduSource(source)
  ) {
    return { release: null, matchCandidates: [] }
  }

  const normalizedOptions = normalizeOptions(options)
  const { release, evidence } = ensureBaiduMediaRelease(
    source,
    normalizedOptions.duration,
    normalizedOptions.now,
    normalizedOptions.fingerprint,
  )
  if (findGlobalReleaseEpisodeMatch(release.id)) {
    return { release, matchCandidates: [] }
  }

  const parsed = extractFilenameEvidence(source.fileName)
  const observed: MediaReleaseMatchInput = {
    fileName: source.fileName,
    ...(source.size === undefined ? {} : { size: source.size }),
    ...(normalizedOptions.duration === undefined ? {} : { duration: normalizedOptions.duration }),
  }
  const candidates = searchDanmakuEpisodes(parsed.work ?? "")
  const ranked = rankMediaReleaseCandidates(
    observed,
    candidates.map(
      (candidate): MediaEpisodeMatchCandidate => ({
        id: candidate.id,
        title: candidate.title,
        ...(candidate.season === undefined ? {} : { season: candidate.season }),
        ...(candidate.episode === undefined ? {} : { episode: candidate.episode }),
      }),
    ),
  )
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  return {
    release,
    matchCandidates: ranked.flatMap((match) => {
      const episode = byId.get(match.candidateId)
      return episode
        ? [
            {
              releaseId: release.id,
              episodeId: episode.id,
              title: episode.title,
              ...(episode.season === undefined ? {} : { season: episode.season }),
              ...(episode.episode === undefined ? {} : { episode: episode.episode }),
              score: match.score,
              confidence: match.confidence,
              requiresConfirmation: true,
              evidence,
              contributions: match.contributions,
              mismatches: match.mismatches,
              warnings: match.warnings,
            },
          ]
        : []
    }),
  }
}

/**
 * Refresh one already-associated official track. Calls for the same logical
 * track share one promise, including calls made by concurrent viewers.
 */
export async function refreshBilibiliDanmakuTrack(
  trackId: string,
  rawReference: string,
  options: BilibiliDanmakuRefreshOptions = {},
): Promise<BilibiliDanmakuTrackRefresh> {
  const track = findDanmakuTrack(trackId)
  if (!track) throw new DanmakuMatchInvalid("danmaku track is required")
  if (track.sourceClass !== "provider-official") {
    throw new DanmakuMatchInvalid("only provider-official tracks can use Bilibili refresh")
  }
  const source = bilibiliSourceFromReference(rawReference)
  if (!source) throw new DanmakuMatchInvalid("Bilibili danmaku reference is invalid")

  const existing = refreshesInFlight.get(trackId)
  if (existing) return existing

  const normalizedOptions = normalizeOptions(options)
  const latestAttempt = listDanmakuRevisions(trackId)[0]
  if (track.status === "disabled") {
    return {
      attempted: false,
      changed: false,
      failed: false,
      revision: latestAttempt ?? null,
    }
  }
  if (
    latestAttempt &&
    normalizedOptions.now - latestAttempt.fetchedAt < normalizedOptions.freshnessMs
  ) {
    return {
      attempted: false,
      changed: false,
      failed: latestAttempt.status === "failed",
      revision: latestAttempt,
    }
  }

  const provenance = {
    provider: "bilibili",
    reference: source.reference,
    label: "Bilibili official",
  } as const
  const refresh = (async () => {
    try {
      const cues = await fetchDanmakuCues(source.reference, normalizedOptions.fetcher)
      const result = ingestDanmakuRevision(trackId, cues, provenance, normalizedOptions.now)
      return {
        attempted: true,
        changed: result.changed,
        failed: false,
        revision: result.revision,
      }
    } catch (error) {
      const failure = recordDanmakuRefreshFailure(
        trackId,
        error instanceof Error ? error.message : "Bilibili danmaku refresh failed",
        provenance,
        normalizedOptions.now,
      )
      return { attempted: true, changed: false, failed: true, revision: failure }
    }
  })()
  refreshesInFlight.set(trackId, refresh)
  void refresh.then(
    () => clearInFlightRefresh(trackId, refresh),
    () => clearInFlightRefresh(trackId, refresh),
  )
  return refresh
}

function clearInFlightRefresh(
  trackId: string,
  refresh: Promise<BilibiliDanmakuTrackRefresh>,
): void {
  if (refreshesInFlight.get(trackId) === refresh) refreshesInFlight.delete(trackId)
}

function normalizeOptions(options: BilibiliDanmakuRefreshOptions): {
  now: number
  freshnessMs: number
  fetcher: FetchLike
  duration?: number
  fingerprint?: BaiduMediaFingerprint
} {
  const now = options.now ?? Date.now()
  const freshnessMs = options.freshnessMs ?? BILIBILI_DANMAKU_FRESHNESS_MS
  if (!Number.isFinite(now)) throw new DanmakuMatchInvalid("refresh time is invalid")
  if (!Number.isFinite(freshnessMs) || freshnessMs < 0) {
    throw new DanmakuMatchInvalid("refresh freshness is invalid")
  }
  if (options.fingerprint !== undefined && !safeBaiduFingerprint(options.fingerprint)) {
    throw new DanmakuMatchInvalid("fingerprint is invalid")
  }
  return {
    now,
    freshnessMs,
    fetcher: options.fetcher ?? fetch,
    ...(isValidNonNegativeNumber(options.duration) ? { duration: options.duration } : {}),
    ...(options.fingerprint === undefined ? {} : { fingerprint: options.fingerprint }),
  }
}

function safeBaiduFingerprint(value: BaiduMediaFingerprint): boolean {
  return (
    value.algorithm === "md5" &&
    value.scope === "prefix" &&
    Number.isInteger(value.bytes) &&
    value.bytes >= 1 &&
    value.bytes <= BAIDU_MEDIA_FINGERPRINT_MAX_BYTES &&
    /^[0-9a-f]{32}$/.test(value.value)
  )
}

function ensureBaiduMediaRelease(
  source: BaiduSourceRecord,
  duration: number | undefined,
  now: number,
  fingerprint?: BaiduMediaFingerprint,
): { release: MediaRelease; evidence: DanmakuEvidence[] } {
  const existing = findMediaReleaseByProvider("baidu", source.id)
  const release =
    existing ??
    (() => {
      const deterministicId = `baidu-release-${source.id}`
      const occupied = findMediaRelease(deterministicId)
      const next: MediaRelease = {
        id: occupied ? newId() : deterministicId,
        provider: "baidu",
        providerReference: source.id,
        fileName: source.fileName,
        ...(isValidNonNegativeInteger(source.size) ? { size: source.size } : {}),
        ...(isValidNonNegativeNumber(duration) ? { duration } : {}),
        createdAt: now,
      }
      try {
        registerMediaRelease(next)
        return next
      } catch (error) {
        const concurrent = findMediaReleaseByProvider("baidu", source.id)
        if (concurrent) return concurrent
        throw error
      }
    })()

  const desiredEvidence: DanmakuEvidence[] = [
    { kind: "provider", provider: "baidu", reference: source.id },
    extractFilenameEvidence(source.fileName),
    ...(isValidNonNegativeInteger(source.size)
      ? [{ kind: "size" as const, bytes: source.size }]
      : []),
    ...(isValidNonNegativeNumber(duration)
      ? [{ kind: "duration" as const, seconds: duration }]
      : []),
    ...(fingerprint === undefined ? [] : [{ kind: "fingerprint" as const, digest: fingerprint }]),
  ]
  const storedEvidence = listMediaReleaseEvidence(release.id)
  for (const evidence of desiredEvidence) {
    if (!storedEvidence.some((item) => sameEvidence(item, evidence))) {
      recordMediaReleaseEvidence(release.id, evidence, now)
      storedEvidence.push(evidence)
    }
  }
  return { release, evidence: storedEvidence }
}

function safeBaiduSource(source: BaiduSourceRecord): boolean {
  return (
    safeSourceText(source.id, 512) &&
    safeSourceText(source.bushitsuId, 512) &&
    safeSourceText(source.enmokuId, 512) &&
    safeSourceText(source.fileName, 1024) &&
    source.fileName.trim().length > 0 &&
    !/[\\/]/.test(source.fileName) &&
    (source.size === undefined || isValidNonNegativeInteger(source.size))
  )
}

function safeSourceText(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && !hasControlCharacter(value)
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 0x1f || codePoint === 0x7f
  })
}

function sameEvidence(left: DanmakuEvidence, right: DanmakuEvidence): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isValidNonNegativeInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 0
}

function isValidNonNegativeNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0
}

function bilibiliSource(enmoku: Enmoku): { reference: string; cid: string } | null {
  return enmoku.danmaku?.type === "fetch" ? bilibiliSourceFromReference(enmoku.danmaku.ref) : null
}

function bilibiliSourceFromReference(
  rawReference: string,
): { reference: string; cid: string } | null {
  let reference: string
  try {
    reference = decodeURIComponent(rawReference).trim()
  } catch {
    return null
  }
  const match = /^bilibili:(\d+)$/.exec(reference)
  return match?.[1] ? { reference, cid: match[1] } : null
}

function ensureBilibiliMediaRelease(
  source: { reference: string; cid: string },
  now: number,
): MediaRelease {
  const existing =
    findMediaReleaseByProvider("bilibili", source.reference) ??
    findMediaReleaseByProvider("bilibili", source.cid)
  const release =
    existing ??
    (() => {
      const deterministicId = `bilibili-release-${source.cid}`
      const occupied = findMediaRelease(deterministicId)
      const next: MediaRelease = {
        id: occupied ? newId() : deterministicId,
        provider: "bilibili",
        providerReference: source.reference,
        createdAt: now,
      }
      try {
        registerMediaRelease(next)
        return next
      } catch (error) {
        // A second housou process may have won the deterministic insert after
        // our lookup. Re-read the provider identity before surfacing a real
        // persistence error.
        const concurrent =
          findMediaReleaseByProvider("bilibili", source.reference) ??
          findMediaReleaseByProvider("bilibili", source.cid)
        if (concurrent) return concurrent
        throw error
      }
    })()

  const hasProviderEvidence = listMediaReleaseEvidence(release.id).some(
    (evidence) =>
      evidence.kind === "provider" &&
      evidence.provider === "bilibili" &&
      evidence.reference === source.reference,
  )
  if (!hasProviderEvidence) {
    // Provider references are safe provenance, unlike media URLs, cookies, or
    // adaptor handles. They make the release's source explainable to a matcher.
    recordMediaReleaseEvidence(
      release.id,
      { kind: "provider", provider: "bilibili", reference: source.reference },
      now,
    )
  }
  return release
}

function ensureMatchedOfficialTracks(
  actorSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  release: MediaRelease,
  reference: string,
  now: number,
): DanmakuTrack[] {
  const matches = listReleaseEpisodeMatches(release.id).filter((match) => {
    if (match.trustScope === "global") return true
    if (match.trustScope === "personal") return match.seitoId === actorSeitoId
    return (
      match.bushitsuId === bushitsuId &&
      (match.enmokuId === undefined || match.enmokuId === enmokuId)
    )
  })
  const episodeIds = [...new Set(matches.map((match) => match.episodeId))]
  return episodeIds.map((episodeId) => {
    const existing = findDanmakuTrackByReleaseAndEpisode(release.id, episodeId, "provider-official")
    if (existing) return existing

    const deterministicId = `bilibili-track-${release.id}-${episodeId}`
    const track: DanmakuTrack = {
      id: findDanmakuTrack(deterministicId) ? newId() : deterministicId,
      episodeId,
      releaseId: release.id,
      sourceClass: "provider-official",
      name: "Bilibili official",
      provenance: { provider: "bilibili", reference, label: "Bilibili official" },
      status: "active",
      createdAt: now,
      updatedAt: now,
    }
    try {
      return registerDanmakuTrack(track)
    } catch (error) {
      // Match the same logical track if another request won the deterministic
      // insert between our existence check and registration.
      const concurrent = findDanmakuTrackByReleaseAndEpisode(
        release.id,
        episodeId,
        "provider-official",
      )
      if (concurrent) return concurrent
      throw error
    }
  })
}
