import { Value } from "@sinclair/typebox/value"
import { type BaiduTokenBundle, listBaiduDirectory } from "houkago-eisha/baidu"
import {
  type AdapterBrowser,
  type AdapterPageRequest,
  AdapterPageRequestSchema,
  type AdapterPageResponse,
  type BaiduDlinkFailureReason,
  HOUKAGO_ADAPTER_CLIENT_SOURCE,
  HOUKAGO_ADAPTER_PROTOCOL_VERSION,
} from "houkago-kousoku"
import { adapterHello } from "./capabilities"
import type { BaiduDlinkResolver } from "./dlink-exchange"
import { extensionOriginPattern, isAllowedPageOrigin, validatedServerBase } from "./host-policy"
import { BaiduPermitStore } from "./permits"
import { BaiduSelectionRegistry } from "./selections"
import type { AdapterStorage } from "./types"

const PAIRING_KEY = "adapter.pairing"
const TOKEN_KEY = "baidu.token"
const DEVICE_KEY = "adapter.device-id"
const DLINK_RESOLUTION_FAILURE: BaiduDlinkFailureReason = "upstream-resolution-failed"

type Pairing = { serverBase: string; adaptorToken: string }

export type RuntimeMediaGrant = {
  id: string
  tabId: number
  sentinelUrl: string
  dlink: string
  expiresAt: number
}

export type AdapterRuntimeOptions = {
  browser: AdapterBrowser
  storage: AdapterStorage
  expectedPageOrigin?: string
  expectedServerOrigin?: string
  requestServerOrigin(pattern: string): Promise<boolean>
  onPaired(serverBase: string): Promise<void> | void
  installGrant(grant: RuntimeMediaGrant): Promise<void> | void
  revokeGrants(): Promise<void> | void
  resolveDlink: BaiduDlinkResolver
  warn?(message: string): void
}

export type AdapterRuntime = {
  handle(message: unknown, pageUrl: string | undefined, tabId: number | undefined): Promise<unknown>
  poll(): Promise<void>
}

export function createAdapterRuntime(options: AdapterRuntimeOptions): AdapterRuntime {
  const permits = new BaiduPermitStore(options.storage)
  const selections = new BaiduSelectionRegistry()
  let sessionToken: BaiduTokenBundle | null = null
  const warn = options.warn ?? console.warn

  async function handle(
    message: unknown,
    pageUrl: string | undefined,
    tabId: number | undefined,
  ): Promise<unknown> {
    if (!Value.Check(AdapterPageRequestSchema, message)) return undefined
    const request = message as AdapterPageRequest
    try {
      const pageOrigin = pageUrl ? new URL(pageUrl).origin : ""
      if (!isAllowedPageOrigin(pageOrigin, options.expectedPageOrigin)) {
        throw new Error("page origin denied")
      }
      return await handleRequest(request, pageOrigin, tabId)
    } catch (error) {
      return errorResponse(request.nonce, publicError(error))
    }
  }

  async function handleRequest(
    request: AdapterPageRequest,
    pageOrigin: string,
    tabId: number | undefined,
  ): Promise<AdapterPageResponse> {
    switch (request.type) {
      case "HELLO": {
        const pairing = await readPairing()
        return {
          source: HOUKAGO_ADAPTER_CLIENT_SOURCE,
          protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
          nonce: request.nonce,
          type: "HELLO",
          ok: true,
          data: adapterHello(options.browser, await deviceId(), !!pairing),
        }
      }
      case "PAIR": {
        const serverBase = validatedServerBase(
          request.serverBase,
          pageOrigin,
          options.expectedPageOrigin,
          options.expectedServerOrigin,
        )
        if (!serverBase) throw new Error("server origin denied")
        if (!(await options.requestServerOrigin(extensionOriginPattern(serverBase)))) {
          throw new Error("server permission denied")
        }
        const response = await fetch(`${serverBase}/baidu/adaptor/pair`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pairingCode: request.pairingCode, deviceId: await deviceId() }),
        })
        const body = await responseJson(response)
        const adaptorToken = requiredString(body, "adaptorToken")
        await clearLocalCredentials()
        await options.storage.set(PAIRING_KEY, {
          serverBase,
          adaptorToken,
        } satisfies Pairing)
        await options.onPaired(serverBase)
        return okResponse(request.nonce)
      }
      case "OAUTH_HANDOFF": {
        const pairing = await requirePairing()
        if (
          validatedServerBase(
            request.serverBase,
            pageOrigin,
            options.expectedPageOrigin,
            options.expectedServerOrigin,
          ) !== pairing.serverBase
        ) {
          throw new Error("server origin denied")
        }
        const response = await adaptorFetch(pairing, "/baidu/adaptor/oauth/handoff", {
          method: "POST",
        })
        selections.clear()
        await persistToken(parseTokenBundle(await responseJson(response)))
        return okResponse(request.nonce)
      }
      case "BAIDU_LIST": {
        const token = await freshToken()
        const data = await listBaiduDirectory(token.accessToken, request.path, request.cursor)
        selections.record(data.entries)
        return {
          source: HOUKAGO_ADAPTER_CLIENT_SOURCE,
          protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
          nonce: request.nonce,
          type: "BAIDU_LIST_RESULT",
          ok: true,
          data,
        }
      }
      case "BAIDU_PERMIT":
        if (!selections.consume(request.upstreamHandle)) {
          throw new Error("file selection is not permitted")
        }
        await permits.permit({
          sourceId: request.sourceId,
          bushitsuId: request.bushitsuId,
          upstreamHandle: request.upstreamHandle,
        })
        return okResponse(request.nonce)
      case "BAIDU_MEDIA_PREPARE": {
        if (tabId === undefined || tabId < 0) throw new Error("browser tab unavailable")
        const pairing = await requirePairing()
        const grantId = grantIdFromUrl(request.grantUrl, pairing.serverBase)
        if (!grantId) throw new Error("grant sentinel mismatch")
        const response = await adaptorFetch(
          pairing,
          `/baidu/adaptor/grants/${encodeURIComponent(grantId)}`,
        )
        const body = await responseJson(response)
        const sentinelUrl = requiredString(body, "sentinelUrl")
        if (sentinelUrl !== request.grantUrl) throw new Error("grant sentinel mismatch")
        await options.installGrant({
          id: requiredString(body, "id"),
          tabId,
          sentinelUrl,
          dlink: requiredString(body, "dlink"),
          expiresAt: requiredNumber(body, "expiresAt"),
        })
        return okResponse(request.nonce)
      }
      case "BAIDU_MEDIA_FINGERPRINT": {
        if (tabId === undefined || tabId < 0) throw new Error("browser tab unavailable")
        const pairing = await requirePairing()
        const grantId = grantIdFromUrl(request.grantUrl, pairing.serverBase)
        if (!grantId) throw new Error("grant sentinel mismatch")
        const response = await adaptorFetch(
          pairing,
          `/baidu/adaptor/grants/${encodeURIComponent(grantId)}`,
        )
        const body = await responseJson(response)
        const sentinelUrl = requiredString(body, "sentinelUrl")
        if (
          sentinelUrl !== request.grantUrl ||
          requiredString(body, "sourceId") !== request.sourceId ||
          requiredString(body, "bushitsuId") !== request.bushitsuId
        ) {
          throw new Error("grant binding mismatch")
        }
        await options.installGrant({
          id: requiredString(body, "id"),
          tabId,
          sentinelUrl,
          dlink: requiredString(body, "dlink"),
          expiresAt: requiredNumber(body, "expiresAt"),
        })
        return okResponse(request.nonce)
      }
      case "BAIDU_REVOKE": {
        const pairing = await readPairing()
        if (pairing) {
          try {
            await adaptorFetch(pairing, "/baidu/adaptor/session", { method: "DELETE" })
          } catch {
            console.warn("houkago-adapter: remote adaptor session was already unavailable")
          }
        }
        await clearLocalCredentials()
        return okResponse(request.nonce)
      }
    }
  }

  async function poll(): Promise<void> {
    const pairing = await readPairing()
    if (!pairing) return
    await adaptorFetch(pairing, "/baidu/adaptor/heartbeat", { method: "POST" })
    const storedToken = await readToken()
    if (!storedToken) return
    const response = await adaptorFetch(pairing, "/baidu/adaptor/dlink-requests")
    const body = await responseUnknown(response)
    const requests = Array.isArray(body) ? body : []
    for (const value of requests) {
      if (!isRecord(value)) continue
      const requestId = optionalString(value, "requestId")
      const nonce = optionalString(value, "nonce")
      const sourceId = optionalString(value, "sourceId")
      const bushitsuId = optionalString(value, "bushitsuId")
      const expiresAt = value.expiresAt
      if (
        !requestId ||
        !nonce ||
        !sourceId ||
        !bushitsuId ||
        typeof expiresAt !== "number" ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now()
      ) {
        continue
      }
      const permit = await permits.permitted(sourceId, bushitsuId)
      if (!permit) continue
      let token: BaiduTokenBundle
      try {
        token = await freshToken()
      } catch {
        warn("houkago-adapter: Baidu token refresh temporarily unavailable")
        continue
      }
      let dlink: Awaited<ReturnType<BaiduDlinkResolver>>
      try {
        dlink = await options.resolveDlink(token.accessToken, permit.upstreamHandle)
      } catch {
        warn(`houkago-adapter: ${DLINK_RESOLUTION_FAILURE}`)
        try {
          await adaptorFetch(pairing, "/baidu/adaptor/dlink-responses", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ requestId, nonce, failure: DLINK_RESOLUTION_FAILURE }),
          })
        } catch {
          warn("houkago-adapter: resolution failure report unavailable")
        }
        continue
      }
      try {
        await adaptorFetch(pairing, "/baidu/adaptor/dlink-responses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestId,
            nonce,
            dlink: dlink.dlink,
            expiresAt: dlink.expiresAt,
          }),
        })
      } catch {
        warn("houkago-adapter: resolved capability report unavailable")
      }
    }
  }

  async function freshToken(now = Date.now()): Promise<BaiduTokenBundle> {
    const token = await readToken()
    if (!token) throw new Error("Baidu connection required")
    if (token.expiresAt > now + 30_000) return token
    const pairing = await requirePairing()
    const response = await adaptorFetch(pairing, "/baidu/adaptor/oauth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    })
    const refreshed = parseTokenBundle(await responseJson(response))
    await persistToken(refreshed)
    return refreshed
  }

  async function requirePairing(): Promise<Pairing> {
    const pairing = await readPairing()
    if (!pairing) throw new Error("adapter pairing required")
    return pairing
  }

  async function readPairing(): Promise<Pairing | null> {
    const value = await options.storage.get<unknown>(PAIRING_KEY)
    if (!isRecord(value)) return null
    const serverBase = optionalString(value, "serverBase")
    const adaptorToken = optionalString(value, "adaptorToken")
    if (
      !serverBase ||
      !adaptorToken ||
      Object.keys(value).some((key) => !["serverBase", "adaptorToken"].includes(key))
    ) {
      return null
    }
    return { serverBase, adaptorToken }
  }

  async function readToken(): Promise<BaiduTokenBundle | null> {
    if (sessionToken) return sessionToken
    const value = await options.storage.get<unknown>(TOKEN_KEY)
    if (!isRecord(value)) return null
    const refreshToken = optionalString(value, "refreshToken")
    if (
      !refreshToken ||
      !Array.isArray(value.scope) ||
      !value.scope.every((item) => typeof item === "string")
    ) {
      return null
    }
    return { accessToken: "", refreshToken, expiresAt: 0, scope: value.scope }
  }

  async function persistToken(token: BaiduTokenBundle): Promise<void> {
    sessionToken = token
    await options.storage.set(TOKEN_KEY, { refreshToken: token.refreshToken, scope: token.scope })
  }

  async function clearLocalCredentials(): Promise<void> {
    selections.clear()
    sessionToken = null
    const results = await Promise.allSettled([
      Promise.resolve().then(() => options.storage.remove(PAIRING_KEY)),
      Promise.resolve().then(() => options.storage.remove(TOKEN_KEY)),
      Promise.resolve().then(() => permits.revokeAll()),
      Promise.resolve().then(() => options.revokeGrants()),
    ])
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("local credential cleanup failed")
    }
  }

  async function deviceId(): Promise<string> {
    const current = await options.storage.get<unknown>(DEVICE_KEY)
    if (typeof current === "string" && current.length >= 16) return current
    const created = crypto.randomUUID()
    await options.storage.set(DEVICE_KEY, created)
    return created
  }

  return { handle, poll }
}

async function adaptorFetch(
  pairing: Pairing,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set("authorization", `Bearer ${pairing.adaptorToken}`)
  const response = await fetch(`${pairing.serverBase}${path}`, { ...init, headers })
  if (!response.ok) throw new Error("Houkago adaptor request failed")
  return response
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const body = await responseUnknown(response)
  if (!isRecord(body)) throw new Error("Houkago adaptor response invalid")
  return body
}

async function responseUnknown(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error("Houkago adaptor request failed")
  try {
    return (await response.json()) as unknown
  } catch {
    throw new Error("Houkago adaptor response invalid")
  }
}

function parseTokenBundle(value: Record<string, unknown>): BaiduTokenBundle {
  const accessToken = requiredString(value, "accessToken")
  const refreshToken = requiredString(value, "refreshToken")
  const expiresAt = requiredNumber(value, "expiresAt")
  if (!Array.isArray(value.scope) || !value.scope.every((item) => typeof item === "string")) {
    throw new Error("Baidu token response invalid")
  }
  return { accessToken, refreshToken, expiresAt, scope: value.scope }
}

function okResponse(nonce: string): AdapterPageResponse {
  return {
    source: HOUKAGO_ADAPTER_CLIENT_SOURCE,
    protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
    nonce,
    type: "RESULT",
    ok: true,
  }
}

function errorResponse(nonce: string, message: string): AdapterPageResponse {
  return {
    source: HOUKAGO_ADAPTER_CLIENT_SOURCE,
    protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
    nonce,
    type: "ERROR",
    ok: false,
    error: { code: "ADAPTER_ERROR", message },
  }
}

function publicError(error: unknown): string {
  if (!(error instanceof Error)) return "Adapter request failed"
  const allowed = new Set([
    "page origin denied",
    "server origin denied",
    "server permission denied",
    "browser tab unavailable",
    "Baidu connection required",
    "adapter pairing required",
    "download host denied",
    "grant expired",
    "file selection is not permitted",
    "grant sentinel mismatch",
    "grant binding mismatch",
  ])
  return allowed.has(error.message) ? error.message : "Adapter request failed"
}

function grantIdFromUrl(grantUrl: string, serverBase: string): string | null {
  try {
    const url = new URL(grantUrl)
    if (url.origin !== serverBase) return null
    const match = url.pathname.match(/^\/baidu\/media\/([^/]+)$/)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" && value[key].length > 0 ? value[key] : undefined
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const result = optionalString(value, key)
  if (!result) throw new Error("Houkago adaptor response invalid")
  return result
}

function requiredNumber(value: Record<string, unknown>, key: string): number {
  const result = value[key]
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Houkago adaptor response invalid")
  }
  return result
}
