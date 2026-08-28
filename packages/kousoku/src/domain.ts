import { type Static, Type } from "@sinclair/typebox"

// 部長 / 部員 / 見学：role within a 部室 (design §3, §13)
export const YakuwariSchema = Type.Union([
  Type.Literal("buchou"), // 部長 host：sole sync authority (design §5)
  Type.Literal("buin"), // 部員 member
  Type.Literal("kengaku"), // 見学 guest / spectator
])
export type Yakuwari = Static<typeof YakuwariSchema>

// 部室：a watch room (design §13)
export const BushitsuSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  buchouId: Type.String(), // 部長 id：first to create/enter holds authority
  createdAt: Type.Number(), // epoch ms
})
export type Bushitsu = Static<typeof BushitsuSchema>

// 部員：a member present in a 部室
export const BuinSchema = Type.Object({
  id: Type.String(),
  bushitsuId: Type.String(),
  nickname: Type.String(),
  yakuwari: YakuwariSchema,
})
export type Buin = Static<typeof BuinSchema>

export const MeiboBuinSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  joinedAt: Type.Number(),
  yakuwari: YakuwariSchema,
})
export type MeiboBuin = Static<typeof MeiboBuinSchema>

// 生徒：a durable Houkago account. Passwords and session tokens never enter the
// shared contract; consumers receive only this public account summary.
export const SeitoSchema = Type.Object({
  id: Type.String(),
  username: Type.String(),
  createdAt: Type.Number(),
})
export type Seito = Static<typeof SeitoSchema>

// 演目 source kind (design §6). Single source for both the REST create-input
// schema (housou) and the player prop type (kyoushitsu).
export const EnmokuTypeSchema = Type.Union([
  Type.Literal("direct"),
  Type.Literal("hls"),
  Type.Literal("dash"),
  Type.Literal("live"),
])
export type EnmokuType = Static<typeof EnmokuTypeSchema>

export const BilibiliProviderSchema = Type.Object(
  {
    kind: Type.Literal("bilibili"),
    url: Type.String(),
    coverUrl: Type.Optional(Type.String()),
    ownerName: Type.Optional(Type.String()),
    stats: Type.Optional(
      Type.Object(
        {
          view: Type.Optional(Type.Number()),
          danmaku: Type.Optional(Type.Number()),
          reply: Type.Optional(Type.Number()),
          favorite: Type.Optional(Type.Number()),
          coin: Type.Optional(Type.Number()),
          share: Type.Optional(Type.Number()),
          like: Type.Optional(Type.Number()),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
)
export type BilibiliProvider = Static<typeof BilibiliProviderSchema>

export const BaiduProviderSchema = Type.Object(
  {
    kind: Type.Literal("baidu"),
    sourceId: Type.String({ minLength: 1 }),
    ownerName: Type.Optional(Type.String()),
    fileName: Type.String({ minLength: 1 }),
    size: Type.Optional(Type.Number({ minimum: 0 })),
  },
  { additionalProperties: false },
)
export type BaiduProvider = Static<typeof BaiduProviderSchema>

export const EnmokuProviderSchema = Type.Union([BilibiliProviderSchema, BaiduProviderSchema])
export type EnmokuProvider = Static<typeof EnmokuProviderSchema>

// 演目：a playable item (design §6)
export const EnmokuSchema = Type.Object({
  id: Type.String(),
  bushitsuId: Type.String(),
  title: Type.String(),
  type: EnmokuTypeSchema,
  url: Type.String(), // points at eisha's stable proxy address in later phases
  headers: Type.Optional(Type.Record(Type.String(), Type.String())),
  subtitles: Type.Optional(
    Type.Record(Type.String(), Type.Object({ url: Type.String(), type: Type.String() })),
  ),
  sources: Type.Optional(Type.Array(Type.Object({ name: Type.String(), url: Type.String() }))),
  danmaku: Type.Optional(
    Type.Object({
      type: Type.Union([Type.Literal("file"), Type.Literal("fetch")]),
      ref: Type.String(),
    }),
  ),
  provider: Type.Optional(EnmokuProviderSchema),
  live: Type.Optional(Type.Boolean()),
  addedBy: Type.String(), // 投稿者 buin id
})
export type Enmoku = Static<typeof EnmokuSchema>

// 進行：playback state, the sync primitive (design §4 SHINKOU, §5)
export const ShinkouSchema = Type.Object({
  isPlaying: Type.Boolean(),
  currentTime: Type.Number(), // seconds
  playbackRate: Type.Number(),
})
export type Shinkou = Static<typeof ShinkouSchema>

// Timeline danmaku is intentionally separate from realtime room DANMAKU. The
// normalized cue contract is shared so storage and later provider adapters do
// not need to depend on the kokuban parser package.
export const DanmakuModeSchema = Type.Union([
  Type.Literal("scroll"),
  Type.Literal("top"),
  Type.Literal("bottom"),
  Type.Literal("reverse"),
  Type.Literal("special"),
])
export type DanmakuMode = Static<typeof DanmakuModeSchema>

export const DanmakuCueSchema = Type.Object(
  {
    time: Type.Number({ minimum: 0 }),
    text: Type.String({ minLength: 1 }),
    color: Type.Optional(Type.String()),
    mode: DanmakuModeSchema,
  },
  { additionalProperties: false },
)
export type DanmakuCue = Static<typeof DanmakuCueSchema>

// A digest describes evidence about one concrete release. Algorithm and scope
// are part of its identity: equal hex text alone never makes two fingerprints
// comparable.
export const DigestSchema = Type.Object(
  {
    algorithm: Type.String({ minLength: 1, maxLength: 64 }),
    scope: Type.String({ minLength: 1, maxLength: 128 }),
    value: Type.String({ minLength: 1, maxLength: 512 }),
    bytes: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
)
export type Digest = Static<typeof DigestSchema>

export const DanmakuSourceClassSchema = Type.Union([
  Type.Literal("server-stored"),
  Type.Literal("provider-official"),
  Type.Literal("local"),
  Type.Literal("third-party"),
])
export type DanmakuSourceClass = Static<typeof DanmakuSourceClassSchema>
export type SourceClass = DanmakuSourceClass

export const DanmakuTrustScopeSchema = Type.Union([
  Type.Literal("personal"),
  Type.Literal("room"),
  Type.Literal("global"),
])
export type DanmakuTrustScope = Static<typeof DanmakuTrustScopeSchema>
export type TrustScope = DanmakuTrustScope

export const DanmakuConfidenceTierSchema = Type.Union([
  Type.Literal("confirmed"),
  Type.Literal("suggested"),
  Type.Literal("ambiguous"),
  Type.Literal("none"),
])
export type DanmakuConfidenceTier = Static<typeof DanmakuConfidenceTierSchema>

export const DanmakuEvidenceSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("filename"),
      work: Type.Optional(Type.String({ maxLength: 256 })),
      season: Type.Optional(Type.Integer({ minimum: 0 })),
      episode: Type.Optional(Type.Integer({ minimum: 0 })),
      group: Type.Optional(Type.String({ maxLength: 256 })),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("fingerprint"),
      digest: DigestSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("size"),
      bytes: Type.Integer({ minimum: 0 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("duration"),
      seconds: Type.Number({ minimum: 0 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("provider"),
      provider: Type.String({ minLength: 1, maxLength: 64 }),
      reference: Type.String({ minLength: 1, maxLength: 512 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("confirmation"),
      scope: DanmakuTrustScopeSchema,
      note: Type.Optional(Type.String({ maxLength: 512 })),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("third-party"),
      provider: Type.String({ minLength: 1, maxLength: 64 }),
      reference: Type.String({ minLength: 1, maxLength: 512 }),
      tier: DanmakuConfidenceTierSchema,
    },
    { additionalProperties: false },
  ),
])
export type DanmakuEvidence = Static<typeof DanmakuEvidenceSchema>

export const DanmakuProvenanceSchema = Type.Object(
  {
    provider: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
    reference: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    label: Type.Optional(Type.String({ maxLength: 256 })),
  },
  { additionalProperties: false },
)
export type DanmakuProvenance = Static<typeof DanmakuProvenanceSchema>

export const DanmakuEpisodeSchema = Type.Object(
  {
    id: Type.String(),
    title: Type.String({ minLength: 1, maxLength: 512 }),
    season: Type.Optional(Type.Integer({ minimum: 0 })),
    episode: Type.Optional(Type.Integer({ minimum: 0 })),
    episodeTitle: Type.Optional(Type.String({ maxLength: 512 })),
    description: Type.Optional(Type.String({ maxLength: 2000 })),
    createdAt: Type.Number(),
    updatedAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type DanmakuEpisode = Static<typeof DanmakuEpisodeSchema>

export const MediaReleaseSchema = Type.Object(
  {
    id: Type.String(),
    provider: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
    providerReference: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    fileName: Type.Optional(Type.String({ minLength: 1, maxLength: 1024 })),
    size: Type.Optional(Type.Integer({ minimum: 0 })),
    duration: Type.Optional(Type.Number({ minimum: 0 })),
    createdAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type MediaRelease = Static<typeof MediaReleaseSchema>

const ReleaseEpisodeMatchCommon = {
  id: Type.String(),
  releaseId: Type.String(),
  episodeId: Type.String(),
  confidence: DanmakuConfidenceTierSchema,
  evidence: Type.Array(DanmakuEvidenceSchema, { minItems: 1, maxItems: 32 }),
  createdAt: Type.Number(),
}

// Scope is an authority boundary, not just a label. Keep the owner required
// for each scope in the shared contract so an invalid combination cannot pass
// an edge validator and fail later in a database query.
export const ReleaseEpisodeMatchSchema = Type.Union([
  Type.Object(
    {
      ...ReleaseEpisodeMatchCommon,
      trustScope: Type.Literal("personal"),
      seitoId: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...ReleaseEpisodeMatchCommon,
      trustScope: Type.Literal("room"),
      bushitsuId: Type.String(),
      enmokuId: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...ReleaseEpisodeMatchCommon,
      trustScope: Type.Literal("global"),
      reviewerSeitoId: Type.String(),
    },
    { additionalProperties: false },
  ),
])
export type ReleaseEpisodeMatch = Static<typeof ReleaseEpisodeMatchSchema>

// Command input deliberately omits server-owned ids, timestamps, and
// authority subjects. The service fills those from the authenticated actor.
export const ReleaseEpisodeMatchInputSchema = Type.Union([
  Type.Object(
    {
      releaseId: Type.String(),
      episodeId: Type.String(),
      trustScope: Type.Literal("personal"),
      evidence: Type.Array(DanmakuEvidenceSchema, { minItems: 1, maxItems: 32 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      releaseId: Type.String(),
      episodeId: Type.String(),
      trustScope: Type.Literal("room"),
      bushitsuId: Type.String(),
      enmokuId: Type.Optional(Type.String()),
      evidence: Type.Array(DanmakuEvidenceSchema, { minItems: 1, maxItems: 32 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      releaseId: Type.String(),
      episodeId: Type.String(),
      trustScope: Type.Literal("global"),
      evidence: Type.Array(DanmakuEvidenceSchema, { minItems: 1, maxItems: 32 }),
    },
    { additionalProperties: false },
  ),
])
export type ReleaseEpisodeMatchInput = Static<typeof ReleaseEpisodeMatchInputSchema>

export const DanmakuTrackStatusSchema = Type.Union([
  Type.Literal("active"),
  Type.Literal("disabled"),
])
export type DanmakuTrackStatus = Static<typeof DanmakuTrackStatusSchema>

export const DanmakuTrackSchema = Type.Object(
  {
    id: Type.String(),
    episodeId: Type.String(),
    releaseId: Type.Optional(Type.String()),
    sourceClass: DanmakuSourceClassSchema,
    name: Type.String({ minLength: 1, maxLength: 256 }),
    provenance: Type.Optional(DanmakuProvenanceSchema),
    status: DanmakuTrackStatusSchema,
    activeRevisionId: Type.Optional(Type.String()),
    createdAt: Type.Number(),
    updatedAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type DanmakuTrack = Static<typeof DanmakuTrackSchema>

export const DanmakuContentSchema = Type.Object(
  {
    contentHash: Type.String(),
    algorithm: Type.String({ minLength: 1, maxLength: 64 }),
    scope: Type.String({ minLength: 1, maxLength: 128 }),
    canonicalJson: Type.String(),
    byteLength: Type.Integer({ minimum: 0 }),
    createdAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type DanmakuContent = Static<typeof DanmakuContentSchema>

export const DanmakuRevisionStatusSchema = Type.Union([
  Type.Literal("valid"),
  Type.Literal("failed"),
])
export type DanmakuRevisionStatus = Static<typeof DanmakuRevisionStatusSchema>

const DanmakuRevisionSummaryCommon = {
  id: Type.String(),
  trackId: Type.String(),
  fetchedAt: Type.Number(),
  pinned: Type.Boolean(),
  createdAt: Type.Number(),
}

export const DanmakuRevisionSummarySchema = Type.Union([
  Type.Object(
    {
      ...DanmakuRevisionSummaryCommon,
      status: Type.Literal("valid"),
      contentHash: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...DanmakuRevisionSummaryCommon,
      status: Type.Literal("failed"),
      error: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
])
export type DanmakuRevisionSummary = Static<typeof DanmakuRevisionSummarySchema>

const DanmakuRevisionCommon = {
  id: Type.String(),
  trackId: Type.String(),
  fetchedAt: Type.Number(),
  pinned: Type.Boolean(),
  createdAt: Type.Number(),
  provenance: Type.Optional(DanmakuProvenanceSchema),
}

export const DanmakuRevisionSchema = Type.Union([
  Type.Object(
    {
      ...DanmakuRevisionCommon,
      status: Type.Literal("valid"),
      contentHash: Type.String(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...DanmakuRevisionCommon,
      status: Type.Literal("failed"),
      error: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
])
export type DanmakuRevision = Static<typeof DanmakuRevisionSchema>

export const DanmakuAlignmentSchema = Type.Object(
  {
    id: Type.String(),
    releaseId: Type.String(),
    trackId: Type.String(),
    offsetSeconds: Type.Number(),
    trimStartSeconds: Type.Optional(Type.Number({ minimum: 0 })),
    trimEndSeconds: Type.Optional(Type.Number({ minimum: 0 })),
    createdBy: Type.Optional(Type.String()),
    createdAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type DanmakuAlignment = Static<typeof DanmakuAlignmentSchema>

export const DanmakuProposalStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
  Type.Literal("merged"),
])
export type DanmakuProposalStatus = Static<typeof DanmakuProposalStatusSchema>

export const DanmakuProposalSchema = Type.Object(
  {
    id: Type.String(),
    releaseId: Type.String(),
    targetEpisodeId: Type.Optional(Type.String()),
    suggestedTitle: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    suggestedSeason: Type.Optional(Type.Integer({ minimum: 0 })),
    suggestedEpisode: Type.Optional(Type.Integer({ minimum: 0 })),
    suggestedDescription: Type.Optional(Type.String({ maxLength: 2000 })),
    evidence: Type.Array(DanmakuEvidenceSchema, { minItems: 1, maxItems: 32 }),
    submitterSeitoId: Type.String(),
    reviewerSeitoId: Type.Optional(Type.String()),
    status: DanmakuProposalStatusSchema,
    mergeTargetEpisodeId: Type.Optional(Type.String()),
    disposition: Type.Optional(Type.String({ maxLength: 1000 })),
    createdAt: Type.Number(),
    decidedAt: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
)
export type DanmakuProposal = Static<typeof DanmakuProposalSchema>

export const DanmakuProposalDecisionSchema = Type.Object(
  {
    action: Type.Union([Type.Literal("approve"), Type.Literal("reject"), Type.Literal("merge")]),
    episodeId: Type.Optional(Type.String()),
    disposition: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  { additionalProperties: false },
)
export type DanmakuProposalDecision = Static<typeof DanmakuProposalDecisionSchema>

export const DanmakuSourcePolicySchema = Type.Object(
  {
    allowedClasses: Type.Array(DanmakuSourceClassSchema, { minItems: 1 }),
    order: Type.Array(DanmakuSourceClassSchema, { minItems: 1 }),
    updatedAt: Type.Number(),
    updatedBy: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
)
export type DanmakuSourcePolicy = Static<typeof DanmakuSourcePolicySchema>

// Candidate availability is deliberately separate from source class. A track
// can remain visible for inspection while its current revision is unavailable,
// disabled, or failed; callers must fall through without rewriting a stored
// preference.
export const DanmakuCandidateAvailabilitySchema = Type.Union([
  Type.Literal("available"),
  Type.Literal("unavailable"),
  Type.Literal("disabled"),
  Type.Literal("failed"),
])
export type DanmakuCandidateAvailability = Static<typeof DanmakuCandidateAvailabilitySchema>
export const DanmakuCandidateStatusSchema = DanmakuCandidateAvailabilitySchema
export type DanmakuCandidateStatus = DanmakuCandidateAvailability

// A safe candidate summary. `cues` is optional because compatibility/provider
// candidates may still be loaded through an existing server-side endpoint; it
// never carries media bytes, credentials, or private provider material.
export const DanmakuCandidateSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    sourceClass: DanmakuSourceClassSchema,
    name: Type.String({ minLength: 1, maxLength: 256 }),
    provenance: Type.Optional(DanmakuProvenanceSchema),
    evidence: Type.Optional(Type.Array(DanmakuEvidenceSchema, { maxItems: 32 })),
    confidence: Type.Optional(DanmakuConfidenceTierSchema),
    releaseId: Type.Optional(Type.String({ minLength: 1 })),
    episodeId: Type.Optional(Type.String({ minLength: 1 })),
    trackId: Type.Optional(Type.String({ minLength: 1 })),
    revisionId: Type.Optional(Type.String({ minLength: 1 })),
    alignment: Type.Optional(DanmakuAlignmentSchema),
    availability: DanmakuCandidateAvailabilitySchema,
    reason: Type.Optional(Type.String({ maxLength: 512 })),
    legacyRef: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
    cues: Type.Optional(Type.Array(DanmakuCueSchema)),
  },
  { additionalProperties: false },
)
export type DanmakuCandidate = Static<typeof DanmakuCandidateSchema>

export const DanmakuMatchConfidenceSchema = Type.Union([
  Type.Literal("suggested"),
  Type.Literal("ambiguous"),
  Type.Literal("none"),
])
export type DanmakuMatchConfidence = Static<typeof DanmakuMatchConfidenceSchema>

export const DanmakuMatchFieldSchema = Type.Union([
  Type.Literal("work"),
  Type.Literal("season"),
  Type.Literal("episode"),
  Type.Literal("size"),
  Type.Literal("duration"),
])
export type DanmakuMatchField = Static<typeof DanmakuMatchFieldSchema>

export const DanmakuMatchEvidenceStatusSchema = Type.Union([
  Type.Literal("matched"),
  Type.Literal("mismatched"),
  Type.Literal("missing"),
  Type.Literal("unavailable"),
])
export type DanmakuMatchEvidenceStatus = Static<typeof DanmakuMatchEvidenceStatusSchema>

export const DanmakuMatchContributionSchema = Type.Object(
  {
    field: DanmakuMatchFieldSchema,
    status: DanmakuMatchEvidenceStatusSchema,
    weight: Type.Number({ minimum: 0 }),
    points: Type.Number({ minimum: 0 }),
    detail: Type.String({ maxLength: 512 }),
  },
  { additionalProperties: false },
)
export type DanmakuMatchContribution = Static<typeof DanmakuMatchContributionSchema>

// Algorithmic episode candidates are deliberately separate from playable
// DanmakuCandidate tracks. They expose explainable evidence but can never be
// treated as a confirmed association by a client or route.
export const DanmakuEpisodeMatchCandidateSchema = Type.Object(
  {
    releaseId: Type.String({ minLength: 1 }),
    episodeId: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1, maxLength: 512 }),
    season: Type.Optional(Type.Integer({ minimum: 0 })),
    episode: Type.Optional(Type.Integer({ minimum: 0 })),
    score: Type.Number({ minimum: 0, maximum: 100 }),
    confidence: DanmakuMatchConfidenceSchema,
    requiresConfirmation: Type.Literal(true),
    evidence: Type.Array(DanmakuEvidenceSchema, { minItems: 1, maxItems: 32 }),
    contributions: Type.Array(DanmakuMatchContributionSchema, { minItems: 1, maxItems: 16 }),
    mismatches: Type.Array(Type.String({ maxLength: 512 }), { maxItems: 16 }),
    warnings: Type.Array(Type.String({ maxLength: 128 }), { maxItems: 16 }),
  },
  { additionalProperties: false },
)
export type DanmakuEpisodeMatchCandidate = Static<typeof DanmakuEpisodeMatchCandidateSchema>

// One selected track is a viewer-local presentation decision. A room default
// uses the same candidate identity but is broadcast separately as a snapshot.
export const DanmakuSelectionSchema = Type.Object(
  {
    enmokuId: Type.String({ minLength: 1 }),
    candidateId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    trackId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    revisionId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    sourceClass: Type.Optional(DanmakuSourceClassSchema),
    updatedAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type DanmakuSelection = Static<typeof DanmakuSelectionSchema>

// A default entry is intentionally small and safe to broadcast. The room
// snapshot carries all Enmoku defaults so a late joiner never needs to infer
// state from the order of incremental updates.
export const DanmakuDefaultSchema = Type.Object(
  {
    enmokuId: Type.String({ minLength: 1 }),
    trackId: Type.String({ minLength: 1 }),
    revisionId: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
    sourceClass: Type.Optional(DanmakuSourceClassSchema),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 256 })),
    availability: DanmakuCandidateAvailabilitySchema,
    updatedAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type DanmakuDefault = Static<typeof DanmakuDefaultSchema>

export const DanmakuDefaultSnapshotSchema = Type.Object(
  {
    bushitsuId: Type.String({ minLength: 1 }),
    defaults: Type.Array(DanmakuDefaultSchema),
  },
  { additionalProperties: false },
)
export type DanmakuDefaultSnapshot = Static<typeof DanmakuDefaultSnapshotSchema>
export const DanmakuSelectionSnapshotSchema = DanmakuDefaultSnapshotSchema
export type DanmakuSelectionSnapshot = DanmakuDefaultSnapshot

// Candidate REST reads return policy and the current room default together so
// browser precedence is explainable even when a socket update races the read.
export const DanmakuCandidateResolutionSchema = Type.Object(
  {
    bushitsuId: Type.String({ minLength: 1 }),
    enmokuId: Type.String({ minLength: 1 }),
    policy: DanmakuSourcePolicySchema,
    candidates: Type.Array(DanmakuCandidateSchema),
    matchCandidates: Type.Optional(Type.Array(DanmakuEpisodeMatchCandidateSchema)),
    roomDefault: Type.Union([DanmakuDefaultSchema, Type.Null()]),
  },
  { additionalProperties: false },
)
export type DanmakuCandidateResolution = Static<typeof DanmakuCandidateResolutionSchema>
export const DanmakuResolutionSchema = DanmakuCandidateResolutionSchema
export type DanmakuResolution = DanmakuCandidateResolution

export const KomonGrantSchema = Type.Object(
  {
    id: Type.String(),
    seitoId: Type.String(),
    grantedAt: Type.Number(),
    grantedBy: Type.Optional(Type.String()),
    revokedAt: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
)
export type KomonGrant = Static<typeof KomonGrantSchema>
