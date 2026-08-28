import { Elysia, t } from "elysia"
import {
  DanmakuEvidenceSchema,
  DanmakuProposalDecisionSchema,
  DanmakuProposalStatusSchema,
  DanmakuSourceClassSchema,
  ReleaseEpisodeMatchInputSchema,
} from "houkago-kousoku"
import {
  confirmReleaseEpisodeMatch,
  curateDanmakuEpisode,
  decideDanmakuProposal,
  getDanmakuSourcePolicy,
  listDanmakuProposals,
  saveDanmakuAlignment,
  searchDanmakuEpisodes,
  submitDanmakuProposal,
  updateDanmakuSourcePolicy,
} from "../domain/danmaku"
import { requireKomon, requireKomonRequest } from "../lib/komon"
import { requireTrustedOrigin } from "../lib/origin"
import { seitoFromRequest } from "../lib/seitoshou"

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
