import { type Static, type TObject, Type } from "@sinclair/typebox"
import { EnmokuSchema, ShinkouSchema, YakuwariSchema } from "./domain"

// 権限（kengen）: room-level guest permission snapshot (prd role-permissions §1).
// One switch per controllable action; the 部長 is always allowed regardless of
// these flags (server-side canDo gate). Reused for both KENGEN(S→C, current
// snapshot) and SETTEI(C→S, host sets) so the wire shape is one source.
export const KengenSchema = Type.Object({
  playback: Type.Boolean(), // guest may drive SHINKOU/JOUEI
  chat: Type.Boolean(), // guest may send OSHABERI/DANMAKU
  playlist: Type.Boolean(), // guest may pick the source (manual URL)
})
export type Kengen = Static<typeof KengenSchema>

// 入室制御（nyuushitsu）: room-level admission policy. The room may keep running
// while the 部長 is offline; approval-mode guests wait in a pending queue until
// the 部長 returns and decides.
export const NyuushitsuModeSchema = Type.Union([
  Type.Literal("open"),
  Type.Literal("approval"),
  Type.Literal("closed"),
])
export type NyuushitsuMode = Static<typeof NyuushitsuModeSchema>

export const NyuushitsuStatusSchema = Type.Union([
  Type.Literal("entered"),
  Type.Literal("waiting"),
  Type.Literal("rejected"),
  Type.Literal("closed"),
])
export type NyuushitsuStatus = Static<typeof NyuushitsuStatusSchema>

export const NyuushitsuRequestSchema = Type.Object({
  senderId: Type.String(),
  nickname: Type.String(),
  requestedAt: Type.Number(),
})
export type NyuushitsuRequest = Static<typeof NyuushitsuRequestSchema>

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
// 出席（shusseki）: presence full snapshot — count + roster (id→nickname名簿).
// Each member carries its yakuwari (部長 vs ゲスト) so the client can label roles
// and branch UI gating (prd role-permissions §1).
export const ShussekiSchema = envelope(
  "SHUSSEKI",
  Type.Object({
    n: Type.Number(),
    members: Type.Array(
      Type.Object({ id: Type.String(), nickname: Type.String(), yakuwari: YakuwariSchema }),
    ),
  }),
)
export const KeihouSchema = envelope("KEIHOU", Type.Object({ message: Type.String() }))

// --- S→C: 権限 (current room permission snapshot) / C→S: 設定 (host sets it) ---
// KENGEN broadcasts the room's guest-permission snapshot: sent to a new joiner on
// open and re-broadcast to the whole room when the host changes it. SETTEI is the
// host-only request to change it (server enforces senderId===buchouId).
export const KengenMsgSchema = envelope("KENGEN", KengenSchema)
export const SetteiSchema = envelope("SETTEI", KengenSchema)

// --- S→C: 入室状態 / C→S: 入室設定・承認判定 ---
export const NyuushitsuSchema = envelope(
  "NYUUSHITSU",
  Type.Object({
    mode: NyuushitsuModeSchema,
    status: NyuushitsuStatusSchema,
    pending: Type.Array(NyuushitsuRequestSchema),
  }),
)
export const NyuushitsuSetteiSchema = envelope(
  "NYUUSHITSU_SETTEI",
  Type.Object({ mode: NyuushitsuModeSchema }),
)
export const NyuushitsuHanteiSchema = envelope(
  "NYUUSHITSU_HANTEI",
  Type.Object({
    senderId: Type.String(),
    approved: Type.Boolean(),
  }),
)

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
  KengenMsgSchema,
  SetteiSchema,
  NyuushitsuSchema,
  NyuushitsuSetteiSchema,
  NyuushitsuHanteiSchema,
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
export type KengenMsg = Static<typeof KengenMsgSchema>
export type Settei = Static<typeof SetteiSchema>
export type Nyuushitsu = Static<typeof NyuushitsuSchema>
export type NyuushitsuSettei = Static<typeof NyuushitsuSetteiSchema>
export type NyuushitsuHantei = Static<typeof NyuushitsuHanteiSchema>

// Discriminating string-literal union of all message type tags.
export type KousokuMessageType = KousokuMessage["type"]
