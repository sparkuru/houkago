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
