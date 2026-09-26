import { Elysia, t } from "elysia"
import {
  BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
  DanmakuAlignmentSchema,
  DanmakuCandidateResolutionSchema,
  DanmakuDefaultSnapshotSchema,
  DanmakuEpisodeSchema,
  DanmakuEvidenceSchema,
  DanmakuProposalDecisionSchema,
  DanmakuProposalSchema,
  DanmakuProposalStatusSchema,
  DanmakuRevisionSchema,
  DanmakuSourceClassSchema,
  DanmakuSourcePolicySchema,
  DanmakuTrackSchema,
  ReleaseEpisodeMatchInputSchema,
  ReleaseEpisodeMatchSchema,
} from "houkago-kousoku"
import {
  clearEnmokuDanmakuDefault,
  confirmReleaseEpisodeMatch,
  curateDanmakuEpisode,
  decideDanmakuProposal,
  disableDanmakuRevision,
  getDanmakuDefaultSnapshot,
  getDanmakuSourcePolicy,
  listDanmakuProposals,
  pinDanmakuRevision,
  rollbackDanmakuRevision,
  saveDanmakuAlignment,
  searchDanmakuEpisodes,
  setEnmokuDanmakuDefault,
  submitDanmakuProposal,
  updateDanmakuSourcePolicy,
} from "../domain/danmaku"
import { resolveDanmakuCandidatesWithRefresh } from "../domain/danmaku-source"
import { DanmakuMatchInvalid, Forbidden } from "../lib/errors"
import { httpDetail, httpResponses } from "../lib/http-contract"
import { requireKomon, requireKomonRequest } from "../lib/komon"
import { requireTrustedOrigin } from "../lib/origin"
import { seitoFromRequest } from "../lib/seitoshou"
import { broadcastRoom } from "../ws/handler"
import { isPresent, serverMsg } from "../ws/housou"

const EpisodeBody = t.Object(
  {
    title: t.String({ minLength: 1, maxLength: 512 }),
    season: t.Optional(t.Integer({ minimum: 0 })),
    episode: t.Optional(t.Integer({ minimum: 0 })),
    episodeTitle: t.Optional(t.String({ maxLength: 512 })),
    description: t.Optional(t.String({ maxLength: 2000 })),
  },
  { additionalProperties: false },
)

const ProposalBody = t.Object(
  {
    releaseId: t.String({ minLength: 1 }),
    targetEpisodeId: t.Optional(t.String({ minLength: 1 })),
    suggestedTitle: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
    suggestedSeason: t.Optional(t.Integer({ minimum: 0 })),
    suggestedEpisode: t.Optional(t.Integer({ minimum: 0 })),
    suggestedDescription: t.Optional(t.String({ maxLength: 2000 })),
    evidence: t.Array(DanmakuEvidenceSchema, { minItems: 1, maxItems: 32 }),
  },
  { additionalProperties: false },
)

const EpisodeSearchQuery = t.Object(
  { q: t.Optional(t.String({ maxLength: 256 })) },
  { additionalProperties: false },
)

const CandidateQuery = t.Object(
  {
    releaseId: t.Optional(t.String({ minLength: 1 })),
    duration: t.Optional(t.Number({ minimum: 0 })),
    fingerprint: t.Optional(t.String({ pattern: "^[0-9a-f]{32}$" })),
    fingerprintBytes: t.Optional(
      t.Integer({ minimum: 1, maximum: BAIDU_MEDIA_FINGERPRINT_MAX_BYTES }),
    ),
  },
  { additionalProperties: false },
)

const ProposalListQuery = t.Object(
  { status: t.Optional(DanmakuProposalStatusSchema) },
  { additionalProperties: false },
)

const AlignmentBody = t.Object(
  {
    releaseId: t.String({ minLength: 1 }),
    trackId: t.String({ minLength: 1 }),
    offsetSeconds: t.Number(),
    trimStartSeconds: t.Optional(t.Number({ minimum: 0 })),
    trimEndSeconds: t.Optional(t.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
)

const SourcePolicyBody = t.Object(
  {
    allowedClasses: t.Array(DanmakuSourceClassSchema, { minItems: 1 }),
    order: t.Array(DanmakuSourceClassSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
)

const DanmakuDefaultBody = t.Object(
  { trackId: t.Union([t.String({ minLength: 1 }), t.Null()]) },
  { additionalProperties: false },
)

const RevisionDisableBody = t.Object(
  { reason: t.Optional(t.String({ maxLength: 512 })) },
  { additionalProperties: false },
)

const RevisionRollbackBody = t.Object({}, { additionalProperties: false })

const RevisionPinBody = t.Object({ pinned: t.Boolean() }, { additionalProperties: false })

async function resolveCandidates(
  request: Request,
  bushitsuId: string,
  enmokuId: string,
  releaseId?: string,
  duration?: number,
  fingerprintValue?: string,
  fingerprintBytes?: number,
) {
  const hasFingerprintValue = fingerprintValue !== undefined
  const hasFingerprintBytes = fingerprintBytes !== undefined
  if (hasFingerprintValue !== hasFingerprintBytes) {
    throw new DanmakuMatchInvalid("fingerprint value and bytes must be provided together")
  }
  const fingerprint =
    hasFingerprintValue && hasFingerprintBytes
      ? {
          algorithm: "md5" as const,
          scope: "prefix" as const,
          bytes: fingerprintBytes,
          value: fingerprintValue,
        }
      : undefined
  return resolveDanmakuCandidatesWithRefresh(
    seitoFromRequest(request).id,
    bushitsuId,
    enmokuId,
    releaseId,
    { duration, ...(fingerprint === undefined ? {} : { fingerprint }) },
  )
}

function updateDefault(
  request: Request,
  bushitsuId: string,
  enmokuId: string,
  trackId: string | null,
) {
  requireTrustedOrigin(request.headers.get("origin"))
  const actor = seitoFromRequest(request)
  const snapshot =
    trackId === null
      ? clearEnmokuDanmakuDefault(actor.id, bushitsuId, enmokuId)
      : setEnmokuDanmakuDefault(actor.id, bushitsuId, enmokuId, trackId)
  broadcastRoom(bushitsuId, serverMsg("DANMAKU_DEFAULT", snapshot))
  return snapshot
}

export const danmakuRoutes = new Elysia({ prefix: "/danmaku" })
  .get(
    "/episodes",
    ({ request, query }) => {
      seitoFromRequest(request)
      return searchDanmakuEpisodes(query.q)
    },
    {
      query: EpisodeSearchQuery,
      response: httpResponses(t.Array(DanmakuEpisodeSchema)),
      ...httpDetail("danmakuEpisodeSearch", ["browser-json", "danmaku"]),
    },
  )
  .post(
    "/episodes",
    ({ request, body }) => {
      const actor = requireKomonRequest(request)
      return curateDanmakuEpisode(actor.id, body)
    },
    {
      body: EpisodeBody,
      response: httpResponses(DanmakuEpisodeSchema),
      ...httpDetail("danmakuEpisodeCreate", ["browser-json", "danmaku-admin"]),
    },
  )
  .post(
    "/matches",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return confirmReleaseEpisodeMatch(seitoFromRequest(request).id, body)
    },
    {
      body: ReleaseEpisodeMatchInputSchema,
      response: httpResponses(ReleaseEpisodeMatchSchema),
      ...httpDetail("danmakuMatchCreate", ["browser-json", "danmaku"]),
    },
  )
  .post(
    "/alignments",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return saveDanmakuAlignment(seitoFromRequest(request).id, body)
    },
    {
      body: AlignmentBody,
      response: httpResponses(DanmakuAlignmentSchema),
      ...httpDetail("danmakuAlignmentCreate", ["browser-json", "danmaku"]),
    },
  )
  .get(
    "/policy",
    ({ request }) => {
      requireKomon(request)
      return getDanmakuSourcePolicy()
    },
    {
      response: httpResponses(DanmakuSourcePolicySchema),
      ...httpDetail("danmakuPolicyGet", ["browser-json", "danmaku-admin"]),
    },
  )
  .post(
    "/policy",
    ({ request, body }) => {
      const actor = requireKomonRequest(request)
      return updateDanmakuSourcePolicy(actor.id, body)
    },
    {
      body: SourcePolicyBody,
      response: httpResponses(DanmakuSourcePolicySchema),
      ...httpDetail("danmakuPolicyUpdate", ["browser-json", "danmaku-admin"]),
    },
  )
  // Candidate reads require both a valid session and current room admission;
  // the domain resolver also owns the room/Enmoku boundary checks.
  .get(
    "/bushitsu/:bushitsuId/enmoku/:enmokuId",
    ({ request, params, query }) =>
      resolveCandidates(
        request,
        params.bushitsuId,
        params.enmokuId,
        query.releaseId,
        query.duration,
        query.fingerprint,
        query.fingerprintBytes,
      ),
    {
      query: CandidateQuery,
      response: httpResponses(DanmakuCandidateResolutionSchema),
      ...httpDetail("danmakuCandidatesResolve", ["browser-json", "danmaku"]),
    },
  )
  .get(
    "/candidates/:bushitsuId/:enmokuId",
    ({ request, params, query }) =>
      resolveCandidates(
        request,
        params.bushitsuId,
        params.enmokuId,
        query.releaseId,
        query.duration,
        query.fingerprint,
        query.fingerprintBytes,
      ),
    {
      query: CandidateQuery,
      response: httpResponses(DanmakuCandidateResolutionSchema),
      ...httpDetail("danmakuCandidatesResolveLegacy", ["browser-json", "danmaku"]),
    },
  )
  // Owner default writes are REST mutations; the resulting full snapshot is
  // sent over the admitted room topic after the DB transaction succeeds.
  .post(
    "/bushitsu/:bushitsuId/enmoku/:enmokuId/default",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    {
      body: DanmakuDefaultBody,
      response: httpResponses(DanmakuDefaultSnapshotSchema),
      ...httpDetail("danmakuEnmokuDefaultCreate", ["browser-json", "danmaku"]),
    },
  )
  .put(
    "/bushitsu/:bushitsuId/enmoku/:enmokuId/default",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    {
      body: DanmakuDefaultBody,
      response: httpResponses(DanmakuDefaultSnapshotSchema),
      ...httpDetail("danmakuEnmokuDefaultUpdate", ["browser-json", "danmaku"]),
    },
  )
  .delete(
    "/bushitsu/:bushitsuId/enmoku/:enmokuId/default",
    ({ request, params }) => updateDefault(request, params.bushitsuId, params.enmokuId, null),
    {
      response: httpResponses(DanmakuDefaultSnapshotSchema),
      ...httpDetail("danmakuEnmokuDefaultDelete", ["browser-json", "danmaku"]),
    },
  )
  .post(
    "/defaults/:bushitsuId/:enmokuId",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    {
      body: DanmakuDefaultBody,
      response: httpResponses(DanmakuDefaultSnapshotSchema),
      ...httpDetail("danmakuDefaultCreate", ["browser-json", "danmaku"]),
    },
  )
  .put(
    "/defaults/:bushitsuId/:enmokuId",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    {
      body: DanmakuDefaultBody,
      response: httpResponses(DanmakuDefaultSnapshotSchema),
      ...httpDetail("danmakuDefaultUpdate", ["browser-json", "danmaku"]),
    },
  )
  .delete(
    "/defaults/:bushitsuId/:enmokuId",
    ({ request, params }) => updateDefault(request, params.bushitsuId, params.enmokuId, null),
    {
      response: httpResponses(DanmakuDefaultSnapshotSchema),
      ...httpDetail("danmakuDefaultDelete", ["browser-json", "danmaku"]),
    },
  )
  .get(
    "/bushitsu/:bushitsuId/defaults",
    ({ request, params }) => {
      const actor = seitoFromRequest(request)
      if (!isPresent(params.bushitsuId, actor.id)) {
        throw new Forbidden("room admission is required")
      }
      return getDanmakuDefaultSnapshot(params.bushitsuId)
    },
    {
      response: httpResponses(DanmakuDefaultSnapshotSchema),
      ...httpDetail("danmakuRoomDefaultsGet", ["browser-json", "danmaku"]),
    },
  )
  .post(
    "/proposals",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return submitDanmakuProposal(seitoFromRequest(request).id, body)
    },
    {
      body: ProposalBody,
      response: httpResponses(DanmakuProposalSchema),
      ...httpDetail("danmakuProposalCreate", ["browser-json", "danmaku"]),
    },
  )
  .get(
    "/proposals",
    ({ request, query }) => {
      requireKomon(request)
      return listDanmakuProposals(query.status)
    },
    {
      query: ProposalListQuery,
      response: httpResponses(t.Array(DanmakuProposalSchema)),
      ...httpDetail("danmakuProposalList", ["browser-json", "danmaku-admin"]),
    },
  )
  .post(
    "/proposals/:proposalId/decision",
    ({ request, params, body }) => {
      const actor = requireKomonRequest(request)
      return decideDanmakuProposal(actor.id, params.proposalId, body)
    },
    {
      body: DanmakuProposalDecisionSchema,
      response: httpResponses(DanmakuProposalSchema),
      ...httpDetail("danmakuProposalDecision", ["browser-json", "danmaku-admin"]),
    },
  )
  .post(
    "/tracks/:trackId/revisions/:revisionId/disable",
    ({ request, params, body }) => {
      const actor = requireKomonRequest(request)
      return disableDanmakuRevision(actor.id, params.trackId, params.revisionId, body.reason)
    },
    {
      body: RevisionDisableBody,
      response: httpResponses(DanmakuTrackSchema),
      ...httpDetail("danmakuRevisionDisable", ["browser-json", "danmaku-admin"]),
    },
  )
  .post(
    "/tracks/:trackId/revisions/:revisionId/rollback",
    ({ request, params }) => {
      const actor = requireKomonRequest(request)
      return rollbackDanmakuRevision(actor.id, params.trackId, params.revisionId)
    },
    {
      body: RevisionRollbackBody,
      response: httpResponses(DanmakuTrackSchema),
      ...httpDetail("danmakuRevisionRollback", ["browser-json", "danmaku-admin"]),
    },
  )
  .post(
    "/revisions/:revisionId/pin",
    ({ request, params, body }) => {
      const actor = requireKomonRequest(request)
      return pinDanmakuRevision(actor.id, params.revisionId, body.pinned)
    },
    {
      body: RevisionPinBody,
      response: httpResponses(DanmakuRevisionSchema),
      ...httpDetail("danmakuRevisionPin", ["browser-json", "danmaku-admin"]),
    },
  )
