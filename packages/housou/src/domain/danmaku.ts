import { Value } from "@sinclair/typebox/value"
import type {
  DanmakuAlignment,
  DanmakuCandidate,
  DanmakuCandidateAvailability,
  DanmakuCandidateResolution,
  DanmakuContent,
  DanmakuCue,
  DanmakuDefault,
  DanmakuDefaultSnapshot,
  DanmakuEpisode,
  DanmakuEvidence,
  DanmakuProposal,
  DanmakuProposalDecision,
  DanmakuRevision,
  DanmakuSourcePolicy,
  DanmakuTrack,
  Enmoku,
  MediaRelease,
  ReleaseEpisodeMatch,
  ReleaseEpisodeMatchInput,
} from "houkago-kousoku"
import {
  DanmakuAlignmentSchema,
  DanmakuCandidateResolutionSchema,
  DanmakuCueSchema,
  DanmakuDefaultSchema,
  DanmakuDefaultSnapshotSchema,
  DanmakuEpisodeSchema,
  DanmakuEvidenceSchema,
  DanmakuProposalDecisionSchema,
  DanmakuProposalSchema,
  DanmakuProvenanceSchema,
  DanmakuSourcePolicySchema,
  DanmakuTrackSchema,
  MediaReleaseSchema,
  ReleaseEpisodeMatchInputSchema,
} from "houkago-kousoku"
import { db } from "../db/client"
import {
  blockDanmakuRevision,
  clearEnmokuDanmakuDefault as clearEnmokuDanmakuDefaultRow,
  decideDanmakuProposal as decideDanmakuProposalRow,
  deleteDanmakuContent,
  findActiveDanmakuRevision,
  findDanmakuAlignment,
  findDanmakuContent,
  findDanmakuEpisode,
  findDanmakuRevision,
  findDanmakuTrack,
  findGlobalReleaseEpisodeMatch,
  findLatestValidDanmakuRevision,
  findMediaRelease,
  findMediaReleaseByProvider,
  getDanmakuSourcePolicy as getDanmakuSourcePolicyRow,
  getEnmokuDanmakuDefault,
  insertDanmakuContent,
  insertDanmakuEpisode,
  insertDanmakuProposal,
  insertDanmakuRevision,
  insertDanmakuTrack,
  insertMediaRelease,
  insertMediaReleaseEvidence,
  insertReleaseEpisodeMatch,
  isDanmakuRevisionBlocked,
  listCollectableDanmakuContent,
  listDanmakuProposals as listDanmakuProposalsRows,
  listDanmakuRevisions,
  listDanmakuTracks,
  listEnmokuDanmakuDefaults,
  listReleaseEpisodeMatches,
  requireProposal,
  requireRevision,
  requireTrack,
  searchDanmakuEpisodes as searchDanmakuEpisodesRows,
  setDanmakuRevisionPinned,
  setDanmakuSourcePolicy,
  setDanmakuTrackActiveRevision,
  setEnmokuDanmakuDefault as setEnmokuDanmakuDefaultRow,
  upsertDanmakuAlignment,
} from "../db/queries/danmaku"
import { insertDanmakuAudit } from "../db/queries/danmaku-audit"
import { findSeitoById } from "../db/queries/seito"
import { hashCanonicalDanmakuCues } from "../lib/danmaku-content"
import {
  DanmakuMatchInvalid,
  DanmakuPolicyInvalid,
  DanmakuRevisionNotFound,
  Forbidden,
} from "../lib/errors"
import { newId } from "../lib/id"
import { isKomon, requireKomon } from "../lib/komon"
import { isPresent } from "../ws/housou"
import { fetchBangumi, fetchBushitsu } from "./bushitsu"

type EpisodeDraft = Pick<DanmakuEpisode, "title"> &
  Partial<Pick<DanmakuEpisode, "season" | "episode" | "episodeTitle" | "description">>

export type DanmakuProposalInput = Pick<
  DanmakuProposal,
  | "releaseId"
  | "targetEpisodeId"
  | "suggestedTitle"
  | "suggestedSeason"
  | "suggestedEpisode"
  | "suggestedDescription"
  | "evidence"
>

export function searchDanmakuEpisodes(query = ""): DanmakuEpisode[] {
  return searchDanmakuEpisodesRows(query)
}

export function listDanmakuProposals(status?: DanmakuProposal["status"]): DanmakuProposal[] {
  return listDanmakuProposalsRows(status)
}

export function getDanmakuSourcePolicy(): DanmakuSourcePolicy {
  return getDanmakuSourcePolicyRow()
}

// Resolve server-addressable candidates for one admitted viewer. The resolver
// only reads the identity pool and legacy safe reference; provider fetching and
// parsing remain behind eisha/kokuban boundaries.
export function resolveDanmakuCandidates(
  actorSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  releaseId?: string,
): DanmakuCandidateResolution {
  const room = fetchBushitsu(bushitsuId)
  if (!isPresent(bushitsuId, actorSeitoId)) {
    throw new Forbidden("room admission is required")
  }
  const enmoku = fetchBangumi(bushitsuId).find((item) => item.id === enmokuId)
  if (!enmoku) throw new DanmakuMatchInvalid("Enmoku does not belong to the room")

  const policy = getDanmakuSourcePolicy()
  const enmokuRelease = mediaReleaseForEnmoku(enmoku)
  if (releaseId !== undefined && enmokuRelease && releaseId !== enmokuRelease.id) {
    throw new DanmakuMatchInvalid("media release does not match the Enmoku")
  }
  const release = releaseId !== undefined ? findMediaRelease(releaseId) : enmokuRelease
  if (releaseId !== undefined && !release) {
    throw new DanmakuMatchInvalid("media release does not exist")
  }
  const matches = release
    ? visibleReleaseMatches(release.id, bushitsuId, enmokuId, actorSeitoId)
    : []
  const candidates = new Map<string, DanmakuCandidate>()
  for (const match of matches) {
    for (const track of listDanmakuTracks(match.episodeId)) {
      const candidate = candidateFromTrack(track, policy, match.evidence, release?.id)
      candidates.set(candidate.id, candidate)
    }
  }

  const storedDefault = getEnmokuDanmakuDefault(enmokuId)
  if (storedDefault && storedDefault.bushitsuId === bushitsuId) {
    const defaultTrack = findDanmakuTrack(storedDefault.trackId)
    if (defaultTrack && !candidates.has(defaultTrack.id)) {
      candidates.set(defaultTrack.id, candidateFromTrack(defaultTrack, policy, undefined))
    }
  }

  const legacyRef = safeLegacyDanmakuRef(enmoku.danmaku)
  const poolOfficialCandidates =
    release === null
      ? []
      : [...candidates.values()].filter(
          (candidate) =>
            candidate.sourceClass === "provider-official" &&
            candidate.trackId !== undefined &&
            candidate.releaseId === release.id,
        )
  const legacyFallbackAllowed =
    poolOfficialCandidates.length === 0 ||
    poolOfficialCandidates.every(
      (candidate) =>
        candidate.availability === "failed" || candidate.availability === "unavailable",
    )
  if (legacyRef && legacyFallbackAllowed) {
    const legacyCandidate: DanmakuCandidate = {
      id: `legacy:${enmoku.id}`,
      sourceClass: "provider-official",
      name: "Online danmaku",
      provenance: { reference: legacyRef },
      ...(release === null || release === undefined ? {} : { releaseId: release.id }),
      legacyRef,
      availability: policy.allowedClasses.includes("provider-official") ? "available" : "disabled",
      ...(policy.allowedClasses.includes("provider-official")
        ? {}
        : { reason: "source class is disabled by deployment policy" }),
    }
    candidates.set(legacyCandidate.id, legacyCandidate)
  }

  const orderedCandidates = [...candidates.values()].sort((left, right) =>
    compareCandidates(left, right, policy),
  )
  const roomDefault =
    storedDefault && storedDefault.bushitsuId === bushitsuId
      ? defaultEntry(storedDefault, policy)
      : null
  const result: DanmakuCandidateResolution = {
    bushitsuId: room.id,
    enmokuId,
    policy,
    candidates: orderedCandidates,
    roomDefault,
  }
  if (!Value.Check(DanmakuCandidateResolutionSchema, result)) {
    throw new DanmakuMatchInvalid("invalid danmaku candidate resolution")
  }
  return result
}

// The room snapshot is intentionally complete. A reconnecting viewer can
// replace its local map atomically instead of guessing which defaults changed.
export function getDanmakuDefaultSnapshot(bushitsuId: string): DanmakuDefaultSnapshot {
  fetchBushitsu(bushitsuId)
  const policy = getDanmakuSourcePolicy()
  const enmokuIds = new Set(fetchBangumi(bushitsuId).map((enmoku) => enmoku.id))
  const snapshot: DanmakuDefaultSnapshot = {
    bushitsuId,
    defaults: listEnmokuDanmakuDefaults(bushitsuId)
      .filter((record) => enmokuIds.has(record.enmokuId))
      .map((record) => defaultEntry(record, policy)),
  }
  if (!Value.Check(DanmakuDefaultSnapshotSchema, snapshot)) {
    throw new DanmakuMatchInvalid("invalid danmaku default snapshot")
  }
  return snapshot
}

export function setEnmokuDanmakuDefault(
  actorSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  trackId: string,
  now = Date.now(),
): DanmakuDefaultSnapshot {
  authorizeRoomOwner(actorSeitoId, bushitsuId)
  const resolution = resolveDanmakuCandidates(actorSeitoId, bushitsuId, enmokuId)
  const candidate = resolution.candidates.find(
    (item) => item.trackId === trackId && item.id === trackId,
  )
  if (
    !candidate ||
    candidate.sourceClass === "local" ||
    candidate.releaseId === undefined ||
    candidate.availability !== "available"
  ) {
    throw new DanmakuMatchInvalid("track is not an eligible server default")
  }
  const track = findDanmakuTrack(trackId)
  if (!track || track.sourceClass === "local" || track.releaseId === undefined) {
    throw new DanmakuMatchInvalid("track is not server-addressable")
  }

  db.transaction(() => {
    setEnmokuDanmakuDefaultRow(enmokuId, bushitsuId, trackId, now)
    insertDanmakuAudit({
      id: newId(),
      action: "enmoku_default_updated",
      actorSeitoId,
      subjectType: "enmoku_danmaku_default",
      subjectId: enmokuId,
      details: { bushitsuId, enmokuId, trackId },
      createdAt: now,
    })
  })()
  return getDanmakuDefaultSnapshot(bushitsuId)
}

export function clearEnmokuDanmakuDefault(
  actorSeitoId: string,
  bushitsuId: string,
  enmokuId: string,
  now = Date.now(),
): DanmakuDefaultSnapshot {
  authorizeRoomOwner(actorSeitoId, bushitsuId)
  const existing = getEnmokuDanmakuDefault(enmokuId)
  if (!fetchBangumi(bushitsuId).some((enmoku) => enmoku.id === enmokuId)) {
    throw new DanmakuMatchInvalid("Enmoku does not belong to the room")
  }
  if (existing && existing.bushitsuId !== bushitsuId) {
    throw new DanmakuMatchInvalid("danmaku default belongs to a different room")
  }
  db.transaction(() => {
    const changed = clearEnmokuDanmakuDefaultRow(enmokuId)
    if (changed) {
      insertDanmakuAudit({
        id: newId(),
        action: "enmoku_default_cleared",
        actorSeitoId,
        subjectType: "enmoku_danmaku_default",
        subjectId: enmokuId,
        details: { bushitsuId, enmokuId },
        createdAt: now,
      })
    }
  })()
  return getDanmakuDefaultSnapshot(bushitsuId)
}

export type DanmakuRevisionIngestResult = {
  track: DanmakuTrack
  revision: DanmakuRevision
  changed: boolean
}

export function curateDanmakuEpisode(
  actorSeitoId: string,
  draft: EpisodeDraft,
  now = Date.now(),
): DanmakuEpisode {
  requireKomon(actorSeitoId)
  if (typeof draft.title !== "string") {
    throw new DanmakuMatchInvalid("invalid canonical episode")
  }
  assertSafeMetadata(draft)
  const candidate: DanmakuEpisode = {
    id: newId(),
    title: draft.title.trim(),
    ...(draft.season === undefined ? {} : { season: draft.season }),
    ...(draft.episode === undefined ? {} : { episode: draft.episode }),
    ...(draft.episodeTitle === undefined ? {} : { episodeTitle: draft.episodeTitle }),
    ...(draft.description === undefined ? {} : { description: draft.description }),
    createdAt: now,
    updatedAt: now,
  }
  if (!Value.Check(DanmakuEpisodeSchema, candidate)) {
    throw new DanmakuMatchInvalid("invalid canonical episode")
  }
  db.transaction(() => {
    insertDanmakuEpisode(candidate)
    insertDanmakuAudit({
      id: newId(),
      action: "episode_curated",
      actorSeitoId,
      subjectType: "episode",
      subjectId: candidate.id,
      details: { title: candidate.title },
      dedupeKey: `episode-curated:${candidate.id}`,
      createdAt: now,
    })
  })()
  return candidate
}

export function registerMediaRelease(release: MediaRelease): void {
  if (!Value.Check(MediaReleaseSchema, release)) {
    throw new DanmakuMatchInvalid("invalid media release")
  }
  assertSafeRelease(release)
  insertMediaRelease(release)
}

export function recordMediaReleaseEvidence(
  releaseId: string,
  evidence: DanmakuEvidence,
  now = Date.now(),
): DanmakuEvidence {
  if (!findMediaRelease(releaseId)) throw new DanmakuMatchInvalid("release is required")
  if (!Value.Check(DanmakuEvidenceSchema, evidence)) {
    throw new DanmakuMatchInvalid("invalid release evidence")
  }
  assertSafeMetadata(evidence)
  insertMediaReleaseEvidence(evidence, releaseId, newId(), now)
  return evidence
}

export function saveDanmakuAlignment(
  actorSeitoId: string,
  input: Omit<DanmakuAlignment, "id" | "createdBy" | "createdAt">,
  now = Date.now(),
): DanmakuAlignment {
  if (!findSeitoById(actorSeitoId)) throw new Forbidden("acting account does not exist")
  const release = findMediaRelease(input.releaseId)
  const track = findDanmakuTrack(input.trackId)
  if (!release || !track) throw new DanmakuMatchInvalid("release and track are required")
  if (track.releaseId !== undefined && track.releaseId !== release.id) {
    throw new DanmakuMatchInvalid("track belongs to a different release")
  }
  const candidate: DanmakuAlignment = {
    id: newId(),
    releaseId: input.releaseId,
    trackId: input.trackId,
    offsetSeconds: input.offsetSeconds,
    ...(input.trimStartSeconds === undefined ? {} : { trimStartSeconds: input.trimStartSeconds }),
    ...(input.trimEndSeconds === undefined ? {} : { trimEndSeconds: input.trimEndSeconds }),
    createdBy: actorSeitoId,
    createdAt: now,
  }
  if (
    !Value.Check(DanmakuAlignmentSchema, candidate) ||
    !Number.isFinite(candidate.offsetSeconds) ||
    (candidate.trimStartSeconds !== undefined && !Number.isFinite(candidate.trimStartSeconds)) ||
    (candidate.trimEndSeconds !== undefined && !Number.isFinite(candidate.trimEndSeconds)) ||
    (candidate.trimStartSeconds !== undefined &&
      candidate.trimEndSeconds !== undefined &&
      candidate.trimEndSeconds < candidate.trimStartSeconds)
  ) {
    throw new DanmakuMatchInvalid("invalid danmaku alignment")
  }
  db.transaction(() => {
    upsertDanmakuAlignment(candidate)
    insertDanmakuAudit({
      id: newId(),
      action: "alignment_updated",
      actorSeitoId,
      subjectType: "alignment",
      subjectId: `${candidate.releaseId}:${candidate.trackId}`,
      details: {
        releaseId: candidate.releaseId,
        trackId: candidate.trackId,
        offsetSeconds: candidate.offsetSeconds,
      },
      createdAt: now,
    })
  })()
  return findDanmakuAlignment(candidate.releaseId, candidate.trackId) ?? candidate
}

export function registerDanmakuTrack(track: DanmakuTrack): DanmakuTrack {
  if (!Value.Check(DanmakuTrackSchema, track))
    throw new DanmakuMatchInvalid("invalid danmaku track")
  assertSafeMetadata(track)
  if (!findDanmakuEpisode(track.episodeId)) throw new DanmakuMatchInvalid("episode is required")
  if (track.releaseId !== undefined && !findMediaRelease(track.releaseId)) {
    throw new DanmakuMatchInvalid("release is required")
  }
  if (track.activeRevisionId !== undefined) {
    const revision = findDanmakuRevision(track.activeRevisionId)
    if (
      !revision ||
      revision.trackId !== track.id ||
      revision.status !== "valid" ||
      !revision.contentHash ||
      !findDanmakuContent(revision.contentHash) ||
      isDanmakuRevisionBlocked(revision.id)
    ) {
      throw new DanmakuMatchInvalid("active revision is not on track")
    }
  }
  if (track.status === "disabled" && track.activeRevisionId !== undefined) {
    throw new DanmakuMatchInvalid("disabled track cannot have an active revision")
  }
  insertDanmakuTrack(track)
  return track
}

export function confirmReleaseEpisodeMatch(
  actorSeitoId: string,
  input: ReleaseEpisodeMatchInput,
  now = Date.now(),
): ReleaseEpisodeMatch {
  if (!findSeitoById(actorSeitoId)) throw new Forbidden("acting account does not exist")
  if (!Value.Check(ReleaseEpisodeMatchInputSchema, input)) {
    throw new DanmakuMatchInvalid("invalid release-to-episode match")
  }
  if (!findMediaRelease(input.releaseId) || !findDanmakuEpisode(input.episodeId)) {
    throw new DanmakuMatchInvalid("release and episode are required")
  }

  const match = materializeMatch(actorSeitoId, input, now)
  const normalized = authorizeMatch(actorSeitoId, match)
  if (normalized.trustScope === "global") {
    const existingGlobal = findGlobalReleaseEpisodeMatch(normalized.releaseId)
    if (existingGlobal && existingGlobal.episodeId !== normalized.episodeId) {
      throw new DanmakuMatchInvalid("release already has a different global episode")
    }
  }
  const existing = findExistingMatch(normalized)
  if (existing) return existing

  db.transaction(() => {
    insertReleaseEpisodeMatch(normalized)
    insertDanmakuAudit({
      id: newId(),
      action: normalized.trustScope === "global" ? "match_promoted" : "match_confirmed",
      actorSeitoId,
      subjectType: "release_episode_match",
      subjectId: normalized.id,
      details: { releaseId: normalized.releaseId, episodeId: normalized.episodeId },
      dedupeKey: `match:${normalized.trustScope}:${normalized.releaseId}:${normalized.episodeId}:${matchSubjectKey(normalized)}`,
      createdAt: now,
    })
  })()
  return normalized
}

export function submitDanmakuProposal(
  actorSeitoId: string,
  input: DanmakuProposalInput,
  now = Date.now(),
): DanmakuProposal {
  if (!findSeitoById(actorSeitoId)) throw new Forbidden("acting account does not exist")
  if (!findMediaRelease(input.releaseId)) throw new DanmakuMatchInvalid("release is required")
  if (input.targetEpisodeId !== undefined && !findDanmakuEpisode(input.targetEpisodeId)) {
    throw new DanmakuMatchInvalid("target episode is required")
  }
  if (input.targetEpisodeId === undefined && !input.suggestedTitle?.trim()) {
    throw new DanmakuMatchInvalid("proposal needs an episode or suggested title")
  }
  const safeEvidence = sanitizeEvidence(input.evidence)
  assertSafeMetadata({
    suggestedTitle: input.suggestedTitle,
    suggestedDescription: input.suggestedDescription,
  })
  const proposal: DanmakuProposal = {
    id: newId(),
    releaseId: input.releaseId,
    ...(input.targetEpisodeId === undefined ? {} : { targetEpisodeId: input.targetEpisodeId }),
    ...(input.suggestedTitle === undefined ? {} : { suggestedTitle: input.suggestedTitle.trim() }),
    ...(input.suggestedSeason === undefined ? {} : { suggestedSeason: input.suggestedSeason }),
    ...(input.suggestedEpisode === undefined ? {} : { suggestedEpisode: input.suggestedEpisode }),
    ...(input.suggestedDescription === undefined
      ? {}
      : { suggestedDescription: input.suggestedDescription.trim() }),
    evidence: safeEvidence,
    submitterSeitoId: actorSeitoId,
    status: "pending",
    createdAt: now,
  }
  if (!Value.Check(DanmakuProposalSchema, proposal)) {
    throw new DanmakuMatchInvalid("invalid danmaku proposal")
  }
  db.transaction(() => {
    insertDanmakuProposal(proposal)
    insertDanmakuAudit({
      id: newId(),
      action: "proposal_submitted",
      actorSeitoId,
      subjectType: "proposal",
      subjectId: proposal.id,
      details: { releaseId: proposal.releaseId },
      dedupeKey: `proposal-submitted:${proposal.id}`,
      createdAt: now,
    })
  })()
  return proposal
}

export function decideDanmakuProposal(
  actorSeitoId: string,
  proposalId: string,
  decision: DanmakuProposalDecision,
  now = Date.now(),
): DanmakuProposal {
  requireKomon(actorSeitoId)
  if (!Value.Check(DanmakuProposalDecisionSchema, decision)) {
    throw new DanmakuMatchInvalid("invalid proposal decision")
  }
  const disposition = decision.disposition?.trim()
  assertSafeMetadata(disposition)
  const proposal = requireProposal(proposalId)
  let targetEpisodeId = decisionTargetEpisode(proposal, decision)
  const expectedStatus = statusForDecision(decision.action)
  if (proposal.status !== "pending") {
    if (
      proposal.status === expectedStatus &&
      (decision.action === "reject" || proposal.targetEpisodeId === targetEpisodeId) &&
      (decision.action !== "merge" || proposal.mergeTargetEpisodeId === targetEpisodeId)
    ) {
      return proposal
    }
    throw new DanmakuMatchInvalid("proposal has already been decided")
  }

  if (targetEpisodeId !== undefined && !findDanmakuEpisode(targetEpisodeId)) {
    throw new DanmakuMatchInvalid("decision episode is required")
  }
  if (decision.action === "merge" && targetEpisodeId === undefined) {
    throw new DanmakuMatchInvalid("merge needs a target episode")
  }

  const createdEpisode =
    decision.action === "approve" && targetEpisodeId === undefined
      ? episodeFromProposal(proposal, now)
      : undefined
  if (createdEpisode) targetEpisodeId = createdEpisode.id

  const globalMatch =
    targetEpisodeId === undefined
      ? undefined
      : buildGlobalMatch(proposal, targetEpisodeId, actorSeitoId, now)
  const existingGlobal = findGlobalReleaseEpisodeMatch(proposal.releaseId)
  if (existingGlobal && globalMatch && existingGlobal.episodeId !== globalMatch.episodeId) {
    throw new DanmakuMatchInvalid("release already has a different global episode")
  }

  db.transaction(() => {
    if (createdEpisode) insertDanmakuEpisode(createdEpisode)
    if (globalMatch && !existingGlobal) insertReleaseEpisodeMatch(globalMatch)
    if (
      !decideDanmakuProposalRow(
        proposalId,
        actorSeitoId,
        expectedStatus,
        targetEpisodeId,
        decision.action === "merge" ? targetEpisodeId : undefined,
        disposition,
        now,
      )
    ) {
      throw new DanmakuMatchInvalid("proposal has already been decided")
    }
    insertDanmakuAudit({
      id: newId(),
      action: proposalDecisionAuditAction(decision.action),
      actorSeitoId,
      subjectType: "proposal",
      subjectId: proposalId,
      details: {
        ...(targetEpisodeId === undefined ? {} : { episodeId: targetEpisodeId }),
        ...(disposition === undefined ? {} : { disposition }),
      },
      dedupeKey: `proposal-decision:${proposalId}`,
      createdAt: now,
    })
    if (globalMatch && !existingGlobal) {
      insertDanmakuAudit({
        id: newId(),
        action: "match_promoted",
        actorSeitoId,
        subjectType: "release_episode_match",
        subjectId: globalMatch.id,
        details: { releaseId: globalMatch.releaseId, episodeId: globalMatch.episodeId },
        dedupeKey: `proposal-promotion:${proposalId}`,
        createdAt: now,
      })
    }
  })()
  return requireProposal(proposalId)
}

export function ingestDanmakuRevision(
  trackId: string,
  cues: readonly DanmakuCue[],
  provenance?: DanmakuRevision["provenance"],
  now = Date.now(),
): DanmakuRevisionIngestResult {
  const track = requireTrack(trackId)
  if (track.status === "disabled") {
    throw new DanmakuMatchInvalid("disabled track cannot receive revisions")
  }
  validateProvenance(provenance)
  const hashed = hashDanmakuCues(cues)
  const content: DanmakuContent = {
    contentHash: hashed.digest.value,
    algorithm: hashed.digest.algorithm,
    scope: hashed.digest.scope,
    canonicalJson: hashed.canonicalJson,
    byteLength: hashed.byteLength,
    createdAt: now,
  }
  const active = findActiveRevisionForTrack(trackId)
  const latest = active ?? findLatestRevisionForTrack(trackId)
  const sameContent = latest?.status === "valid" && latest.contentHash === content.contentHash
  if (sameContent && latest) {
    db.transaction(() => {
      insertDanmakuContent(content)
      if (track.activeRevisionId !== latest.id || track.status !== "active") {
        if (!setDanmakuTrackActiveRevision(trackId, latest.id, "active", now)) {
          throw new DanmakuMatchInvalid("track disappeared during revision activation")
        }
      }
      insertDanmakuAudit({
        id: newId(),
        action: "revision_reused",
        subjectType: "track",
        subjectId: trackId,
        details: {
          revisionId: latest.id,
          contentHash: content.contentHash,
          ...(provenance === undefined ? {} : { provenance }),
        },
        createdAt: now,
      })
    })()
    return { track: requireTrack(trackId), revision: latest, changed: false }
  }

  const blockedContent = listDanmakuRevisions(trackId).find(
    (revision) =>
      revision.status === "valid" &&
      revision.contentHash === content.contentHash &&
      isDanmakuRevisionBlocked(revision.id),
  )
  if (blockedContent) {
    throw new DanmakuMatchInvalid("danmaku content was blocked by Komon")
  }

  const revision: DanmakuRevision = {
    id: newId(),
    trackId,
    contentHash: content.contentHash,
    status: "valid",
    fetchedAt: now,
    pinned: false,
    createdAt: now,
    ...(provenance === undefined ? {} : { provenance }),
  }
  db.transaction(() => {
    insertDanmakuContent(content)
    insertDanmakuRevision(revision)
    if (!setDanmakuTrackActiveRevision(trackId, revision.id, "active", now)) {
      throw new DanmakuMatchInvalid("track disappeared during revision activation")
    }
    insertDanmakuAudit({
      id: newId(),
      action: "revision_activated",
      subjectType: "revision",
      subjectId: revision.id,
      details: { trackId, contentHash: content.contentHash },
      dedupeKey: `revision-activated:${revision.id}`,
      createdAt: now,
    })
  })()
  return { track: requireTrack(trackId), revision, changed: true }
}

export function recordDanmakuRefreshFailure(
  trackId: string,
  error: string,
  provenance?: DanmakuRevision["provenance"],
  now = Date.now(),
): DanmakuRevision {
  requireTrack(trackId)
  validateProvenance(provenance)
  const safeError = safeRefreshError(error)
  const revision: DanmakuRevision = {
    id: newId(),
    trackId,
    status: "failed",
    fetchedAt: now,
    error: safeError,
    pinned: false,
    createdAt: now,
    ...(provenance === undefined ? {} : { provenance }),
  }
  db.transaction(() => {
    insertDanmakuRevision(revision)
    insertDanmakuAudit({
      id: newId(),
      action: "revision_refresh_failed",
      subjectType: "track",
      subjectId: trackId,
      details: { revisionId: revision.id, error: safeError },
      dedupeKey: `revision-refresh-failed:${revision.id}`,
      createdAt: now,
    })
  })()
  return revision
}

export function disableDanmakuRevision(
  actorSeitoId: string,
  trackId: string,
  revisionId: string,
  reason?: string,
  now = Date.now(),
): DanmakuTrack {
  requireKomon(actorSeitoId)
  const track = requireTrack(trackId)
  const revision = requireRevision(revisionId)
  if (revision.trackId !== track.id) throw new DanmakuRevisionNotFound("revision is not on track")
  if (isDanmakuRevisionBlocked(revisionId)) return track
  const safeReason = reason === undefined ? undefined : safeRefreshError(reason)
  const wasActive = track.activeRevisionId === revisionId
  db.transaction(() => {
    blockDanmakuRevision(revisionId, actorSeitoId, safeReason, now)
    if (wasActive) {
      const fallback = findLatestRevisionForTrack(trackId)
      if (fallback) {
        if (!setDanmakuTrackActiveRevision(trackId, fallback.id, "active", now)) {
          throw new DanmakuMatchInvalid("track fallback failed")
        }
      } else if (!setDanmakuTrackActiveRevision(trackId, null, "disabled", now)) {
        throw new DanmakuMatchInvalid("track disable failed")
      }
    }
    insertDanmakuAudit({
      id: newId(),
      action: "revision_disabled",
      actorSeitoId,
      subjectType: "revision",
      subjectId: revisionId,
      details: { trackId, ...(safeReason === undefined ? {} : { reason: safeReason }) },
      dedupeKey: `revision-disabled:${revisionId}`,
      createdAt: now,
    })
  })()
  return requireTrack(trackId)
}

export function rollbackDanmakuRevision(
  actorSeitoId: string,
  trackId: string,
  revisionId: string,
  now = Date.now(),
): DanmakuTrack {
  requireKomon(actorSeitoId)
  const track = requireTrack(trackId)
  const revision = requireRevision(revisionId)
  if (revision.trackId !== track.id) throw new DanmakuRevisionNotFound("revision is not on track")
  if (revision.status !== "valid" || isDanmakuRevisionBlocked(revisionId)) {
    throw new DanmakuRevisionNotFound("revision is not valid")
  }
  if (!revision.contentHash || !findDanmakuContent(revision.contentHash)) {
    throw new DanmakuRevisionNotFound("revision content is not retained")
  }
  if (track.activeRevisionId === revisionId && track.status === "active") return track
  db.transaction(() => {
    if (!setDanmakuTrackActiveRevision(trackId, revisionId, "active", now)) {
      throw new DanmakuMatchInvalid("revision activation failed")
    }
    insertDanmakuAudit({
      id: newId(),
      action: "revision_rolled_back",
      actorSeitoId,
      subjectType: "track",
      subjectId: trackId,
      details: { revisionId },
      dedupeKey: `revision-rollback:${trackId}:${revisionId}:${now}`,
      createdAt: now,
    })
  })()
  return requireTrack(trackId)
}

export function pinDanmakuRevision(
  actorSeitoId: string,
  revisionId: string,
  pinned: boolean,
  now = Date.now(),
): DanmakuRevision {
  requireKomon(actorSeitoId)
  const revision = requireRevision(revisionId)
  if (revision.status !== "valid" || !revision.contentHash) {
    throw new DanmakuRevisionNotFound("only retained valid revisions can be pinned")
  }
  if (!findDanmakuContent(revision.contentHash)) {
    throw new DanmakuRevisionNotFound("revision content is not retained")
  }
  if (revision.pinned === pinned) return revision
  db.transaction(() => {
    setDanmakuRevisionPinned(revisionId, pinned)
    insertDanmakuAudit({
      id: newId(),
      action: pinned ? "revision_pinned" : "revision_unpinned",
      actorSeitoId,
      subjectType: "revision",
      subjectId: revisionId,
      details: { pinned },
      dedupeKey: `revision-pin:${revisionId}:${pinned}:${now}`,
      createdAt: now,
    })
  })()
  return requireRevision(revisionId)
}

export function collectDanmakuContent(
  actorSeitoId: string,
  graceMs: number | undefined,
  limit: number,
  now = Date.now(),
): DanmakuContent[] {
  requireKomon(actorSeitoId)
  if (graceMs === undefined) return []
  if (!Number.isFinite(graceMs) || graceMs < 0) throw new DanmakuPolicyInvalid("invalid GC grace")
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    throw new DanmakuPolicyInvalid("invalid GC limit")
  }
  const collectable = listCollectableDanmakuContent(now - graceMs, limit)
  db.transaction(() => {
    for (const content of collectable) {
      const deleted = deleteDanmakuContent(content.contentHash)
      if (deleted) {
        insertDanmakuAudit({
          id: newId(),
          action: "content_collected",
          actorSeitoId,
          subjectType: "content",
          subjectId: content.contentHash,
          details: { contentHash: content.contentHash },
          dedupeKey: `content-collected:${content.contentHash}`,
          createdAt: now,
        })
      }
    }
  })()
  return collectable.filter((content) => findDanmakuContent(content.contentHash) === null)
}

export function updateDanmakuSourcePolicy(
  actorSeitoId: string,
  policy: Omit<DanmakuSourcePolicy, "updatedAt" | "updatedBy">,
  now = Date.now(),
): DanmakuSourcePolicy {
  requireKomon(actorSeitoId)
  const next: DanmakuSourcePolicy = { ...policy, updatedAt: now, updatedBy: actorSeitoId }
  if (!Value.Check(DanmakuSourcePolicySchema, next)) {
    throw new DanmakuPolicyInvalid("invalid danmaku source policy")
  }
  const allowed = new Set(next.allowedClasses)
  if (
    new Set(next.allowedClasses).size !== next.allowedClasses.length ||
    new Set(next.order).size !== next.order.length ||
    next.order.some((sourceClass) => !allowed.has(sourceClass))
  ) {
    throw new DanmakuPolicyInvalid("source policy must have unique allowed order")
  }
  db.transaction(() => {
    setDanmakuSourcePolicy(next)
    insertDanmakuAudit({
      id: newId(),
      action: "source_policy_updated",
      actorSeitoId,
      subjectType: "source_policy",
      subjectId: "1",
      details: { allowedClasses: next.allowedClasses, order: next.order },
      createdAt: now,
    })
  })()
  return next
}

function authorizeMatch(actorSeitoId: string, match: ReleaseEpisodeMatch): ReleaseEpisodeMatch {
  if (match.trustScope === "global") {
    if (!isKomon(actorSeitoId)) throw new Forbidden("only Komon may promote global matches")
    if (match.reviewerSeitoId !== undefined && match.reviewerSeitoId !== actorSeitoId) {
      throw new DanmakuMatchInvalid("global reviewer must be the acting Komon")
    }
    return { ...match, reviewerSeitoId: actorSeitoId, confidence: "confirmed" }
  }
  if (match.trustScope === "personal") {
    if (
      !("seitoId" in match) ||
      match.seitoId !== actorSeitoId ||
      ("bushitsuId" in match && match.bushitsuId) ||
      ("enmokuId" in match && match.enmokuId) ||
      ("reviewerSeitoId" in match && match.reviewerSeitoId)
    ) {
      throw new Forbidden("personal match belongs to the acting viewer")
    }
    return match
  }
  if (!match.bushitsuId) throw new DanmakuMatchInvalid("room match needs a room")
  const room = fetchBushitsu(match.bushitsuId)
  if (room.buchouId !== actorSeitoId)
    throw new Forbidden("only the room owner may confirm a room match")
  if (
    ("seitoId" in match && match.seitoId) ||
    ("reviewerSeitoId" in match && match.reviewerSeitoId)
  ) {
    throw new DanmakuMatchInvalid("room match has an invalid subject")
  }
  if (
    match.enmokuId &&
    !fetchBangumi(match.bushitsuId).some((item) => item.id === match.enmokuId)
  ) {
    throw new DanmakuMatchInvalid("Enmoku does not belong to the room")
  }
  return match
}

function materializeMatch(
  actorSeitoId: string,
  input: ReleaseEpisodeMatchInput,
  createdAt: number,
): ReleaseEpisodeMatch {
  assertSafeMetadata(input)
  const common = {
    id: newId(),
    releaseId: input.releaseId,
    episodeId: input.episodeId,
    confidence: "confirmed" as const,
    evidence: input.evidence,
    createdAt,
  }
  if (input.trustScope === "personal") {
    return { ...common, trustScope: "personal", seitoId: actorSeitoId }
  }
  if (input.trustScope === "room") {
    return {
      ...common,
      trustScope: "room",
      bushitsuId: input.bushitsuId,
      ...(input.enmokuId === undefined ? {} : { enmokuId: input.enmokuId }),
    }
  }
  return { ...common, trustScope: "global", reviewerSeitoId: actorSeitoId }
}

function findExistingMatch(match: ReleaseEpisodeMatch): ReleaseEpisodeMatch | null {
  if (match.trustScope === "global") {
    const global = findGlobalReleaseEpisodeMatch(match.releaseId)
    return global?.episodeId === match.episodeId ? global : null
  }
  return (
    listReleaseEpisodeMatches(match.releaseId).find(
      (existing) =>
        existing.trustScope === match.trustScope &&
        existing.episodeId === match.episodeId &&
        optionalMatchSubject(existing, "seitoId") === optionalMatchSubject(match, "seitoId") &&
        optionalMatchSubject(existing, "bushitsuId") ===
          optionalMatchSubject(match, "bushitsuId") &&
        optionalMatchSubject(existing, "enmokuId") === optionalMatchSubject(match, "enmokuId"),
    ) ?? null
  )
}

function matchSubjectKey(match: ReleaseEpisodeMatch): string {
  return [
    optionalMatchSubject(match, "seitoId") ?? "",
    optionalMatchSubject(match, "bushitsuId") ?? "",
    optionalMatchSubject(match, "enmokuId") ?? "",
  ].join(":")
}

function optionalMatchSubject(
  match: ReleaseEpisodeMatch,
  key: "seitoId" | "bushitsuId" | "enmokuId",
): string | undefined {
  if (key === "seitoId") return "seitoId" in match ? match.seitoId : undefined
  if (key === "bushitsuId") return "bushitsuId" in match ? match.bushitsuId : undefined
  return "enmokuId" in match ? match.enmokuId : undefined
}

function statusForDecision(action: DanmakuProposalDecision["action"]): DanmakuProposal["status"] {
  if (action === "approve") return "approved"
  if (action === "reject") return "rejected"
  return "merged"
}

function proposalDecisionAuditAction(action: DanmakuProposalDecision["action"]): string {
  if (action === "approve") return "proposal_approved"
  if (action === "reject") return "proposal_rejected"
  return "proposal_merged"
}

function decisionTargetEpisode(
  proposal: DanmakuProposal,
  decision: DanmakuProposalDecision,
): string | undefined {
  if (decision.action === "reject") {
    if (decision.episodeId !== undefined) {
      throw new DanmakuMatchInvalid("rejected proposal cannot select an episode")
    }
    return undefined
  }
  if (decision.episodeId !== undefined) return decision.episodeId
  return proposal.targetEpisodeId
}

function buildGlobalMatch(
  proposal: DanmakuProposal,
  episodeId: string,
  reviewerSeitoId: string,
  createdAt: number,
): ReleaseEpisodeMatch {
  return {
    id: newId(),
    releaseId: proposal.releaseId,
    episodeId,
    trustScope: "global",
    reviewerSeitoId,
    confidence: "confirmed",
    evidence: proposal.evidence,
    createdAt,
  }
}

function episodeFromProposal(proposal: DanmakuProposal, now: number): DanmakuEpisode {
  if (!proposal.suggestedTitle?.trim()) {
    throw new DanmakuMatchInvalid("approved proposal has no episode")
  }
  const episode: DanmakuEpisode = {
    id: newId(),
    title: proposal.suggestedTitle.trim(),
    ...(proposal.suggestedSeason === undefined ? {} : { season: proposal.suggestedSeason }),
    ...(proposal.suggestedEpisode === undefined ? {} : { episode: proposal.suggestedEpisode }),
    ...(proposal.suggestedDescription === undefined
      ? {}
      : { description: proposal.suggestedDescription }),
    createdAt: now,
    updatedAt: now,
  }
  if (!Value.Check(DanmakuEpisodeSchema, episode)) {
    throw new DanmakuMatchInvalid("approved proposal has invalid episode details")
  }
  return episode
}

function findActiveRevisionForTrack(trackId: string): DanmakuRevision | null {
  return findActiveDanmakuRevision(trackId)
}

function findLatestRevisionForTrack(trackId: string): DanmakuRevision | null {
  return findLatestValidDanmakuRevision(trackId)
}

function hashDanmakuCues(cues: readonly DanmakuCue[]): ReturnType<typeof hashCanonicalDanmakuCues> {
  try {
    return hashCanonicalDanmakuCues(cues)
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid danmaku cues"
    throw new DanmakuMatchInvalid(message)
  }
}

function validateProvenance(provenance: DanmakuRevision["provenance"]): void {
  if (provenance === undefined) return
  if (!Value.Check(DanmakuProvenanceSchema, provenance)) {
    throw new DanmakuMatchInvalid("invalid danmaku provenance")
  }
  assertSafeMetadata(provenance)
}

function sanitizeEvidence(value: unknown): DanmakuEvidence[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) {
    throw new DanmakuMatchInvalid("proposal evidence is invalid")
  }
  const result: DanmakuEvidence[] = []
  for (const item of value) {
    if (!isDanmakuEvidence(item)) throw new DanmakuMatchInvalid("proposal evidence is invalid")
    assertSafeMetadata(item)
    result.push(item)
  }
  return result
}

function isDanmakuEvidence(value: unknown): value is DanmakuEvidence {
  return Value.Check(DanmakuEvidenceSchema, value)
}

function safeRefreshError(value: string): string {
  const normalized = value
    .trim()
    .replace(/https?:\/\/\S+/gi, "[upstream]")
    .replace(SENSITIVE_FIELD_PATTERN, "[redacted]")
  return normalized.slice(0, 500) || "refresh failed"
}

function assertSafeMetadata(value: unknown): void {
  let serialized: string
  try {
    serialized = JSON.stringify(value) ?? ""
  } catch {
    throw new DanmakuMatchInvalid("metadata is not serializable")
  }
  if (
    SENSITIVE_FIELD_KEY_PATTERN.test(serialized) ||
    /(?:file:\/\/|[A-Za-z]:[\\/]|["']\/(?:home|root|tmp|mnt|Users)(?:[\\/]|["']))/i.test(serialized)
  ) {
    throw new DanmakuMatchInvalid("private provider material is not accepted")
  }
}

const SENSITIVE_FIELD_KEY = String.raw`(?:fsid|dlink|access[_-]?token|refresh[_-]?token|authorization|cookie|password|secret|private[_-]?key)`
const SENSITIVE_FIELD_KEY_PATTERN = new RegExp(
  String.raw`(?:\\?["']?\s*)${SENSITIVE_FIELD_KEY}(?:\\?["']?\s*)[:=]`,
  "i",
)
const SENSITIVE_FIELD_PATTERN = new RegExp(
  String.raw`(?:\\?["']?\s*)${SENSITIVE_FIELD_KEY}(?:\\?["']?\s*)[:=]\s*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,}]+)`,
  "gi",
)

function assertSafeRelease(release: MediaRelease): void {
  assertSafeMetadata(release)
  if (release.fileName && /[\\/]/.test(release.fileName)) {
    throw new DanmakuMatchInvalid("media release file name must not contain a path")
  }
}

function mediaReleaseForEnmoku(enmoku: Enmoku): MediaRelease | null {
  const legacyRef = safeLegacyDanmakuRef(enmoku.danmaku)
  if (legacyRef) {
    const separator = legacyRef.indexOf(":")
    const provider = legacyRef.slice(0, separator)
    const reference = legacyRef.slice(separator + 1)
    return (
      findMediaReleaseByProvider(provider, legacyRef) ??
      findMediaReleaseByProvider(provider, reference)
    )
  }
  const provider = enmoku.provider
  if (!provider) return null
  const reference = provider.kind === "baidu" ? provider.sourceId : provider.url
  return findMediaReleaseByProvider(provider.kind, reference)
}

function visibleReleaseMatches(
  releaseId: string,
  bushitsuId: string,
  enmokuId: string,
  actorSeitoId: string,
): ReleaseEpisodeMatch[] {
  return listReleaseEpisodeMatches(releaseId).filter((match) => {
    if (match.trustScope === "global") return true
    if (match.trustScope === "personal") return match.seitoId === actorSeitoId
    return (
      match.bushitsuId === bushitsuId &&
      (match.enmokuId === undefined || match.enmokuId === enmokuId)
    )
  })
}

function candidateFromTrack(
  track: DanmakuTrack,
  policy: DanmakuSourcePolicy,
  evidence: DanmakuEvidence[] | undefined,
  releaseIdForAlignment?: string,
): DanmakuCandidate {
  const activeRevision = track.status === "active" ? findActiveDanmakuRevision(track.id) : null
  const latestRevision = listDanmakuRevisions(track.id)[0]
  const alignmentReleaseId = track.releaseId ?? releaseIdForAlignment
  const allowed = policy.allowedClasses.includes(track.sourceClass)
  let availability: DanmakuCandidateAvailability
  let reason: string | undefined
  if (!allowed) {
    availability = "disabled"
    reason = "source class is disabled by deployment policy"
  } else if (track.status === "disabled") {
    availability = "disabled"
    reason = "track is disabled"
  } else if (!activeRevision) {
    availability = latestRevision?.status === "failed" ? "failed" : "unavailable"
    reason = latestRevision?.status === "failed" ? "latest revision failed" : "no valid revision"
  } else {
    availability = "available"
  }

  const candidate: DanmakuCandidate = {
    id: track.id,
    sourceClass: track.sourceClass,
    name: track.name,
    ...(track.provenance === undefined ? {} : { provenance: track.provenance }),
    ...(evidence === undefined ? {} : { evidence }),
    ...(evidence === undefined ? {} : { confidence: "confirmed" as const }),
    ...(track.releaseId === undefined ? {} : { releaseId: track.releaseId }),
    ...(track.episodeId === undefined ? {} : { episodeId: track.episodeId }),
    trackId: track.id,
    ...(activeRevision === null ? {} : { revisionId: activeRevision.id }),
    ...(activeRevision && alignmentReleaseId
      ? (() => {
          const alignment = findDanmakuAlignment(alignmentReleaseId, track.id)
          return alignment === null ? {} : { alignment }
        })()
      : {}),
    availability,
    ...(reason === undefined ? {} : { reason }),
  }

  if (
    availability === "available" &&
    activeRevision?.status === "valid" &&
    activeRevision.contentHash
  ) {
    const content = findDanmakuContent(activeRevision.contentHash)
    const cues = content ? parseStoredCues(content.canonicalJson) : undefined
    if (cues) {
      candidate.cues = cues
    } else {
      candidate.availability = "unavailable"
      candidate.reason = "stored cue content is invalid"
      candidate.revisionId = undefined
    }
  }

  return candidate
}

function parseStoredCues(value: string): DanmakuCue[] | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((cue) => Value.Check(DanmakuCueSchema, cue))
      ? parsed
      : undefined
  } catch {
    return undefined
  }
}

function compareCandidates(
  left: DanmakuCandidate,
  right: DanmakuCandidate,
  policy: DanmakuSourcePolicy,
): number {
  const leftRank = policy.order.indexOf(left.sourceClass)
  const rightRank = policy.order.indexOf(right.sourceClass)
  const normalizedLeftRank = leftRank === -1 ? policy.order.length : leftRank
  const normalizedRightRank = rightRank === -1 ? policy.order.length : rightRank
  return (
    normalizedLeftRank - normalizedRightRank ||
    left.sourceClass.localeCompare(right.sourceClass) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  )
}

function defaultEntry(
  record: {
    enmokuId: string
    trackId: string
    updatedAt: number
  },
  policy: DanmakuSourcePolicy,
): DanmakuDefault {
  const track = findDanmakuTrack(record.trackId)
  const candidate = track ? candidateFromTrack(track, policy, undefined) : null
  const result: DanmakuDefault = {
    enmokuId: record.enmokuId,
    trackId: record.trackId,
    revisionId: candidate?.revisionId ?? null,
    ...(candidate?.sourceClass === undefined ? {} : { sourceClass: candidate.sourceClass }),
    ...(candidate?.name === undefined ? {} : { name: candidate.name }),
    availability: candidate?.availability ?? "unavailable",
    updatedAt: record.updatedAt,
  }
  if (!Value.Check(DanmakuDefaultSchema, result)) {
    throw new DanmakuMatchInvalid("invalid stored danmaku default")
  }
  return result
}

function safeLegacyDanmakuRef(danmaku: Enmoku["danmaku"] | undefined): string | undefined {
  if (!danmaku || danmaku.type !== "fetch") return undefined
  const ref = danmaku.ref.trim()
  if (
    !/^[a-z][a-z0-9+.-]{0,63}:[^\s]{1,512}$/i.test(ref) ||
    /(?:file:\/\/|(?:^|[/:])(?:home|root|tmp|mnt|users)(?:[/:]|$))/i.test(ref)
  ) {
    return undefined
  }
  return ref
}

function authorizeRoomOwner(actorSeitoId: string, bushitsuId: string): void {
  const room = fetchBushitsu(bushitsuId)
  if (!isPresent(bushitsuId, actorSeitoId)) {
    throw new Forbidden("room admission is required")
  }
  if (room.buchouId !== actorSeitoId) {
    throw new Forbidden("only the room owner may set the danmaku default")
  }
}
