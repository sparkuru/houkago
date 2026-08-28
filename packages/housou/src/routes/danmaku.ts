import { Elysia, t } from "elysia"
import {
  DanmakuEvidenceSchema,
  DanmakuProposalDecisionSchema,
  DanmakuProposalStatusSchema,
  DanmakuSourceClassSchema,
  ReleaseEpisodeMatchInputSchema,
} from "houkago-kousoku"
import {
  clearEnmokuDanmakuDefault,
  confirmReleaseEpisodeMatch,
  curateDanmakuEpisode,
  decideDanmakuProposal,
  getDanmakuDefaultSnapshot,
  getDanmakuSourcePolicy,
  listDanmakuProposals,
  resolveDanmakuCandidates,
  saveDanmakuAlignment,
  searchDanmakuEpisodes,
  setEnmokuDanmakuDefault,
  submitDanmakuProposal,
  updateDanmakuSourcePolicy,
} from "../domain/danmaku"
import { Forbidden } from "../lib/errors"
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

function resolveCandidates(
  request: Request,
  bushitsuId: string,
  enmokuId: string,
  releaseId?: string,
) {
  return resolveDanmakuCandidates(seitoFromRequest(request).id, bushitsuId, enmokuId, releaseId)
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
    { query: EpisodeSearchQuery },
  )
  .post(
    "/episodes",
    ({ request, body }) => {
      const actor = requireKomonRequest(request)
      return curateDanmakuEpisode(actor.id, body)
    },
    { body: EpisodeBody },
  )
  .post(
    "/matches",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return confirmReleaseEpisodeMatch(seitoFromRequest(request).id, body)
    },
    { body: ReleaseEpisodeMatchInputSchema },
  )
  .post(
    "/alignments",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return saveDanmakuAlignment(seitoFromRequest(request).id, body)
    },
    { body: AlignmentBody },
  )
  .get("/policy", ({ request }) => {
    requireKomon(request)
    return getDanmakuSourcePolicy()
  })
  .post(
    "/policy",
    ({ request, body }) => {
      const actor = requireKomonRequest(request)
      return updateDanmakuSourcePolicy(actor.id, body)
    },
    { body: SourcePolicyBody },
  )
  // Candidate reads require both a valid session and current room admission;
  // the domain resolver also owns the room/Enmoku boundary checks.
  .get(
    "/bushitsu/:bushitsuId/enmoku/:enmokuId",
    ({ request, params, query }) =>
      resolveCandidates(request, params.bushitsuId, params.enmokuId, query.releaseId),
    { query: t.Object({ releaseId: t.Optional(t.String({ minLength: 1 })) }) },
  )
  .get(
    "/candidates/:bushitsuId/:enmokuId",
    ({ request, params, query }) =>
      resolveCandidates(request, params.bushitsuId, params.enmokuId, query.releaseId),
    { query: t.Object({ releaseId: t.Optional(t.String({ minLength: 1 })) }) },
  )
  // Owner default writes are REST mutations; the resulting full snapshot is
  // sent over the admitted room topic after the DB transaction succeeds.
  .post(
    "/bushitsu/:bushitsuId/enmoku/:enmokuId/default",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    { body: DanmakuDefaultBody },
  )
  .put(
    "/bushitsu/:bushitsuId/enmoku/:enmokuId/default",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    { body: DanmakuDefaultBody },
  )
  .delete("/bushitsu/:bushitsuId/enmoku/:enmokuId/default", ({ request, params }) =>
    updateDefault(request, params.bushitsuId, params.enmokuId, null),
  )
  .post(
    "/defaults/:bushitsuId/:enmokuId",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    { body: DanmakuDefaultBody },
  )
  .put(
    "/defaults/:bushitsuId/:enmokuId",
    ({ request, params, body }) =>
      updateDefault(request, params.bushitsuId, params.enmokuId, body.trackId),
    { body: DanmakuDefaultBody },
  )
  .delete("/defaults/:bushitsuId/:enmokuId", ({ request, params }) =>
    updateDefault(request, params.bushitsuId, params.enmokuId, null),
  )
  .get("/bushitsu/:bushitsuId/defaults", ({ request, params }) => {
    const actor = seitoFromRequest(request)
    if (!isPresent(params.bushitsuId, actor.id)) {
      throw new Forbidden("room admission is required")
    }
    return getDanmakuDefaultSnapshot(params.bushitsuId)
  })
  .post(
    "/proposals",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return submitDanmakuProposal(seitoFromRequest(request).id, body)
    },
    { body: ProposalBody },
  )
  .get(
    "/proposals",
    ({ request, query }) => {
      requireKomon(request)
      return listDanmakuProposals(query.status)
    },
    { query: ProposalListQuery },
  )
  .post(
    "/proposals/:proposalId/decision",
    ({ request, params, body }) => {
      const actor = requireKomonRequest(request)
      return decideDanmakuProposal(actor.id, params.proposalId, body)
    },
    { body: DanmakuProposalDecisionSchema },
  )
