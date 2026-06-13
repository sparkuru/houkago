import { type Static, type TObject, Type } from "@sinclair/typebox"
import { EnmokuSchema, ShinkouSchema } from "./domain"

// WS envelope (design §4): { type, ts, senderId, payload }.
// Every message type is its own envelope schema so TypeBox validation on housou
// discriminates on the `type` literal and the frontend gets a narrowable union.

const envelope = <TType extends string, TPayload extends TObject>(type: TType, payload: TPayload) =>
  Type.Object({
    type: Type.Literal(type),
    ts: Type.Number(), // server wall-clock epoch ms (server-stamped on S→C)
    senderId: Type.String(), // buin id, or "server" for S→C messages
    payload,
  })

// --- C→S: 入部 / 退部 ---
export const NyuubuSchema = envelope("NYUUBU", Type.Object({ nickname: Type.String() }))
export const TaibuSchema = envelope("TAIBU", Type.Object({}))

// --- C↔S: お喋り / 弾幕 ---
export const OshaberiSchema = envelope("OSHABERI", Type.Object({ content: Type.String() }))
export const DanmakuSchema = envelope(
  "DANMAKU",
  Type.Object({
    content: Type.String(),
    color: Type.Optional(Type.String()),
    mode: Type.Optional(Type.String()),
  }),
)

// --- C↔S: 進行（sync primitive）/ 点呼（heartbeat）---
export const ShinkouMsgSchema = envelope("SHINKOU", ShinkouSchema)
export const TenkoSchema = envelope("TENKO", Type.Object({ currentTime: Type.Number() }))

// --- C→S: 追いかけ（late-joiner asks for authority state）---
export const OikakeSchema = envelope("OIKAKE", Type.Object({}))

// --- S→C: 現状 / 上映中 / 番組表 / 出席数 / 警報 ---
export const GenjouSchema = envelope(
  "GENJOU",
  Type.Object({
    enmokuId: Type.Union([Type.String(), Type.Null()]),
    shinkou: ShinkouSchema,
    serverTime: Type.Number(), // shinkouServerTime for projected-progress math (design §5)
  }),
)
export const JoueiSchema = envelope("JOUEI", Type.Object({ enmokuId: Type.String() }))
export const BangumiSchema = envelope("BANGUMI", Type.Object({ enmoku: Type.Array(EnmokuSchema) }))
export const ShussekiSchema = envelope("SHUSSEKI", Type.Object({ n: Type.Number() }))
export const KeihouSchema = envelope("KEIHOU", Type.Object({ message: Type.String() }))

// Full discriminated union — single source of truth for the WS protocol.
export const KousokuMessageSchema = Type.Union([
  NyuubuSchema,
  TaibuSchema,
  OshaberiSchema,
  DanmakuSchema,
  ShinkouMsgSchema,
  TenkoSchema,
  OikakeSchema,
  GenjouSchema,
  JoueiSchema,
  BangumiSchema,
  ShussekiSchema,
  KeihouSchema,
])
export type KousokuMessage = Static<typeof KousokuMessageSchema>

export type Nyuubu = Static<typeof NyuubuSchema>
export type Taibu = Static<typeof TaibuSchema>
export type Oshaberi = Static<typeof OshaberiSchema>
export type Danmaku = Static<typeof DanmakuSchema>
export type ShinkouMsg = Static<typeof ShinkouMsgSchema>
export type Tenko = Static<typeof TenkoSchema>
export type Oikake = Static<typeof OikakeSchema>
export type Genjou = Static<typeof GenjouSchema>
export type Jouei = Static<typeof JoueiSchema>
export type Bangumi = Static<typeof BangumiSchema>
export type Shusseki = Static<typeof ShussekiSchema>
export type Keihou = Static<typeof KeihouSchema>

// Discriminating string-literal union of all message type tags.
export type KousokuMessageType = KousokuMessage["type"]
