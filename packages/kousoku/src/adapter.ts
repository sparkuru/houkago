import { type Static, Type } from "@sinclair/typebox"

export const HOUKAGO_ADAPTER_PROTOCOL_VERSION = 1
export const HOUKAGO_ADAPTER_PAGE_SOURCE = "houkago-page" as const
export const HOUKAGO_ADAPTER_CLIENT_SOURCE = "houkago-adapter" as const
export const BAIDU_ACCOUNT_USER_HELD_CAPABILITY = "baidu.account.user-held" as const
export const BAIDU_FILES_READ_CAPABILITY = "baidu.files.read" as const
export const BAIDU_MEDIA_HEADERS_CAPABILITY = "baidu.media.request-headers" as const
export const BAIDU_MEDIA_FINGERPRINT_CAPABILITY = "baidu.media.fingerprint" as const
export const BAIDU_MEDIA_FINGERPRINT_MAX_BYTES = 16 * 1024 * 1024

export const BaiduRetentionModeSchema = Type.Union([
  Type.Literal("server-saved"),
  Type.Literal("user-held"),
])
export type BaiduRetentionMode = Static<typeof BaiduRetentionModeSchema>

export const AdapterBrowserSchema = Type.Union([
  Type.Literal("firefox"),
  Type.Literal("chromium"),
  Type.Literal("unknown"),
])
export type AdapterBrowser = Static<typeof AdapterBrowserSchema>

export const AdapterCapabilityUnavailableReasonSchema = Type.Union([
  Type.Literal("not-paired"),
  Type.Literal("not-connected"),
  Type.Literal("permission-denied"),
  Type.Literal("unsupported-browser"),
  Type.Literal("incompatible-version"),
])

export const AdapterCapabilitySchema = Type.Union([
  Type.Object(
    {
      id: Type.String({ minLength: 1 }),
      schemaVersion: Type.Integer({ minimum: 1 }),
      ready: Type.Literal(true),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      id: Type.String({ minLength: 1 }),
      schemaVersion: Type.Integer({ minimum: 1 }),
      ready: Type.Literal(false),
      reason: AdapterCapabilityUnavailableReasonSchema,
    },
    { additionalProperties: false },
  ),
])
export type AdapterCapability = Static<typeof AdapterCapabilitySchema>

export const AdapterHelloSchema = Type.Object(
  {
    protocolVersion: Type.Literal(HOUKAGO_ADAPTER_PROTOCOL_VERSION),
    clientVersion: Type.String({ minLength: 1 }),
    browser: AdapterBrowserSchema,
    deviceId: Type.String({ minLength: 16 }),
    capabilities: Type.Array(AdapterCapabilitySchema),
  },
  { additionalProperties: false },
)
export type AdapterHello = Static<typeof AdapterHelloSchema>

export const BaiduMediaFingerprintSchema = Type.Object(
  {
    algorithm: Type.Literal("md5"),
    scope: Type.Literal("prefix"),
    bytes: Type.Integer({ minimum: 1, maximum: BAIDU_MEDIA_FINGERPRINT_MAX_BYTES }),
    value: Type.String({ pattern: "^[0-9a-f]{32}$" }),
  },
  { additionalProperties: false },
)
export type BaiduMediaFingerprint = Static<typeof BaiduMediaFingerprintSchema>

export const BaiduFileEntrySchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    path: Type.String(),
    isDirectory: Type.Boolean(),
    size: Type.Optional(Type.Number({ minimum: 0 })),
    modifiedAt: Type.Optional(Type.Number({ minimum: 0 })),
    mediaType: Type.Union([Type.Literal("video"), Type.Literal("unsupported")]),
  },
  { additionalProperties: false },
)
export type BaiduFileEntry = Static<typeof BaiduFileEntrySchema>

export const BaiduDirectoryPageSchema = Type.Object(
  {
    path: Type.String(),
    entries: Type.Array(BaiduFileEntrySchema),
    cursor: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
)
export type BaiduDirectoryPage = Static<typeof BaiduDirectoryPageSchema>

export const BaiduConnectionStatusSchema = Type.Object(
  {
    enabled: Type.Boolean(),
    serverSavedEnabled: Type.Boolean(),
    connected: Type.Boolean(),
    retentionMode: Type.Optional(BaiduRetentionModeSchema),
    accountName: Type.Optional(Type.String()),
    adaptorOnline: Type.Boolean(),
    reason: Type.Optional(
      Type.Union([
        Type.Literal("config-missing"),
        Type.Literal("encryption-key-missing"),
        Type.Literal("adaptor-offline"),
        Type.Literal("reconnect-required"),
      ]),
    ),
  },
  { additionalProperties: false },
)
export type BaiduConnectionStatus = Static<typeof BaiduConnectionStatusSchema>

export const BaiduSourceAvailabilitySchema = Type.Object(
  {
    sourceId: Type.String({ minLength: 1 }),
    mode: BaiduRetentionModeSchema,
    ownerOnline: Type.Boolean(),
    playable: Type.Boolean(),
    reason: Type.Optional(
      Type.Union([
        Type.Literal("connection-revoked"),
        Type.Literal("owner-offline"),
        Type.Literal("source-missing"),
      ]),
    ),
  },
  { additionalProperties: false },
)
export type BaiduSourceAvailability = Static<typeof BaiduSourceAvailabilitySchema>

const PageEnvelope = {
  source: Type.Literal(HOUKAGO_ADAPTER_PAGE_SOURCE),
  protocolVersion: Type.Literal(HOUKAGO_ADAPTER_PROTOCOL_VERSION),
  nonce: Type.String({ minLength: 16 }),
}

export const AdapterPageRequestSchema = Type.Union([
  Type.Object({ ...PageEnvelope, type: Type.Literal("HELLO") }, { additionalProperties: false }),
  Type.Object(
    {
      ...PageEnvelope,
      type: Type.Literal("PAIR"),
      serverBase: Type.String({ minLength: 1 }),
      pairingCode: Type.String({ minLength: 16 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PageEnvelope,
      type: Type.Literal("OAUTH_HANDOFF"),
      serverBase: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PageEnvelope,
      type: Type.Literal("BAIDU_LIST"),
      path: Type.String(),
      cursor: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PageEnvelope,
      type: Type.Literal("BAIDU_PERMIT"),
      sourceId: Type.String({ minLength: 1 }),
      bushitsuId: Type.String({ minLength: 1 }),
      upstreamHandle: Type.String({ minLength: 1 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PageEnvelope,
      type: Type.Literal("BAIDU_MEDIA_PREPARE"),
      grantUrl: Type.String({ minLength: 1 }),
      expiresAt: Type.Number(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...PageEnvelope,
      type: Type.Literal("BAIDU_MEDIA_FINGERPRINT"),
      sourceId: Type.String({ minLength: 1 }),
      bushitsuId: Type.String({ minLength: 1 }),
      grantUrl: Type.String({ minLength: 1 }),
      expiresAt: Type.Number({ minimum: 0 }),
      bytes: Type.Integer({ minimum: 1, maximum: BAIDU_MEDIA_FINGERPRINT_MAX_BYTES }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...PageEnvelope, type: Type.Literal("BAIDU_REVOKE") },
    { additionalProperties: false },
  ),
])
export type AdapterPageRequest = Static<typeof AdapterPageRequestSchema>

const ClientEnvelope = {
  source: Type.Literal(HOUKAGO_ADAPTER_CLIENT_SOURCE),
  protocolVersion: Type.Literal(HOUKAGO_ADAPTER_PROTOCOL_VERSION),
  nonce: Type.String({ minLength: 16 }),
}

export const AdapterPageResponseSchema = Type.Union([
  Type.Object(
    {
      ...ClientEnvelope,
      type: Type.Literal("HELLO"),
      ok: Type.Literal(true),
      data: AdapterHelloSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { ...ClientEnvelope, type: Type.Literal("RESULT"), ok: Type.Literal(true) },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...ClientEnvelope,
      type: Type.Literal("BAIDU_LIST_RESULT"),
      ok: Type.Literal(true),
      data: BaiduDirectoryPageSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...ClientEnvelope,
      type: Type.Literal("BAIDU_MEDIA_FINGERPRINT_RESULT"),
      ok: Type.Literal(true),
      data: BaiduMediaFingerprintSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      ...ClientEnvelope,
      type: Type.Literal("ERROR"),
      ok: Type.Literal(false),
      error: Type.Object(
        { code: Type.String({ minLength: 1 }), message: Type.String({ minLength: 1 }) },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
])
export type AdapterPageResponse = Static<typeof AdapterPageResponseSchema>

export const BaiduDlinkFailureReasonSchema = Type.Literal("upstream-resolution-failed")
export type BaiduDlinkFailureReason = Static<typeof BaiduDlinkFailureReasonSchema>

export const BaiduPlaybackGrantSchema = Type.Union([
  Type.Object(
    {
      state: Type.Literal("pending"),
      requestId: Type.String({ minLength: 16 }),
      expiresAt: Type.Number(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      state: Type.Literal("ready"),
      grantUrl: Type.String({ minLength: 1 }),
      expiresAt: Type.Number(),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      state: Type.Literal("failed"),
      reason: BaiduDlinkFailureReasonSchema,
    },
    { additionalProperties: false },
  ),
])
export type BaiduPlaybackGrant = Static<typeof BaiduPlaybackGrantSchema>
