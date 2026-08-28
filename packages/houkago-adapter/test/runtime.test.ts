import { expect, test } from "bun:test"
import type { BaiduFetcher } from "houkago-eisha/baidu"
import { HOUKAGO_ADAPTER_PAGE_SOURCE, HOUKAGO_ADAPTER_PROTOCOL_VERSION } from "houkago-kousoku"
import { type RuntimeMediaGrant, createAdapterRuntime } from "../src/runtime"
import type { AdapterStorage } from "../src/types"

const nonce = "0123456789abcdef"
const pageUrl = "https://houkago.example/room/room-1"

test("development runtime accepts HTTP and HTTPS LAN origins but rejects non-web pages", async () => {
  const requestedOrigins: string[] = []
  const originalFetch = globalThis.fetch
  const fetcher: BaiduFetcher = async (input) => {
    expect(String(input)).toBe("http://media-box.local:3000/baidu/adaptor/pair")
    return Response.json({ adaptorToken: "lan-pair-token" })
  }
  globalThis.fetch = Object.assign(fetcher, { preconnect() {} })
  const runtime = createAdapterRuntime({
    browser: "firefox",
    storage: memoryStorage(new Map()),
    async requestServerOrigin(pattern) {
      requestedOrigins.push(pattern)
      return true
    },
    onPaired() {},
    installGrant() {},
    revokeGrants() {},
    async resolveDlink() {
      throw new Error("unexpected dlink resolution")
    },
  })

  try {
    const httpHello = await runtime.handle(
      request("HELLO", {}),
      "http://192.168.50.20:5173/room/1",
      1,
    )
    expect(JSON.stringify(httpHello)).toContain('"type":"HELLO"')
    const httpsHello = await runtime.handle(
      request("HELLO", {}),
      "https://houkago-lan.local:8443/room/1",
      1,
    )
    expect(JSON.stringify(httpsHello)).toContain('"type":"HELLO"')
    const paired = await runtime.handle(
      request("PAIR", {
        serverBase: "http://media-box.local:3000",
        pairingCode: "pairing-code-1234",
      }),
      "http://192.168.50.20:5173/room/1",
      1,
    )
    expect(JSON.stringify(paired)).toContain('"ok":true')
    expect(requestedOrigins).toEqual(["http://media-box.local/*"])
    const deniedHello = await runtime.handle(
      request("HELLO", {}),
      "ftp://houkago-lan.local/room/1",
      1,
    )
    expect(JSON.stringify(deniedHello)).toContain("page origin denied")
    expect(JSON.stringify(deniedHello)).not.toContain("deviceId")
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Chromium and Firefox share pairing, handoff, list, permit, grant, and dlink core", async () => {
  const values = new Map<string, unknown>()
  const storage = memoryStorage(values)
  const installed: RuntimeMediaGrant[] = []
  const serverRequests: string[] = []
  const dlinkResponses: unknown[] = []
  const dlinkHandles: string[] = []
  const warnings: string[] = []
  let grantsRevoked = 0
  const originalFetch = globalThis.fetch
  const fetcher: BaiduFetcher = async (input, init) => {
    const url = new URL(String(input))
    serverRequests.push(`${init?.method ?? "GET"} ${url.pathname}`)
    if (url.pathname === "/baidu/adaptor/pair") return Response.json({ adaptorToken: "pair-token" })
    if (url.pathname === "/baidu/adaptor/session" && init?.method === "DELETE") {
      return Response.json({ error: "already revoked" }, { status: 401 })
    }
    const authorization = new Headers(init?.headers).get("authorization")
    if (url.hostname === "houkago.example") expect(authorization).toBe("Bearer pair-token")
    if (url.pathname === "/baidu/adaptor/oauth/handoff") {
      return Response.json({
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        expiresAt: Date.now() + 60_000,
        scope: ["netdisk"],
      })
    }
    if (url.hostname === "pan.baidu.com") {
      return Response.json({
        errno: 0,
        list: [
          {
            fs_id: 42,
            server_filename: "episode.mp4",
            path: "/episode.mp4",
            isdir: 0,
            category: 1,
          },
        ],
      })
    }
    if (url.pathname === "/baidu/adaptor/grants/g1") {
      return Response.json({
        id: "g1",
        sentinelUrl: "https://houkago.example/baidu/media/g1",
        dlink: "https://cdn.baidupcs.com/final?cap=viewer",
        expiresAt: Date.now() + 60_000,
      })
    }
    if (url.pathname === "/baidu/adaptor/dlink-requests") {
      return Response.json([
        {
          requestId: "request-failed-1",
          nonce: "nonce-failed-1234",
          sourceId: "source-1",
          bushitsuId: "room-1",
          expiresAt: Date.now() + 30_000,
        },
        {
          requestId: "request-ready-2",
          nonce: "nonce-ready-12345",
          sourceId: "source-1",
          bushitsuId: "room-1",
          expiresAt: Date.now() + 30_000,
        },
      ])
    }
    if (url.pathname === "/baidu/adaptor/dlink-responses" && init?.body) {
      dlinkResponses.push(JSON.parse(String(init.body)) as unknown)
    }
    return Response.json({ ok: true })
  }
  globalThis.fetch = Object.assign(fetcher, { preconnect() {} })

  const runtime = createAdapterRuntime({
    browser: "chromium",
    storage,
    expectedPageOrigin: "https://houkago.example",
    expectedServerOrigin: "https://houkago.example",
    async requestServerOrigin(pattern) {
      expect(pattern).toBe("https://houkago.example/*")
      return true
    },
    onPaired() {
      return undefined
    },
    installGrant(grant) {
      installed.push(grant)
    },
    revokeGrants() {
      grantsRevoked += 1
    },
    async resolveDlink(_accessToken, fsid) {
      dlinkHandles.push(fsid)
      if (dlinkHandles.length === 1) throw new Error("private resolution detail")
      return { dlink: "https://cdn.baidupcs.com/owner-final", expiresAt: Date.now() + 30_000 }
    },
    warn(message) {
      warnings.push(message)
    },
  })

  try {
    await runtime.handle(
      request("PAIR", {
        serverBase: "https://houkago.example",
        pairingCode: "pairing-code-1234",
      }),
      pageUrl,
      7,
    )
    expect(grantsRevoked).toBe(1)
    await runtime.poll()
    expect(serverRequests).toContain("POST /baidu/adaptor/heartbeat")
    expect(serverRequests).not.toContain("GET /baidu/adaptor/dlink-requests")
    const wrongPortHello = await runtime.handle(
      request("HELLO", {}),
      "https://houkago.example:444/room/room-1",
      7,
    )
    expect(JSON.stringify(wrongPortHello)).toContain("page origin denied")
    expect(JSON.stringify(wrongPortHello)).not.toContain("deviceId")
    const wrongPortRevoke = await runtime.handle(
      request("BAIDU_REVOKE", {}),
      "https://houkago.example:444/room/room-1",
      7,
    )
    expect(JSON.stringify(wrongPortRevoke)).toContain("page origin denied")
    expect(values.has("adapter.pairing")).toBe(true)
    expect(grantsRevoked).toBe(1)
    const hello = await runtime.handle(request("HELLO", {}), pageUrl, 7)
    expect(JSON.stringify(hello)).not.toContain("pair-token")
    expect(JSON.stringify(hello)).toContain('"browser":"chromium"')
    expect(JSON.stringify(hello)).not.toContain('"ready":false')

    const handoff = await runtime.handle(
      request("OAUTH_HANDOFF", { serverBase: "https://houkago.example" }),
      pageUrl,
      7,
    )
    expect(JSON.stringify(handoff)).not.toContain("access-secret")
    expect(JSON.stringify(handoff)).not.toContain("refresh-secret")
    const persistedToken = JSON.stringify(values.get("baidu.token"))
    expect(persistedToken).toContain("refresh-secret")
    expect(persistedToken).not.toContain("access-secret")

    const listing = await runtime.handle(request("BAIDU_LIST", { path: "/" }), pageUrl, 7)
    expect(JSON.stringify(listing)).toContain("episode.mp4")
    await runtime.handle(
      request("BAIDU_PERMIT", {
        sourceId: "source-1",
        bushitsuId: "room-1",
        upstreamHandle: "42",
      }),
      pageUrl,
      7,
    )
    const prepared = await runtime.handle(
      request("BAIDU_MEDIA_PREPARE", {
        grantUrl: "https://houkago.example/baidu/media/g1",
        expiresAt: Date.now() + 60_000,
      }),
      pageUrl,
      7,
    )
    expect(JSON.stringify(prepared)).not.toContain("baidupcs")
    expect(installed).toHaveLength(1)
    expect(installed[0]?.tabId).toBe(7)

    await runtime.poll()
    expect(dlinkHandles).toEqual(["42", "42"])
    expect(serverRequests).toContain("POST /baidu/adaptor/dlink-responses")
    expect(serverRequests).toContain("POST /baidu/adaptor/heartbeat")
    expect(dlinkResponses).toHaveLength(2)
    expect(dlinkResponses[0]).toEqual({
      requestId: "request-failed-1",
      nonce: "nonce-failed-1234",
      failure: "upstream-resolution-failed",
    })
    expect(dlinkResponses[1]).toMatchObject({
      requestId: "request-ready-2",
      nonce: "nonce-ready-12345",
    })
    expect(JSON.stringify(dlinkResponses[0])).not.toContain("access-secret")
    expect(JSON.stringify(dlinkResponses[0])).not.toContain("private resolution detail")
    expect(warnings).toEqual(["houkago-adapter: upstream-resolution-failed"])

    await runtime.handle(request("BAIDU_LIST", { path: "/" }), pageUrl, 7)
    await runtime.handle(
      request("PAIR", {
        serverBase: "https://houkago.example",
        pairingCode: "replacement-code-1234",
      }),
      pageUrl,
      7,
    )
    expect(values.has("baidu.token")).toBe(false)
    expect(values.has("baidu.permits")).toBe(false)
    expect(grantsRevoked).toBe(2)
    const stalePermit = await runtime.handle(
      request("BAIDU_PERMIT", {
        sourceId: "source-2",
        bushitsuId: "room-1",
        upstreamHandle: "42",
      }),
      pageUrl,
      7,
    )
    expect(JSON.stringify(stalePermit)).toContain('"ok":false')

    const revoked = await runtime.handle(request("BAIDU_REVOKE", {}), pageUrl, 7)
    expect(JSON.stringify(revoked)).toContain('"ok":true')
    expect(values.has("adapter.pairing")).toBe(false)
    expect(values.has("baidu.token")).toBe(false)
    expect(values.has("baidu.permits")).toBe(false)
    expect(grantsRevoked).toBe(3)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("fingerprint preparation binds the claimed grant to the requested source and room", async () => {
  const values = new Map<string, unknown>([
    ["adapter.pairing", { serverBase: "https://houkago.example", adaptorToken: "pair-token" }],
  ])
  const installed: RuntimeMediaGrant[] = []
  const originalFetch = globalThis.fetch
  const fetcher: BaiduFetcher = async (input) => {
    expect(String(input)).toBe("https://houkago.example/baidu/adaptor/grants/g1")
    return Response.json({
      id: "g1",
      sourceId: "source-1",
      bushitsuId: "room-1",
      sentinelUrl: "https://houkago.example/baidu/media/g1",
      dlink: "https://cdn.baidupcs.com/file/opaque",
      expiresAt: Date.now() + 60_000,
    })
  }
  globalThis.fetch = Object.assign(fetcher, { preconnect() {} })
  const runtime = createAdapterRuntime({
    browser: "firefox",
    storage: memoryStorage(values),
    expectedPageOrigin: "https://houkago.example",
    expectedServerOrigin: "https://houkago.example",
    async requestServerOrigin() {
      return true
    },
    onPaired() {},
    installGrant(grant) {
      installed.push(grant)
    },
    revokeGrants() {},
    async resolveDlink() {
      throw new Error("unexpected dlink resolution")
    },
  })

  try {
    const prepared = await runtime.handle(
      request("BAIDU_MEDIA_FINGERPRINT", {
        sourceId: "source-1",
        bushitsuId: "room-1",
        grantUrl: "https://houkago.example/baidu/media/g1",
        expiresAt: Date.now() + 60_000,
        bytes: 1024,
      }),
      pageUrl,
      7,
    )
    expect(prepared).toMatchObject({ type: "RESULT", ok: true, nonce })
    expect(installed).toHaveLength(1)
    expect(JSON.stringify(prepared)).not.toContain("baidupcs")

    const mismatched = await runtime.handle(
      request("BAIDU_MEDIA_FINGERPRINT", {
        sourceId: "source-2",
        bushitsuId: "room-1",
        grantUrl: "https://houkago.example/baidu/media/g1",
        expiresAt: Date.now() + 60_000,
        bytes: 1024,
      }),
      pageUrl,
      7,
    )
    expect(JSON.stringify(mismatched)).toContain("grant binding mismatch")
    expect(installed).toHaveLength(1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

function request(type: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    source: HOUKAGO_ADAPTER_PAGE_SOURCE,
    protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
    nonce,
    type,
    ...payload,
  }
}

function memoryStorage(values: Map<string, unknown>): AdapterStorage {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return values.get(key) as T | undefined
    },
    async set<T>(key: string, value: T): Promise<void> {
      values.set(key, value)
    },
    async remove(key: string): Promise<void> {
      values.delete(key)
    },
  }
}
