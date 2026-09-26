import { type Static, Type } from "@sinclair/typebox"
import { BaiduDlinkFailureReasonSchema, BaiduRetentionModeSchema } from "./adapter"
import { EnmokuTypeSchema } from "./domain"

// Shared HTTP shapes. Runtime errors are still produced by housou's central
// handler; keeping the schema here lets every transport boundary describe the
// same wire contract without importing the server application.
export const HttpErrorSchema = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String({ minLength: 1 }),
        message: Type.String(),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)
export type HttpError = Static<typeof HttpErrorSchema>

export const HttpOkSchema = Type.Object({ ok: Type.Literal(true) }, { additionalProperties: false })
export type HttpOk = Static<typeof HttpOkSchema>

export const HttpClearPendingSchema = Type.Object(
  {
    ok: Type.Literal(true),
    removed: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
)
export type HttpClearPending = Static<typeof HttpClearPendingSchema>

export const HttpPreviewEnmokuSchema = Type.Object(
  {
    state: Type.Literal("ready"),
    title: Type.String(),
    type: EnmokuTypeSchema,
    provider: Type.Optional(
      Type.Object(
        {
          kind: Type.Literal("bilibili"),
          ownerName: Type.Optional(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    sourceCount: Type.Optional(Type.Integer({ minimum: 0 })),
    subtitleCount: Type.Optional(Type.Integer({ minimum: 0 })),
    live: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
)
export type HttpPreviewEnmoku = Static<typeof HttpPreviewEnmokuSchema>

export const HttpBaiduOAuthStartSchema = Type.Object(
  {
    authorizationUrl: Type.String({ minLength: 1 }),
    expiresAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type HttpBaiduOAuthStart = Static<typeof HttpBaiduOAuthStartSchema>

export const HttpBaiduPairingSchema = Type.Union([
  Type.Object({ state: Type.Literal("paired") }, { additionalProperties: false }),
  Type.Object(
    {
      state: Type.Literal("pairing-required"),
      pairingCode: Type.String({ minLength: 16 }),
      expiresAt: Type.Number(),
    },
    { additionalProperties: false },
  ),
])
export type HttpBaiduPairing = Static<typeof HttpBaiduPairingSchema>

export const HttpAdaptorTokenSchema = Type.Object(
  {
    adaptorToken: Type.String({ minLength: 1 }),
    expiresAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type HttpAdaptorToken = Static<typeof HttpAdaptorTokenSchema>

export const HttpBaiduTokenBundleSchema = Type.Object(
  {
    accessToken: Type.String({ minLength: 1 }),
    refreshToken: Type.String({ minLength: 1 }),
    expiresAt: Type.Number(),
    scope: Type.Array(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
)
export type HttpBaiduTokenBundle = Static<typeof HttpBaiduTokenBundleSchema>

export const HttpBaiduDlinkRequestSchema = Type.Object(
  {
    requestId: Type.String({ minLength: 16 }),
    nonce: Type.String({ minLength: 16 }),
    sourceId: Type.String({ minLength: 1 }),
    bushitsuId: Type.String({ minLength: 1 }),
    expiresAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type HttpBaiduDlinkRequest = Static<typeof HttpBaiduDlinkRequestSchema>

export const HttpBaiduDlinkResponseSchema = Type.Union([
  Type.Object(
    {
      requestId: Type.String({ minLength: 16 }),
      nonce: Type.String({ minLength: 16 }),
      dlink: Type.String({ minLength: 1 }),
      expiresAt: Type.Number(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      requestId: Type.String({ minLength: 16 }),
      nonce: Type.String({ minLength: 16 }),
      failure: BaiduDlinkFailureReasonSchema,
    },
    { additionalProperties: false },
  ),
])
export type HttpBaiduDlinkResponse = Static<typeof HttpBaiduDlinkResponseSchema>

export const HttpBaiduAdaptorGrantSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    sourceId: Type.String({ minLength: 1 }),
    bushitsuId: Type.String({ minLength: 1 }),
    sentinelUrl: Type.String({ minLength: 1 }),
    dlink: Type.String({ minLength: 1 }),
    expiresAt: Type.Number(),
  },
  { additionalProperties: false },
)
export type HttpBaiduAdaptorGrant = Static<typeof HttpBaiduAdaptorGrantSchema>

export const HttpHtmlSchema = Type.String()
export const HttpMediaSchema = Type.Any()

export const HttpBaiduOAuthStartBodySchema = Type.Object(
  {
    retentionMode: BaiduRetentionModeSchema,
    deviceId: Type.Optional(Type.String({ minLength: 16, maxLength: 256 })),
  },
  { additionalProperties: false },
)
