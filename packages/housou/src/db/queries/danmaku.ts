import { Value } from "@sinclair/typebox/value"
import {
  DanmakuConfidenceTierSchema,
  DanmakuEvidenceSchema,
  DanmakuProvenanceSchema,
  DanmakuSourceClassSchema,
  DanmakuTrackStatusSchema,
  DanmakuTrustScopeSchema,
} from "houkago-kousoku"
import type {
  DanmakuAlignment,
  DanmakuConfidenceTier,
  DanmakuContent,
  DanmakuEpisode,
  DanmakuEvidence,
  DanmakuProposal,
  DanmakuProvenance,
  DanmakuRevision,
  DanmakuRevisionStatus,
  DanmakuSourceClass,
  DanmakuSourcePolicy,
  DanmakuTrack,
  DanmakuTrackStatus,
  DanmakuTrustScope,
  MediaRelease,
  ReleaseEpisodeMatch,
} from "houkago-kousoku"
import {
  DanmakuContentHashCollision,
  DanmakuEpisodeNotFound,
  DanmakuMatchInvalid,
  DanmakuProposalNotFound,
  DanmakuReleaseNotFound,
  DanmakuRevisionNotFound,
  DanmakuTrackNotFound,
} from "../../lib/errors"
import { db } from "../client"

type EpisodeRow = {
  id: string
  title: string
  season: number | null
  episode: number | null
  episode_title: string | null
  description: string | null
  created_at: number
  updated_at: number
}

type ReleaseRow = {
  id: string
  provider: string | null
  provider_reference: string | null
  file_name: string | null
  size: number | null
  duration: number | null
  created_at: number
}

type EvidenceRow = {
  id: string
  release_id: string
  kind: string
  algorithm: string | null
  scope: string | null
  digest_value: string | null
  evidence_json: string
  created_at: number
}

type MatchRow = {
  id: string
  release_id: string
  episode_id: string
  trust_scope: string
  seito_id: string | null
  bushitsu_id: string | null
  enmoku_id: string | null
  reviewer_seito_id: string | null
  confidence: string
  evidence_json: string
  created_at: number
}

type TrackRow = {
  id: string
  episode_id: string
  release_id: string | null
  source_class: string
  name: string
  provenance_json: string | null
  status: string
  active_revision_id: string | null
  created_at: number
  updated_at: number
}

type ContentRow = {
  content_hash: string
  algorithm: string
  scope: string
  canonical_json: string
  byte_length: number
  created_at: number
}

type RevisionRow = {
  id: string
  track_id: string
  content_hash: string | null
  status: string
  fetched_at: number
  error: string | null
  provenance_json: string | null
  pinned: number
  created_at: number
}

type AlignmentRow = {
  id: string
  release_id: string
  track_id: string
  offset_seconds: number
  trim_start_seconds: number | null
  trim_end_seconds: number | null
  created_by: string | null
  created_at: number
}

type ProposalRow = {
  id: string
  release_id: string
  target_episode_id: string | null
  suggested_title: string | null
  suggested_season: number | null
  suggested_episode: number | null
  suggested_description: string | null
  evidence_json: string
  submitter_seito_id: string
  reviewer_seito_id: string | null
  status: string
  merge_target_episode_id: string | null
  disposition: string | null
  created_at: number
  decided_at: number | null
}

type PolicyRow = {
  allowed_json: string
  order_json: string
  updated_at: number
  updated_by: string | null
}

export type DanmakuDefaultRecord = {
  enmokuId: string
  bushitsuId: string
  trackId: string
  createdAt: number
  updatedAt: number
}

type DefaultRow = {
  enmoku_id: string
  bushitsu_id: string
  track_id: string
  created_at: number
  updated_at: number
}

const episodeColumns =
  "id, title, season, episode, episode_title, description, created_at, updated_at"
const releaseColumns = "id, provider, provider_reference, file_name, size, duration, created_at"
const matchColumns =
  "id, release_id, episode_id, trust_scope, seito_id, bushitsu_id, enmoku_id, reviewer_seito_id, confidence, evidence_json, created_at"
const trackColumns =
  "id, episode_id, release_id, source_class, name, provenance_json, status, active_revision_id, created_at, updated_at"
const contentColumns = "content_hash, algorithm, scope, canonical_json, byte_length, created_at"
const revisionColumns =
  "id, track_id, content_hash, status, fetched_at, error, provenance_json, pinned, created_at"
const qualifiedRevisionColumns =
  "r.id, r.track_id, r.content_hash, r.status, r.fetched_at, r.error, r.provenance_json, r.pinned, r.created_at"
const alignmentColumns =
  "id, release_id, track_id, offset_seconds, trim_start_seconds, trim_end_seconds, created_by, created_at"
const proposalColumns =
  "id, release_id, target_episode_id, suggested_title, suggested_season, suggested_episode, suggested_description, evidence_json, submitter_seito_id, reviewer_seito_id, status, merge_target_episode_id, disposition, created_at, decided_at"

const insertEpisodeStmt = db.query(
  `INSERT INTO danmaku_episode
     (id, title, season, episode, episode_title, description, created_at, updated_at)
   VALUES ($id, $title, $season, $episode, $episodeTitle, $description, $createdAt, $updatedAt)`,
)
const episodeByIdStmt = db.query<EpisodeRow, { $id: string }>(
  `SELECT ${episodeColumns} FROM danmaku_episode WHERE id = $id`,
)
const episodeSearchStmt = db.query<EpisodeRow, { $query: string }>(
  `SELECT ${episodeColumns} FROM danmaku_episode
   WHERE $query = '' OR lower(title) LIKE '%' || lower($query) || '%'
   ORDER BY lower(title) ASC, season ASC NULLS FIRST, episode ASC NULLS FIRST, id ASC
   LIMIT 100`,
)

const insertReleaseStmt = db.query(
  `INSERT INTO media_release
     (id, provider, provider_reference, file_name, size, duration, created_at)
   VALUES ($id, $provider, $providerReference, $fileName, $size, $duration, $createdAt)`,
)
const releaseByIdStmt = db.query<ReleaseRow, { $id: string }>(
  `SELECT ${releaseColumns} FROM media_release WHERE id = $id`,
)
const releaseByProviderStmt = db.query<ReleaseRow, { $provider: string; $reference: string }>(
  `SELECT ${releaseColumns} FROM media_release
   WHERE provider = $provider AND provider_reference = $reference
   ORDER BY created_at DESC, id DESC LIMIT 1`,
)

const insertEvidenceStmt = db.query(
  `INSERT INTO media_release_evidence
     (id, release_id, kind, algorithm, scope, digest_value, evidence_json, created_at)
   VALUES ($id, $releaseId, $kind, $algorithm, $scope, $digestValue, $evidenceJson, $createdAt)`,
)
const evidenceByReleaseStmt = db.query<EvidenceRow, { $releaseId: string }>(
  `SELECT id, release_id, kind, algorithm, scope, digest_value, evidence_json, created_at
   FROM media_release_evidence
   WHERE release_id = $releaseId
   ORDER BY created_at ASC, id ASC`,
)
const evidenceByDigestStmt = db.query<
  EvidenceRow,
  { $algorithm: string; $scope: string; $digestValue: string }
>(
  `SELECT id, release_id, kind, algorithm, scope, digest_value, evidence_json, created_at
   FROM media_release_evidence
   WHERE algorithm = $algorithm AND scope = $scope AND digest_value = $digestValue
   ORDER BY created_at ASC, id ASC`,
)

const insertMatchStmt = db.query(
  `INSERT INTO release_episode_match
     (id, release_id, episode_id, trust_scope, seito_id, bushitsu_id, enmoku_id,
      reviewer_seito_id, confidence, evidence_json, created_at)
   VALUES ($id, $releaseId, $episodeId, $trustScope, $seitoId, $bushitsuId, $enmokuId,
      $reviewerSeitoId, $confidence, $evidenceJson, $createdAt)`,
)
const matchByIdStmt = db.query<MatchRow, { $id: string }>(
  `SELECT ${matchColumns} FROM release_episode_match WHERE id = $id`,
)
const matchesByReleaseStmt = db.query<MatchRow, { $releaseId: string }>(
  `SELECT ${matchColumns} FROM release_episode_match
   WHERE release_id = $releaseId ORDER BY created_at ASC, id ASC`,
)
const globalMatchByReleaseStmt = db.query<MatchRow, { $releaseId: string }>(
  `SELECT ${matchColumns} FROM release_episode_match
   WHERE release_id = $releaseId AND trust_scope = 'global'
   ORDER BY created_at DESC, id DESC LIMIT 1`,
)

const insertTrackStmt = db.query(
  `INSERT INTO danmaku_track
     (id, episode_id, release_id, source_class, name, provenance_json, status,
      active_revision_id, created_at, updated_at)
   VALUES ($id, $episodeId, $releaseId, $sourceClass, $name, $provenanceJson,
      $status, $activeRevisionId, $createdAt, $updatedAt)`,
)
const trackByIdStmt = db.query<TrackRow, { $id: string }>(
  `SELECT ${trackColumns} FROM danmaku_track WHERE id = $id`,
)
const tracksByEpisodeStmt = db.query<TrackRow, { $episodeId: string }>(
  `SELECT ${trackColumns} FROM danmaku_track
   WHERE episode_id = $episodeId ORDER BY source_class ASC, created_at ASC, id ASC`,
)
const trackByReleaseEpisodeStmt = db.query<
  TrackRow,
  { $releaseId: string; $episodeId: string; $sourceClass: string }
>(
  `SELECT ${trackColumns} FROM danmaku_track
   WHERE release_id = $releaseId
     AND episode_id = $episodeId
     AND source_class = $sourceClass
   ORDER BY created_at ASC, id ASC LIMIT 1`,
)
const updateTrackActiveStmt = db.query(
  `UPDATE danmaku_track SET active_revision_id = $revisionId, status = $status,
      updated_at = $updatedAt
   WHERE id = $trackId
     AND (
       $revisionId IS NULL
       OR EXISTS (
         SELECT 1
         FROM danmaku_revision r
         WHERE r.id = $revisionId
           AND r.track_id = $trackId
           AND r.status = 'valid'
           AND EXISTS (
             SELECT 1 FROM danmaku_content c WHERE c.content_hash = r.content_hash
           )
           AND NOT EXISTS (
             SELECT 1 FROM danmaku_revision_block b WHERE b.revision_id = r.id
           )
       )
     )`,
)
const updateTrackStatusStmt = db.query(
  "UPDATE danmaku_track SET status = $status, updated_at = $updatedAt WHERE id = $trackId",
)

const contentByHashStmt = db.query<ContentRow, { $contentHash: string }>(
  `SELECT ${contentColumns} FROM danmaku_content WHERE content_hash = $contentHash`,
)
const insertContentStmt = db.query(
  `INSERT INTO danmaku_content
     (content_hash, algorithm, scope, canonical_json, byte_length, created_at)
   VALUES ($contentHash, $algorithm, $scope, $canonicalJson, $byteLength, $createdAt)`,
)
const collectableContentStmt = db.query<ContentRow, { $cutoff: number; $limit: number }>(
  `SELECT ${contentColumns}
   FROM danmaku_content c
   WHERE c.created_at <= $cutoff
     AND NOT EXISTS (
       SELECT 1
       FROM danmaku_revision r
       JOIN danmaku_track t ON t.id = r.track_id
       WHERE r.content_hash = c.content_hash
         AND r.id = t.active_revision_id
         AND t.status = 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM danmaku_revision r
       WHERE r.content_hash = c.content_hash AND r.pinned = 1
     )
   ORDER BY c.created_at ASC, c.content_hash ASC
   LIMIT $limit`,
)
const deleteContentStmt = db.query("DELETE FROM danmaku_content WHERE content_hash = $contentHash")

const insertRevisionStmt = db.query(
  `INSERT INTO danmaku_revision
     (id, track_id, content_hash, status, fetched_at, error, provenance_json, pinned, created_at)
   VALUES ($id, $trackId, $contentHash, $status, $fetchedAt, $error, $provenanceJson, $pinned, $createdAt)`,
)
const revisionByIdStmt = db.query<RevisionRow, { $id: string }>(
  `SELECT ${revisionColumns} FROM danmaku_revision WHERE id = $id`,
)
const revisionsByTrackStmt = db.query<RevisionRow, { $trackId: string }>(
  `SELECT ${revisionColumns} FROM danmaku_revision
   WHERE track_id = $trackId ORDER BY fetched_at DESC, id DESC`,
)
const latestValidRevisionStmt = db.query<RevisionRow, { $trackId: string }>(
  `SELECT ${revisionColumns} FROM danmaku_revision r
   WHERE r.track_id = $trackId AND r.status = 'valid'
     AND EXISTS (
       SELECT 1 FROM danmaku_content c WHERE c.content_hash = r.content_hash
     )
     AND NOT EXISTS (
       SELECT 1 FROM danmaku_revision_block b WHERE b.revision_id = r.id
     )
   ORDER BY r.fetched_at DESC, r.id DESC LIMIT 1`,
)
const activeRevisionStmt = db.query<RevisionRow, { $trackId: string }>(
  `SELECT ${qualifiedRevisionColumns} FROM danmaku_revision r
   JOIN danmaku_track t ON t.active_revision_id = r.id
   WHERE t.id = $trackId AND r.status = 'valid'
     AND EXISTS (
       SELECT 1 FROM danmaku_content c WHERE c.content_hash = r.content_hash
     )
     AND NOT EXISTS (SELECT 1 FROM danmaku_revision_block b WHERE b.revision_id = r.id)`,
)
const pinRevisionStmt = db.query(
  "UPDATE danmaku_revision SET pinned = $pinned WHERE id = $revisionId",
)
const blockRevisionStmt = db.query(
  `INSERT INTO danmaku_revision_block (revision_id, blocked_at, blocked_by, reason)
   VALUES ($revisionId, $blockedAt, $blockedBy, $reason)
   ON CONFLICT(revision_id) DO UPDATE SET blocked_at = excluded.blocked_at,
     blocked_by = excluded.blocked_by, reason = excluded.reason`,
)
const unblockRevisionStmt = db.query(
  "DELETE FROM danmaku_revision_block WHERE revision_id = $revisionId",
)
const revisionBlockedStmt = db.query<{ revision_id: string }, { $revisionId: string }>(
  "SELECT revision_id FROM danmaku_revision_block WHERE revision_id = $revisionId",
)

const upsertAlignmentStmt = db.query(
  `INSERT INTO danmaku_alignment
     (id, release_id, track_id, offset_seconds, trim_start_seconds, trim_end_seconds, created_by, created_at)
   VALUES ($id, $releaseId, $trackId, $offsetSeconds, $trimStartSeconds, $trimEndSeconds, $createdBy, $createdAt)
   ON CONFLICT(release_id, track_id) DO UPDATE SET
     offset_seconds = excluded.offset_seconds,
     trim_start_seconds = excluded.trim_start_seconds,
     trim_end_seconds = excluded.trim_end_seconds,
     created_by = excluded.created_by,
     created_at = excluded.created_at`,
)
const alignmentByReleaseTrackStmt = db.query<
  AlignmentRow,
  { $releaseId: string; $trackId: string }
>(
  `SELECT ${alignmentColumns} FROM danmaku_alignment
   WHERE release_id = $releaseId AND track_id = $trackId`,
)

const insertProposalStmt = db.query(
  `INSERT INTO danmaku_proposal
     (id, release_id, target_episode_id, suggested_title, suggested_season, suggested_episode,
      suggested_description, evidence_json, submitter_seito_id, reviewer_seito_id, status,
      merge_target_episode_id, disposition, created_at, decided_at)
   VALUES ($id, $releaseId, $targetEpisodeId, $suggestedTitle, $suggestedSeason, $suggestedEpisode,
      $suggestedDescription, $evidenceJson, $submitterSeitoId, NULL, $status,
      NULL, NULL, $createdAt, NULL)`,
)
const proposalByIdStmt = db.query<ProposalRow, { $id: string }>(
  `SELECT ${proposalColumns} FROM danmaku_proposal WHERE id = $id`,
)
const proposalsStmt = db.query<ProposalRow, { $status: string | null }>(
  `SELECT ${proposalColumns} FROM danmaku_proposal
   WHERE $status IS NULL OR status = $status ORDER BY created_at ASC, id ASC`,
)
const decideProposalStmt = db.query(
  `UPDATE danmaku_proposal
   SET reviewer_seito_id = $reviewerSeitoId, status = $status,
       target_episode_id = COALESCE($targetEpisodeId, target_episode_id),
       merge_target_episode_id = $mergeTargetEpisodeId, disposition = $disposition,
       decided_at = $decidedAt
   WHERE id = $id AND status = 'pending'`,
)

const policyStmt = db.query<PolicyRow, []>(
  "SELECT allowed_json, order_json, updated_at, updated_by FROM danmaku_source_policy WHERE id = 1",
)
const updatePolicyStmt = db.query(
  `UPDATE danmaku_source_policy SET allowed_json = $allowedJson, order_json = $orderJson,
     updated_at = $updatedAt, updated_by = $updatedBy WHERE id = 1`,
)

const defaultByEnmokuStmt = db.query<DefaultRow, { $enmokuId: string }>(
  `SELECT enmoku_id, bushitsu_id, track_id, created_at, updated_at
   FROM enmoku_danmaku_default WHERE enmoku_id = $enmokuId`,
)
const upsertDefaultStmt = db.query(
  `INSERT INTO enmoku_danmaku_default
     (enmoku_id, bushitsu_id, track_id, created_at, updated_at)
   VALUES ($enmokuId, $bushitsuId, $trackId, $createdAt, $updatedAt)
   ON CONFLICT(enmoku_id) DO UPDATE SET bushitsu_id = excluded.bushitsu_id,
     track_id = excluded.track_id, updated_at = excluded.updated_at`,
)
const deleteDefaultStmt = db.query("DELETE FROM enmoku_danmaku_default WHERE enmoku_id = $enmokuId")

export function insertDanmakuEpisode(episode: DanmakuEpisode): void {
  insertEpisodeStmt.run({
    $id: episode.id,
    $title: episode.title,
    $season: episode.season ?? null,
    $episode: episode.episode ?? null,
    $episodeTitle: episode.episodeTitle ?? null,
    $description: episode.description ?? null,
    $createdAt: episode.createdAt,
    $updatedAt: episode.updatedAt,
  })
}

export function findDanmakuEpisode(id: string): DanmakuEpisode | null {
  const row = episodeByIdStmt.get({ $id: id })
  return row ? episodeDomain(row) : null
}

export function searchDanmakuEpisodes(query: string): DanmakuEpisode[] {
  return episodeSearchStmt.all({ $query: query.trim() }).map(episodeDomain)
}

export function insertMediaRelease(release: MediaRelease): void {
  insertReleaseStmt.run({
    $id: release.id,
    $provider: release.provider ?? null,
    $providerReference: release.providerReference ?? null,
    $fileName: release.fileName ?? null,
    $size: release.size ?? null,
    $duration: release.duration ?? null,
    $createdAt: release.createdAt,
  })
}

export function findMediaRelease(id: string): MediaRelease | null {
  const row = releaseByIdStmt.get({ $id: id })
  return row ? releaseDomain(row) : null
}

export function findMediaReleaseByProvider(
  provider: string,
  reference: string,
): MediaRelease | null {
  const row = releaseByProviderStmt.get({ $provider: provider, $reference: reference })
  return row ? releaseDomain(row) : null
}

export function insertMediaReleaseEvidence(
  evidence: DanmakuEvidence,
  releaseId: string,
  id: string,
  createdAt = Date.now(),
): void {
  const digest = evidence.kind === "fingerprint" ? evidence.digest : undefined
  insertEvidenceStmt.run({
    $id: id,
    $releaseId: releaseId,
    $kind: evidence.kind,
    $algorithm: digest?.algorithm ?? null,
    $scope: digest?.scope ?? null,
    $digestValue: digest?.value ?? null,
    $evidenceJson: JSON.stringify(evidence),
    $createdAt: createdAt,
  })
}

export function listMediaReleaseEvidence(releaseId: string): DanmakuEvidence[] {
  return evidenceByReleaseStmt
    .all({ $releaseId: releaseId })
    .map((row) => parseEvidence(row.evidence_json))
}

export function findEvidenceByDigest(
  algorithm: string,
  scope: string,
  value: string,
): Array<{ releaseId: string; evidence: DanmakuEvidence }> {
  return evidenceByDigestStmt
    .all({ $algorithm: algorithm, $scope: scope, $digestValue: value })
    .flatMap((row) => {
      const evidence = parseEvidence(row.evidence_json)
      return [{ releaseId: row.release_id, evidence }]
    })
}

export function insertReleaseEpisodeMatch(match: ReleaseEpisodeMatch): void {
  insertMatchStmt.run({
    $id: match.id,
    $releaseId: match.releaseId,
    $episodeId: match.episodeId,
    $trustScope: match.trustScope,
    $seitoId: "seitoId" in match ? match.seitoId : null,
    $bushitsuId: "bushitsuId" in match ? match.bushitsuId : null,
    $enmokuId: "enmokuId" in match ? (match.enmokuId ?? null) : null,
    $reviewerSeitoId: "reviewerSeitoId" in match ? match.reviewerSeitoId : null,
    $confidence: match.confidence,
    $evidenceJson: JSON.stringify(match.evidence),
    $createdAt: match.createdAt,
  })
}

export function findReleaseEpisodeMatch(id: string): ReleaseEpisodeMatch | null {
  const row = matchByIdStmt.get({ $id: id })
  return row ? matchDomain(row) : null
}

export function listReleaseEpisodeMatches(releaseId: string): ReleaseEpisodeMatch[] {
  return matchesByReleaseStmt.all({ $releaseId: releaseId }).map(matchDomain)
}

export function findGlobalReleaseEpisodeMatch(releaseId: string): ReleaseEpisodeMatch | null {
  const row = globalMatchByReleaseStmt.get({ $releaseId: releaseId })
  return row ? matchDomain(row) : null
}

export function insertDanmakuTrack(track: DanmakuTrack): void {
  insertTrackStmt.run({
    $id: track.id,
    $episodeId: track.episodeId,
    $releaseId: track.releaseId ?? null,
    $sourceClass: track.sourceClass,
    $name: track.name,
    $provenanceJson: track.provenance === undefined ? null : JSON.stringify(track.provenance),
    $status: track.status,
    $activeRevisionId: track.activeRevisionId ?? null,
    $createdAt: track.createdAt,
    $updatedAt: track.updatedAt,
  })
}

export function findDanmakuTrack(id: string): DanmakuTrack | null {
  const row = trackByIdStmt.get({ $id: id })
  return row ? trackDomain(row) : null
}

export function listDanmakuTracks(episodeId: string): DanmakuTrack[] {
  return tracksByEpisodeStmt.all({ $episodeId: episodeId }).map(trackDomain)
}

export function findDanmakuTrackByReleaseAndEpisode(
  releaseId: string,
  episodeId: string,
  sourceClass: DanmakuSourceClass,
): DanmakuTrack | null {
  const row = trackByReleaseEpisodeStmt.get({
    $releaseId: releaseId,
    $episodeId: episodeId,
    $sourceClass: sourceClass,
  })
  return row ? trackDomain(row) : null
}

export function setDanmakuTrackActiveRevision(
  trackId: string,
  revisionId: string | null,
  status: DanmakuTrackStatus = "active",
  updatedAt = Date.now(),
): boolean {
  return (
    updateTrackActiveStmt.run({
      $trackId: trackId,
      $revisionId: revisionId,
      $status: status,
      $updatedAt: updatedAt,
    }).changes > 0
  )
}

export function setDanmakuTrackStatus(
  trackId: string,
  status: DanmakuTrackStatus,
  updatedAt = Date.now(),
): boolean {
  return (
    updateTrackStatusStmt.run({ $trackId: trackId, $status: status, $updatedAt: updatedAt })
      .changes > 0
  )
}

export function findDanmakuContent(contentHash: string): DanmakuContent | null {
  const row = contentByHashStmt.get({ $contentHash: contentHash })
  return row ? contentDomain(row) : null
}

export function insertDanmakuContent(content: DanmakuContent): boolean {
  const existing = contentByHashStmt.get({ $contentHash: content.contentHash })
  if (existing) {
    if (
      existing.algorithm !== content.algorithm ||
      existing.scope !== content.scope ||
      existing.canonical_json !== content.canonicalJson ||
      existing.byte_length !== content.byteLength
    ) {
      throw new DanmakuContentHashCollision("content hash does not match stored canonical bytes")
    }
    return false
  }
  insertContentStmt.run({
    $contentHash: content.contentHash,
    $algorithm: content.algorithm,
    $scope: content.scope,
    $canonicalJson: content.canonicalJson,
    $byteLength: content.byteLength,
    $createdAt: content.createdAt,
  })
  return true
}

export function insertDanmakuRevision(revision: DanmakuRevision): void {
  insertRevisionStmt.run({
    $id: revision.id,
    $trackId: revision.trackId,
    $contentHash: revision.status === "valid" ? revision.contentHash : null,
    $status: revision.status,
    $fetchedAt: revision.fetchedAt,
    $error: revision.status === "failed" ? (revision.error ?? null) : null,
    $provenanceJson: revision.provenance === undefined ? null : JSON.stringify(revision.provenance),
    $pinned: revision.pinned ? 1 : 0,
    $createdAt: revision.createdAt,
  })
}

export function findDanmakuRevision(id: string): DanmakuRevision | null {
  const row = revisionByIdStmt.get({ $id: id })
  return row ? revisionDomain(row) : null
}

export function listDanmakuRevisions(trackId: string): DanmakuRevision[] {
  return revisionsByTrackStmt.all({ $trackId: trackId }).map(revisionDomain)
}

export function findLatestValidDanmakuRevision(trackId: string): DanmakuRevision | null {
  const row = latestValidRevisionStmt.get({ $trackId: trackId })
  return row ? revisionDomain(row) : null
}

export function findActiveDanmakuRevision(trackId: string): DanmakuRevision | null {
  const row = activeRevisionStmt.get({ $trackId: trackId })
  return row ? revisionDomain(row) : null
}

export function setDanmakuRevisionPinned(revisionId: string, pinned: boolean): boolean {
  return pinRevisionStmt.run({ $revisionId: revisionId, $pinned: pinned ? 1 : 0 }).changes > 0
}

export function blockDanmakuRevision(
  revisionId: string,
  blockedBy: string | undefined,
  reason: string | undefined,
  blockedAt = Date.now(),
): void {
  blockRevisionStmt.run({
    $revisionId: revisionId,
    $blockedAt: blockedAt,
    $blockedBy: blockedBy ?? null,
    $reason: reason ?? null,
  })
}

export function unblockDanmakuRevision(revisionId: string): void {
  unblockRevisionStmt.run({ $revisionId: revisionId })
}

export function isDanmakuRevisionBlocked(revisionId: string): boolean {
  return revisionBlockedStmt.get({ $revisionId: revisionId }) !== null
}

export function listCollectableDanmakuContent(cutoff: number, limit: number): DanmakuContent[] {
  return collectableContentStmt.all({ $cutoff: cutoff, $limit: limit }).map(contentDomain)
}

export function deleteDanmakuContent(contentHash: string): boolean {
  return deleteContentStmt.run({ $contentHash: contentHash }).changes > 0
}

export function upsertDanmakuAlignment(alignment: DanmakuAlignment): void {
  upsertAlignmentStmt.run({
    $id: alignment.id,
    $releaseId: alignment.releaseId,
    $trackId: alignment.trackId,
    $offsetSeconds: alignment.offsetSeconds,
    $trimStartSeconds: alignment.trimStartSeconds ?? null,
    $trimEndSeconds: alignment.trimEndSeconds ?? null,
    $createdBy: alignment.createdBy ?? null,
    $createdAt: alignment.createdAt,
  })
}

export function findDanmakuAlignment(releaseId: string, trackId: string): DanmakuAlignment | null {
  const row = alignmentByReleaseTrackStmt.get({ $releaseId: releaseId, $trackId: trackId })
  return row ? alignmentDomain(row) : null
}

export function insertDanmakuProposal(proposal: DanmakuProposal): void {
  insertProposalStmt.run({
    $id: proposal.id,
    $releaseId: proposal.releaseId,
    $targetEpisodeId: proposal.targetEpisodeId ?? null,
    $suggestedTitle: proposal.suggestedTitle ?? null,
    $suggestedSeason: proposal.suggestedSeason ?? null,
    $suggestedEpisode: proposal.suggestedEpisode ?? null,
    $suggestedDescription: proposal.suggestedDescription ?? null,
    $evidenceJson: JSON.stringify(proposal.evidence),
    $submitterSeitoId: proposal.submitterSeitoId,
    $status: proposal.status,
    $createdAt: proposal.createdAt,
  })
}

export function findDanmakuProposal(id: string): DanmakuProposal | null {
  const row = proposalByIdStmt.get({ $id: id })
  return row ? proposalDomain(row) : null
}

export function listDanmakuProposals(status?: DanmakuProposal["status"]): DanmakuProposal[] {
  return proposalsStmt.all({ $status: status ?? null }).map(proposalDomain)
}

export function decideDanmakuProposal(
  id: string,
  reviewerSeitoId: string,
  status: DanmakuProposal["status"],
  targetEpisodeId: string | undefined,
  mergeTargetEpisodeId: string | undefined,
  disposition: string | undefined,
  decidedAt = Date.now(),
): boolean {
  return (
    decideProposalStmt.run({
      $id: id,
      $reviewerSeitoId: reviewerSeitoId,
      $status: status,
      $targetEpisodeId: targetEpisodeId ?? null,
      $mergeTargetEpisodeId: mergeTargetEpisodeId ?? null,
      $disposition: disposition ?? null,
      $decidedAt: decidedAt,
    }).changes > 0
  )
}

export function getDanmakuSourcePolicy(): DanmakuSourcePolicy {
  const row = policyStmt.get()
  if (!row) {
    return defaultPolicy()
  }
  const allowedClasses = parseSourceClasses(row.allowed_json)
  const order = parseSourceClasses(row.order_json)
  if (!allowedClasses || !order) {
    return { ...defaultPolicy(), updatedAt: row.updated_at }
  }
  return {
    allowedClasses,
    order,
    updatedAt: row.updated_at,
    ...(row.updated_by === null ? {} : { updatedBy: row.updated_by }),
  }
}

export function setDanmakuSourcePolicy(policy: DanmakuSourcePolicy): boolean {
  return (
    updatePolicyStmt.run({
      $allowedJson: JSON.stringify(policy.allowedClasses),
      $orderJson: JSON.stringify(policy.order),
      $updatedAt: policy.updatedAt,
      $updatedBy: policy.updatedBy ?? null,
    }).changes > 0
  )
}

export function getEnmokuDanmakuDefault(enmokuId: string): DanmakuDefaultRecord | null {
  const row = defaultByEnmokuStmt.get({ $enmokuId: enmokuId })
  return row ? defaultDomain(row) : null
}

const defaultsByBushitsuStmt = db.query<DefaultRow, { $bushitsuId: string }>(
  `SELECT enmoku_id, bushitsu_id, track_id, created_at, updated_at
   FROM enmoku_danmaku_default
   WHERE bushitsu_id = $bushitsuId
   ORDER BY enmoku_id ASC`,
)

export function listEnmokuDanmakuDefaults(bushitsuId: string): DanmakuDefaultRecord[] {
  return defaultsByBushitsuStmt.all({ $bushitsuId: bushitsuId }).map(defaultDomain)
}

export function setEnmokuDanmakuDefault(
  enmokuId: string,
  bushitsuId: string,
  trackId: string,
  createdAt = Date.now(),
): void {
  upsertDefaultStmt.run({
    $enmokuId: enmokuId,
    $bushitsuId: bushitsuId,
    $trackId: trackId,
    $createdAt: createdAt,
    $updatedAt: createdAt,
  })
}

export function clearEnmokuDanmakuDefault(enmokuId: string): boolean {
  return deleteDefaultStmt.run({ $enmokuId: enmokuId }).changes > 0
}

export function requireEpisode(id: string): DanmakuEpisode {
  const episode = findDanmakuEpisode(id)
  if (!episode) throw new DanmakuEpisodeNotFound(id)
  return episode
}

export function requireRelease(id: string): MediaRelease {
  const release = findMediaRelease(id)
  if (!release) throw new DanmakuReleaseNotFound(id)
  return release
}

export function requireTrack(id: string): DanmakuTrack {
  const track = findDanmakuTrack(id)
  if (!track) throw new DanmakuTrackNotFound(id)
  return track
}

export function requireRevision(id: string): DanmakuRevision {
  const revision = findDanmakuRevision(id)
  if (!revision) throw new DanmakuRevisionNotFound(id)
  return revision
}

export function requireProposal(id: string): DanmakuProposal {
  const proposal = findDanmakuProposal(id)
  if (!proposal) throw new DanmakuProposalNotFound(id)
  return proposal
}

function episodeDomain(row: EpisodeRow): DanmakuEpisode {
  return {
    id: row.id,
    title: row.title,
    ...(row.season === null ? {} : { season: row.season }),
    ...(row.episode === null ? {} : { episode: row.episode }),
    ...(row.episode_title === null ? {} : { episodeTitle: row.episode_title }),
    ...(row.description === null ? {} : { description: row.description }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function releaseDomain(row: ReleaseRow): MediaRelease {
  return {
    id: row.id,
    ...(row.provider === null ? {} : { provider: row.provider }),
    ...(row.provider_reference === null ? {} : { providerReference: row.provider_reference }),
    ...(row.file_name === null ? {} : { fileName: row.file_name }),
    ...(row.size === null ? {} : { size: row.size }),
    ...(row.duration === null ? {} : { duration: row.duration }),
    createdAt: row.created_at,
  }
}

function matchDomain(row: MatchRow): ReleaseEpisodeMatch {
  const trustScope = parseTrustScope(row.trust_scope)
  const confidence = parseConfidence(row.confidence)
  const common = {
    id: row.id,
    releaseId: row.release_id,
    episodeId: row.episode_id,
    confidence,
    evidence: parseEvidenceArray(row.evidence_json),
    createdAt: row.created_at,
  }
  if (
    trustScope === "personal" &&
    row.seito_id !== null &&
    row.bushitsu_id === null &&
    row.enmoku_id === null &&
    row.reviewer_seito_id === null
  ) {
    return { ...common, trustScope, seitoId: row.seito_id }
  }
  if (
    trustScope === "room" &&
    row.seito_id === null &&
    row.bushitsu_id !== null &&
    row.reviewer_seito_id === null
  ) {
    return {
      ...common,
      trustScope,
      bushitsuId: row.bushitsu_id,
      ...(row.enmoku_id === null ? {} : { enmokuId: row.enmoku_id }),
    }
  }
  if (
    trustScope === "global" &&
    row.seito_id === null &&
    row.bushitsu_id === null &&
    row.enmoku_id === null &&
    row.reviewer_seito_id !== null
  ) {
    return { ...common, trustScope, reviewerSeitoId: row.reviewer_seito_id }
  }
  throw new DanmakuMatchInvalid(`invalid danmaku match ownership for ${row.id}`)
}

function trackDomain(row: TrackRow): DanmakuTrack {
  const provenance = parseProvenance(row.provenance_json)
  return {
    id: row.id,
    episodeId: row.episode_id,
    ...(row.release_id === null ? {} : { releaseId: row.release_id }),
    sourceClass: parseSourceClass(row.source_class),
    name: row.name,
    ...(provenance === undefined ? {} : { provenance }),
    status: parseTrackStatus(row.status),
    ...(row.active_revision_id === null ? {} : { activeRevisionId: row.active_revision_id }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function contentDomain(row: ContentRow): DanmakuContent {
  return {
    contentHash: row.content_hash,
    algorithm: row.algorithm,
    scope: row.scope,
    canonicalJson: row.canonical_json,
    byteLength: row.byte_length,
    createdAt: row.created_at,
  }
}

function revisionDomain(row: RevisionRow): DanmakuRevision {
  const provenance = parseProvenance(row.provenance_json)
  const common = {
    id: row.id,
    trackId: row.track_id,
    fetchedAt: row.fetched_at,
    pinned: row.pinned === 1,
    createdAt: row.created_at,
    ...(provenance === undefined ? {} : { provenance }),
  }
  const status = parseRevisionStatus(row.status)
  if (status === "valid" && row.content_hash !== null && row.error === null) {
    return { ...common, status, contentHash: row.content_hash }
  }
  if (status === "failed" && row.content_hash === null) {
    return { ...common, status, ...(row.error === null ? {} : { error: row.error }) }
  }
  throw new DanmakuRevisionNotFound(`invalid danmaku revision state: ${row.id}`)
}

function alignmentDomain(row: AlignmentRow): DanmakuAlignment {
  return {
    id: row.id,
    releaseId: row.release_id,
    trackId: row.track_id,
    offsetSeconds: row.offset_seconds,
    ...(row.trim_start_seconds === null ? {} : { trimStartSeconds: row.trim_start_seconds }),
    ...(row.trim_end_seconds === null ? {} : { trimEndSeconds: row.trim_end_seconds }),
    ...(row.created_by === null ? {} : { createdBy: row.created_by }),
    createdAt: row.created_at,
  }
}

function proposalDomain(row: ProposalRow): DanmakuProposal {
  return {
    id: row.id,
    releaseId: row.release_id,
    ...(row.target_episode_id === null ? {} : { targetEpisodeId: row.target_episode_id }),
    ...(row.suggested_title === null ? {} : { suggestedTitle: row.suggested_title }),
    ...(row.suggested_season === null ? {} : { suggestedSeason: row.suggested_season }),
    ...(row.suggested_episode === null ? {} : { suggestedEpisode: row.suggested_episode }),
    ...(row.suggested_description === null
      ? {}
      : { suggestedDescription: row.suggested_description }),
    evidence: parseEvidenceArray(row.evidence_json),
    submitterSeitoId: row.submitter_seito_id,
    ...(row.reviewer_seito_id === null ? {} : { reviewerSeitoId: row.reviewer_seito_id }),
    status: parseProposalStatus(row.status),
    ...(row.merge_target_episode_id === null
      ? {}
      : { mergeTargetEpisodeId: row.merge_target_episode_id }),
    ...(row.disposition === null ? {} : { disposition: row.disposition }),
    createdAt: row.created_at,
    ...(row.decided_at === null ? {} : { decidedAt: row.decided_at }),
  }
}

function defaultDomain(row: DefaultRow): DanmakuDefaultRecord {
  return {
    enmokuId: row.enmoku_id,
    bushitsuId: row.bushitsu_id,
    trackId: row.track_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseEvidenceArray(value: string): DanmakuEvidence[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new DanmakuMatchInvalid("invalid danmaku evidence JSON")
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < 1 ||
    parsed.length > 32 ||
    !parsed.every((item): item is DanmakuEvidence => Value.Check(DanmakuEvidenceSchema, item))
  ) {
    throw new DanmakuMatchInvalid("invalid danmaku evidence")
  }
  return parsed
}

function parseEvidence(value: string): DanmakuEvidence {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new DanmakuMatchInvalid("invalid danmaku evidence JSON")
  }
  if (!Value.Check(DanmakuEvidenceSchema, parsed)) {
    throw new DanmakuMatchInvalid("invalid danmaku evidence")
  }
  return parsed
}

function parseProvenance(value: string | null): DanmakuProvenance | undefined {
  if (value === null) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new DanmakuMatchInvalid("invalid danmaku provenance JSON")
  }
  if (!Value.Check(DanmakuProvenanceSchema, parsed)) {
    throw new DanmakuMatchInvalid("invalid danmaku provenance")
  }
  return parsed
}

function parseSourceClasses(value: string): DanmakuSourceClass[] | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => Value.Check(DanmakuSourceClassSchema, item))
    ) {
      return undefined
    }
    return parsed.filter((item): item is DanmakuSourceClass =>
      Value.Check(DanmakuSourceClassSchema, item),
    )
  } catch {
    return undefined
  }
}

function parseSourceClass(value: string): DanmakuSourceClass {
  if (Value.Check(DanmakuSourceClassSchema, value)) return value
  throw new Error(`invalid danmaku source class in database: ${value}`)
}

function parseTrackStatus(value: string): DanmakuTrackStatus {
  if (Value.Check(DanmakuTrackStatusSchema, value)) return value
  throw new Error(`invalid danmaku track status in database: ${value}`)
}

function parseTrustScope(value: string): DanmakuTrustScope {
  if (Value.Check(DanmakuTrustScopeSchema, value)) return value
  throw new DanmakuMatchInvalid(`invalid danmaku trust scope: ${value}`)
}

function parseConfidence(value: string): DanmakuConfidenceTier {
  if (Value.Check(DanmakuConfidenceTierSchema, value)) return value
  throw new DanmakuMatchInvalid(`invalid danmaku confidence: ${value}`)
}

function parseRevisionStatus(value: string): DanmakuRevisionStatus {
  if (value === "valid" || value === "failed") return value
  throw new DanmakuRevisionNotFound(`invalid danmaku revision status: ${value}`)
}

function parseProposalStatus(value: string): DanmakuProposal["status"] {
  if (value === "pending" || value === "approved" || value === "rejected" || value === "merged") {
    return value
  }
  throw new DanmakuProposalNotFound(`invalid danmaku proposal status: ${value}`)
}

function defaultPolicy(): DanmakuSourcePolicy {
  return {
    allowedClasses: ["server-stored", "provider-official", "local", "third-party"],
    order: ["server-stored", "provider-official", "local", "third-party"],
    updatedAt: 0,
  }
}
