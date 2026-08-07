import { Elysia, t } from "elysia"
import {
  BaiduDlinkFailureReasonSchema,
  BaiduRetentionModeSchema,
  type BaiduSourceAvailability,
} from "houkago-kousoku"
import { getBaiduConnection, getBaiduSource } from "../db/queries/baidu"
import {
  baiduConnectionStatus,
  cancelBaiduForRoomSeito,
  claimBaiduMediaGrant,
  completeBaiduOAuth,
  completePendingBaiduDlink,
  consumeBaiduHandoff,
  createBaiduPairing,
  createBaiduSource,
  disconnectBaiduAdaptor,
  isBaiduAdaptorDeviceOnline,
  listPendingBaiduDlinks,
  listSavedBaiduFiles,
  pollBaiduPlaybackGrant,
  redeemBaiduPairing,
  refreshUserHeldBaiduToken,
  requestBaiduPlaybackGrant,
  requireBaiduAdaptor,
  revokeBaiduConnection,
  startBaiduOAuth,
} from "../lib/baidu"
import { BaiduAdaptorRequired, BaiduSourceNotFound, Forbidden } from "../lib/errors"
import { requireTrustedOrigin } from "../lib/origin"
import { seitoFromRequest } from "../lib/seitoshou"
import { isPresent } from "../ws/housou"
import { authorizePlaylistMutation, broadcastBangumi } from "./bushitsu"

const DeviceId = t.String({ minLength: 16, maxLength: 256 })

export const baiduRoutes = new Elysia({ prefix: "/baidu" })
  .get("/status", ({ request }) => baiduConnectionStatus(seitoFromRequest(request).id))
  .post(
    "/oauth/start",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return startBaiduOAuth(seitoFromRequest(request).id, body.retentionMode, body.deviceId)
    },
    {
      body: t.Object(
        { retentionMode: BaiduRetentionModeSchema, deviceId: t.Optional(DeviceId) },
        { additionalProperties: false },
      ),
    },
  )
  .get(
    "/oauth/callback",
    async ({ query }) => {
      await completeBaiduOAuth(query.code, query.state)
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Houkago</title><p>Authorization complete. You may close this window.</p><script>window.close()</script>',
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      )
    },
    {
      query: t.Object(
        { code: t.String({ minLength: 1 }), state: t.String({ minLength: 16 }) },
        { additionalProperties: false },
      ),
    },
  )
  .delete("/connection", ({ request }) => {
    requireTrustedOrigin(request.headers.get("origin"))
    revokeBaiduConnection(seitoFromRequest(request).id)
    return { ok: true as const }
  })
  .post(
    "/adaptor/pairing",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return createBaiduPairing(seitoFromRequest(request).id, body.deviceId, body.localPaired)
    },
    {
      body: t.Object(
        { deviceId: DeviceId, localPaired: t.Boolean() },
        { additionalProperties: false },
      ),
    },
  )
  .post("/adaptor/pair", ({ body }) => redeemBaiduPairing(body.pairingCode, body.deviceId), {
    body: t.Object(
      { pairingCode: t.String({ minLength: 16 }), deviceId: DeviceId },
      { additionalProperties: false },
    ),
  })
  .post("/adaptor/heartbeat", ({ request }) => {
    requireBaiduAdaptor(request)
    return { ok: true as const }
  })
  .delete("/adaptor/session", ({ request }) => {
    disconnectBaiduAdaptor(requireBaiduAdaptor(request))
    return { ok: true as const }
  })
  .post("/adaptor/oauth/handoff", ({ request }) =>
    consumeBaiduHandoff(requireBaiduAdaptor(request)),
  )
  .post(
    "/adaptor/oauth/refresh",
    ({ request, body }) =>
      refreshUserHeldBaiduToken(requireBaiduAdaptor(request), body.refreshToken),
    {
      body: t.Object({ refreshToken: t.String({ minLength: 1 }) }, { additionalProperties: false }),
    },
  )
  .get("/adaptor/dlink-requests", ({ request }) =>
    listPendingBaiduDlinks(requireBaiduAdaptor(request)),
  )
  .post(
    "/adaptor/dlink-responses",
    ({ request, body }) => completePendingBaiduDlink(requireBaiduAdaptor(request), body),
    {
      body: t.Union([
        t.Object(
          {
            requestId: t.String({ minLength: 16 }),
            nonce: t.String({ minLength: 16 }),
            dlink: t.String({ minLength: 1 }),
            expiresAt: t.Number(),
          },
          { additionalProperties: false },
        ),
        t.Object(
          {
            requestId: t.String({ minLength: 16 }),
            nonce: t.String({ minLength: 16 }),
            failure: BaiduDlinkFailureReasonSchema,
          },
          { additionalProperties: false },
        ),
      ]),
    },
  )
  .get("/adaptor/grants/:grantId", ({ request, params }) =>
    claimBaiduMediaGrant(requireBaiduAdaptor(request), params.grantId, request.url),
  )
  .post(
    "/files/list",
    ({ request, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return listSavedBaiduFiles(seitoFromRequest(request).id, body.path, body.cursor)
    },
    {
      body: t.Object(
        { path: t.String(), cursor: t.Optional(t.String()) },
        { additionalProperties: false },
      ),
    },
  )
  .post(
    "/sources",
    async ({ request, body }) => {
      const actor = authorizePlaylistMutation(request, body.bushitsuId)
      const enmoku = await createBaiduSource(actor, body)
      broadcastBangumi(body.bushitsuId)
      return enmoku
    },
    {
      body: t.Object(
        {
          bushitsuId: t.String({ minLength: 1 }),
          fileId: t.String({ minLength: 1 }),
          fileName: t.String({ minLength: 1 }),
          size: t.Optional(t.Number({ minimum: 0 })),
          upstreamHandle: t.Optional(t.String({ minLength: 1 })),
        },
        { additionalProperties: false },
      ),
    },
  )
  .get(
    "/sources/:sourceId/availability",
    ({ request, params, query }) => sourceAvailability(request, params.sourceId, query.bushitsuId),
    { query: t.Object({ bushitsuId: t.String({ minLength: 1 }) }) },
  )
  .post(
    "/sources/:sourceId/grants",
    ({ request, params, body }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      const viewer = seitoFromRequest(request)
      return requestBaiduPlaybackGrant(viewer.id, params.sourceId, body.bushitsuId, request.url)
    },
    {
      body: t.Object({ bushitsuId: t.String({ minLength: 1 }) }, { additionalProperties: false }),
    },
  )
  .get("/grants/:requestId", ({ request, params }) =>
    pollBaiduPlaybackGrant(seitoFromRequest(request).id, params.requestId, request.url),
  )
  .get("/media/:grantId", () => {
    throw new BaiduAdaptorRequired("desktop adaptor interception is required")
  })

function sourceAvailability(
  request: Request,
  sourceId: string,
  bushitsuId: string,
): BaiduSourceAvailability {
  const viewer = seitoFromRequest(request)
  if (!isPresent(bushitsuId, viewer.id)) throw new Forbidden("room admission is required")
  const source = getBaiduSource(sourceId)
  if (!source || source.bushitsuId !== bushitsuId)
    throw new BaiduSourceNotFound("Baidu source not found")
  const connection = getBaiduConnection(source.ownerSeitoId)
  const ownerOnline = isPresent(bushitsuId, source.ownerSeitoId)
  if (
    !connection ||
    connection.needsReconnect ||
    connection.authorizationId !== source.authorizationId ||
    connection.retentionMode !== source.retentionMode ||
    (source.retentionMode === "user-held" && connection.adaptorDeviceId !== source.adaptorDeviceId)
  ) {
    return {
      sourceId,
      mode: source.retentionMode,
      ownerOnline,
      playable: false,
      reason: "connection-revoked" as const,
    }
  }
  if (source.retentionMode === "user-held") {
    const playable =
      ownerOnline && isBaiduAdaptorDeviceOnline(source.ownerSeitoId, source.adaptorDeviceId)
    return {
      sourceId,
      mode: source.retentionMode,
      ownerOnline,
      playable,
      reason: playable ? undefined : ("owner-offline" as const),
    }
  }
  return { sourceId, mode: source.retentionMode, ownerOnline, playable: true }
}

export function baiduRoomSeitoDisconnected(bushitsuId: string, seitoId: string): void {
  cancelBaiduForRoomSeito(bushitsuId, seitoId)
}
