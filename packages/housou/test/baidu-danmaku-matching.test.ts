import { expect, test } from "bun:test"
import type { BaiduMediaFingerprint, BaiduSourceRecord, DanmakuEvidence } from "houkago-kousoku"
import { insertBaiduSource as insertBaiduSourceRecord } from "../src/db/queries/baidu"
import { insertBushitsuWithBuchou } from "../src/db/queries/bushitsu"
import {
  findGlobalReleaseEpisodeMatch,
  findMediaReleaseByProvider,
  insertDanmakuEpisode,
  listMediaReleaseEvidence,
} from "../src/db/queries/danmaku"
import { listDanmakuAudit } from "../src/db/queries/danmaku-audit"
import { insertKomonGrant } from "../src/db/queries/komon"
import { insertSeito } from "../src/db/queries/seito"
import { addEnmoku } from "../src/domain/bushitsu"
import {
  confirmReleaseEpisodeMatch,
  ingestDanmakuRevision,
  registerDanmakuTrack,
  resolveDanmakuCandidates,
  saveDanmakuAlignment,
} from "../src/domain/danmaku"
import {
  ensureBaiduDanmakuSource,
  resolveDanmakuCandidatesWithRefresh,
} from "../src/domain/danmaku-source"
import { app } from "../src/index"
import { issueSeitoshou } from "../src/lib/seitoshou"
import { join } from "../src/ws/housou"

type Account = { id: string; cookie: string }

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function account(prefix: string): Account {
  const accountId = id(prefix)
  insertSeito({
    id: accountId,
    username: accountId,
    usernameNorm: accountId.toLowerCase(),
    passwordHash: "test-only",
    createdAt: 1,
  })
  const session = issueSeitoshou({ id: accountId, username: accountId, createdAt: 1 }, Date.now())
  return { id: accountId, cookie: `houkago_seitoshou=${session.token}` }
}

function episode(episodeId: string, title: string, number: number) {
  const value = {
    id: episodeId,
    title,
    season: 1,
    episode: number,
    createdAt: 1,
    updatedAt: 1,
  } as const
  insertDanmakuEpisode(value)
  return value
}

function baiduSource(
  sourceId: string,
  ownerSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  fileName: string,
  size = 123,
): BaiduSourceRecord {
  return {
    id: sourceId,
    ownerSeitoId,
    authorizationId: id("authorization"),
    bushitsuId,
    enmokuId,
    fileName,
    size,
    retentionMode: "server-saved",
    encryptedFsid: "ciphertext-only",
    createdAt: 1,
  }
}

async function readCandidates(
  actor: Account,
  bushitsuId: string,
  enmokuId: string,
  duration: number,
  fingerprint?: BaiduMediaFingerprint,
): Promise<{
  bushitsuId: string
  enmokuId: string
  candidates: unknown[]
  matchCandidates?: Array<{
    releaseId: string
    episodeId: string
    score: number
    confidence: string
    requiresConfirmation: true
    evidence: DanmakuEvidence[]
  }>
}> {
  const response = await app.handle(
    new Request(
      `http://localhost/danmaku/bushitsu/${bushitsuId}/enmoku/${enmokuId}?${new URLSearchParams({
        duration: String(duration),
        ...(fingerprint === undefined
          ? {}
          : { fingerprint: fingerprint.value, fingerprintBytes: String(fingerprint.bytes) }),
      })}`,
      { headers: { cookie: actor.cookie } },
    ),
  )
  expect(response.status).toBe(200)
  return (await response.json()) as Awaited<ReturnType<typeof readCandidates>>
}

test("Baidu filename matching is explainable and confirmation remains scoped", async () => {
  const owner = account("baidu-match-owner")
  const komon = account("baidu-match-komon")
  insertKomonGrant({ id: id("komon-grant"), seitoId: komon.id, grantedAt: 1 })

  const bushitsuId = id("baidu-match-room")
  const episodeId = id("baidu-match-episode")
  const nearbyEpisodeId = id("baidu-nearby-episode")
  const sourceId = id("baidu-match-source")
  insertBushitsuWithBuchou({
    id: bushitsuId,
    name: "Baidu matching room",
    buchouId: owner.id,
    createdAt: 1,
  })
  episode(episodeId, "The Apothecary Diaries", 3)
  episode(nearbyEpisodeId, "The Apothecary Diaries", 4)

  const track = registerDanmakuTrack({
    id: id("shared-track"),
    episodeId,
    sourceClass: "server-stored",
    name: "Canonical episode track",
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  })
  ingestDanmakuRevision(track.id, [{ time: 1, text: "shared", mode: "scroll" }], undefined, 2)

  const fileName = "[ReleaseGroup] The Apothecary Diaries - S01E03 [1080p].mkv"
  const enmoku = addEnmoku(bushitsuId, {
    title: fileName,
    type: "direct",
    url: `/baidu/source/${sourceId}`,
    addedBy: owner.id,
    provider: {
      kind: "baidu",
      sourceId,
      fileName,
      size: 123,
    },
  })
  insertBaiduSourceRecord(baiduSource(sourceId, owner.id, bushitsuId, enmoku.id, fileName))
  join(bushitsuId, owner.id, "owner")

  const result = await readCandidates(owner, bushitsuId, enmoku.id, 600)
  const match = result.matchCandidates?.find((candidate) => candidate.episodeId === episodeId)
  expect(match).toMatchObject({
    episodeId,
    score: 90,
    confidence: "suggested",
    requiresConfirmation: true,
  })
  expect(result.matchCandidates?.some((candidate) => candidate.episodeId === nearbyEpisodeId)).toBe(
    true,
  )
  expect(JSON.stringify(result)).not.toContain("ciphertext-only")
  expect(JSON.stringify(result)).not.toMatch(
    /fsid|dlink|access[_-]?token|upstreamHandle|\/baidu\/source/,
  )

  const release = findMediaReleaseByProvider("baidu", sourceId)
  expect(release).toMatchObject({
    provider: "baidu",
    providerReference: sourceId,
    fileName,
    size: 123,
    duration: 600,
  })
  if (!release) throw new Error("Baidu release was not persisted")
  expect(listMediaReleaseEvidence(release.id)).toEqual(
    expect.arrayContaining([
      { kind: "provider", provider: "baidu", reference: sourceId },
      {
        kind: "filename",
        work: "the apothecary diaries",
        season: 1,
        episode: 3,
        group: "ReleaseGroup",
      },
      { kind: "size", bytes: 123 },
      { kind: "duration", seconds: 600 },
    ]),
  )

  if (!match) throw new Error("Baidu episode suggestion was not returned")
  const personal = confirmReleaseEpisodeMatch(owner.id, {
    releaseId: match.releaseId,
    episodeId: match.episodeId,
    trustScope: "personal",
    evidence: match.evidence,
  })
  expect(personal.trustScope).toBe("personal")
  expect(findGlobalReleaseEpisodeMatch(release.id)).toBeNull()
  expect(resolveDanmakuCandidates(owner.id, bushitsuId, enmoku.id).candidates).toContainEqual(
    expect.objectContaining({ id: track.id, sourceClass: "server-stored" }),
  )

  const proposal = await app.handle(
    new Request("http://localhost/danmaku/proposals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: owner.cookie,
        origin: "http://127.0.0.1:5173",
      },
      body: JSON.stringify({
        releaseId: release.id,
        targetEpisodeId: episodeId,
        evidence: match.evidence,
      }),
    }),
  )
  expect(proposal.status).toBe(200)
  expect((await proposal.json()).status).toBe("pending")
  expect(findGlobalReleaseEpisodeMatch(release.id)).toBeNull()

  const promoted = confirmReleaseEpisodeMatch(komon.id, {
    releaseId: release.id,
    episodeId,
    trustScope: "global",
    evidence: match.evidence,
  })
  expect(promoted.confidence).toBe("confirmed")
  expect(findGlobalReleaseEpisodeMatch(release.id)?.episodeId).toBe(episodeId)
  expect(listDanmakuAudit("release_episode_match", promoted.id).map((item) => item.action)).toEqual(
    ["match_promoted"],
  )

  const exact = await resolveDanmakuCandidatesWithRefresh(
    owner.id,
    bushitsuId,
    enmoku.id,
    undefined,
    { duration: 600 },
  )
  expect(exact.matchCandidates).toBeUndefined()
  expect(exact.candidates).toContainEqual(expect.objectContaining({ id: track.id }))
})

test("Baidu matching ignores unsafe filenames and still enforces room admission", async () => {
  const owner = account("baidu-unsafe-owner")
  const bushitsuId = id("baidu-unsafe-room")
  const sourceId = id("baidu-unsafe-source")
  insertBushitsuWithBuchou({
    id: bushitsuId,
    name: "Baidu unsafe metadata room",
    buchouId: owner.id,
    createdAt: 1,
  })
  const enmoku = addEnmoku(bushitsuId, {
    title: "private source",
    type: "direct",
    url: `/baidu/source/${sourceId}`,
    addedBy: owner.id,
    provider: {
      kind: "baidu",
      sourceId,
      fileName: "private/secret.mkv",
    },
  })
  insertBaiduSourceRecord(
    baiduSource(sourceId, owner.id, bushitsuId, enmoku.id, "private/secret.mkv", 0),
  )

  const notAdmitted = await app.handle(
    new Request(`http://localhost/danmaku/bushitsu/${bushitsuId}/enmoku/${enmoku.id}`, {
      headers: { cookie: owner.cookie },
    }),
  )
  expect(notAdmitted.status).toBe(403)

  join(bushitsuId, owner.id, "owner")
  const result = ensureBaiduDanmakuSource(owner.id, bushitsuId, enmoku.id)
  expect(result).toEqual({ release: null, matchCandidates: [] })
  expect(findMediaReleaseByProvider("baidu", sourceId)).toBeNull()
  expect(enmoku.url).toBe(`/baidu/source/${sourceId}`)
  expect(resolveDanmakuCandidates(owner.id, bushitsuId, enmoku.id).candidates).toEqual([])
})

test("different Baidu encodes reuse one episode track with release-specific alignment", () => {
  const owner = account("baidu-alignment-owner")
  const bushitsuId = id("baidu-alignment-room")
  const episodeId = id("baidu-alignment-episode")
  const firstSourceId = id("baidu-alignment-source-a")
  const secondSourceId = id("baidu-alignment-source-b")
  insertBushitsuWithBuchou({
    id: bushitsuId,
    name: "Baidu alignment room",
    buchouId: owner.id,
    createdAt: 1,
  })
  const canonicalEpisode = episode(episodeId, "The Apothecary Diaries", 3)
  const track = registerDanmakuTrack({
    id: id("shared-alignment-track"),
    episodeId: canonicalEpisode.id,
    sourceClass: "server-stored",
    name: "Shared canonical track",
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  })
  ingestDanmakuRevision(track.id, [{ time: 1, text: "shared", mode: "scroll" }], undefined, 2)

  const firstEnmoku = addEnmoku(bushitsuId, {
    title: "[Group A] The Apothecary Diaries - S01E03 [1080p].mkv",
    type: "direct",
    url: `/baidu/source/${firstSourceId}`,
    addedBy: owner.id,
    provider: {
      kind: "baidu",
      sourceId: firstSourceId,
      fileName: "[Group A] The Apothecary Diaries - S01E03 [1080p].mkv",
      size: 100,
    },
  })
  const secondEnmoku = addEnmoku(bushitsuId, {
    title: "[Group B] The Apothecary Diaries - S01E03 [720p].mp4",
    type: "direct",
    url: `/baidu/source/${secondSourceId}`,
    addedBy: owner.id,
    provider: {
      kind: "baidu",
      sourceId: secondSourceId,
      fileName: "[Group B] The Apothecary Diaries - S01E03 [720p].mp4",
      size: 200,
    },
  })
  insertBaiduSourceRecord(
    baiduSource(
      firstSourceId,
      owner.id,
      bushitsuId,
      firstEnmoku.id,
      "[Group A] The Apothecary Diaries - S01E03 [1080p].mkv",
      100,
    ),
  )
  insertBaiduSourceRecord(
    baiduSource(
      secondSourceId,
      owner.id,
      bushitsuId,
      secondEnmoku.id,
      "[Group B] The Apothecary Diaries - S01E03 [720p].mp4",
      200,
    ),
  )
  join(bushitsuId, owner.id, "owner")

  const first = ensureBaiduDanmakuSource(owner.id, bushitsuId, firstEnmoku.id, { duration: 600 })
  const second = ensureBaiduDanmakuSource(owner.id, bushitsuId, secondEnmoku.id, { duration: 599 })
  const firstMatch = first.matchCandidates.find((candidate) => candidate.episodeId === episodeId)
  const secondMatch = second.matchCandidates.find((candidate) => candidate.episodeId === episodeId)
  expect(firstMatch?.confidence).toBe("suggested")
  expect(secondMatch?.confidence).toBe("suggested")
  if (!firstMatch || !secondMatch || !first.release || !second.release) {
    throw new Error("expected both Baidu encodes to produce a match")
  }
  confirmReleaseEpisodeMatch(owner.id, {
    releaseId: first.release.id,
    episodeId,
    trustScope: "personal",
    evidence: firstMatch.evidence,
  })
  confirmReleaseEpisodeMatch(owner.id, {
    releaseId: second.release.id,
    episodeId,
    trustScope: "personal",
    evidence: secondMatch.evidence,
  })
  const firstAlignment = saveDanmakuAlignment(
    owner.id,
    { releaseId: first.release.id, trackId: track.id, offsetSeconds: 0.25 },
    10,
  )
  const secondAlignment = saveDanmakuAlignment(
    owner.id,
    { releaseId: second.release.id, trackId: track.id, offsetSeconds: -0.5 },
    11,
  )
  expect(firstAlignment.offsetSeconds).toBe(0.25)
  expect(secondAlignment.offsetSeconds).toBe(-0.5)
  const firstResolution = resolveDanmakuCandidates(owner.id, bushitsuId, firstEnmoku.id)
  const secondResolution = resolveDanmakuCandidates(owner.id, bushitsuId, secondEnmoku.id)
  expect(firstResolution.candidates).toContainEqual(
    expect.objectContaining({
      id: track.id,
      alignment: expect.objectContaining({ offsetSeconds: 0.25 }),
    }),
  )
  expect(secondResolution.candidates).toContainEqual(
    expect.objectContaining({
      id: track.id,
      alignment: expect.objectContaining({ offsetSeconds: -0.5 }),
    }),
  )
})

test("a promoted Baidu fingerprint reuses the canonical track through candidate resolution", async () => {
  const owner = account("baidu-fingerprint-owner")
  const komon = account("baidu-fingerprint-komon")
  insertKomonGrant({ id: id("komon-fingerprint-grant"), seitoId: komon.id, grantedAt: 1 })

  const bushitsuId = id("baidu-fingerprint-room")
  const episodeId = id("baidu-fingerprint-episode")
  const firstSourceId = id("baidu-fingerprint-source-a")
  const secondSourceId = id("baidu-fingerprint-source-b")
  const fingerprint: BaiduMediaFingerprint = {
    algorithm: "md5",
    scope: "prefix",
    bytes: 1024,
    value: "0123456789abcdef0123456789abcdef",
  }
  insertBushitsuWithBuchou({
    id: bushitsuId,
    name: "Baidu fingerprint room",
    buchouId: owner.id,
    createdAt: 1,
  })
  episode(episodeId, "Fingerprint episode", 1)
  const track = registerDanmakuTrack({
    id: id("baidu-fingerprint-track"),
    episodeId,
    sourceClass: "server-stored",
    name: "Fingerprint canonical track",
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  })
  ingestDanmakuRevision(
    track.id,
    [{ time: 1, text: "fingerprint cue", mode: "scroll" }],
    undefined,
    2,
  )

  const firstFileName = "[Fingerprint Group] Fingerprint episode - S01E01.mkv"
  const firstEnmoku = addEnmoku(bushitsuId, {
    title: firstFileName,
    type: "direct",
    url: `/baidu/source/${firstSourceId}`,
    addedBy: owner.id,
    provider: {
      kind: "baidu",
      sourceId: firstSourceId,
      fileName: firstFileName,
      size: 100,
    },
  })
  insertBaiduSourceRecord(
    baiduSource(firstSourceId, owner.id, bushitsuId, firstEnmoku.id, firstFileName, 100),
  )
  join(bushitsuId, owner.id, "owner")

  const first = await readCandidates(owner, bushitsuId, firstEnmoku.id, 600, fingerprint)
  const firstMatch = first.matchCandidates?.find((candidate) => candidate.episodeId === episodeId)
  const firstRelease = findMediaReleaseByProvider("baidu", firstSourceId)
  expect(firstMatch).toBeDefined()
  expect(firstRelease).toBeDefined()
  if (!firstMatch || !firstRelease) throw new Error("fingerprint source did not produce a match")
  expect(listMediaReleaseEvidence(firstRelease.id)).toContainEqual({
    kind: "fingerprint",
    digest: fingerprint,
  })
  confirmReleaseEpisodeMatch(komon.id, {
    releaseId: firstRelease.id,
    episodeId,
    trustScope: "global",
    evidence: firstMatch.evidence,
  })

  const secondFileName = "opaque-video-release.mkv"
  const secondEnmoku = addEnmoku(bushitsuId, {
    title: secondFileName,
    type: "direct",
    url: `/baidu/source/${secondSourceId}`,
    addedBy: owner.id,
    provider: {
      kind: "baidu",
      sourceId: secondSourceId,
      fileName: secondFileName,
      size: 200,
    },
  })
  insertBaiduSourceRecord(
    baiduSource(secondSourceId, owner.id, bushitsuId, secondEnmoku.id, secondFileName, 200),
  )

  const second = await readCandidates(owner, bushitsuId, secondEnmoku.id, 600, fingerprint)
  const reused = second.candidates.find(
    (candidate) => (candidate as { id?: string }).id === track.id,
  )
  expect(reused).toMatchObject({
    id: track.id,
    episodeId,
    sourceClass: "server-stored",
    cues: [{ time: 1, text: "fingerprint cue", mode: "scroll" }],
  })
  expect(second.matchCandidates ?? []).toEqual([])
  expect(JSON.stringify(second)).not.toContain("ciphertext-only")
})
