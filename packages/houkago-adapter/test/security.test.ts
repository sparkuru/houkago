import { expect, test } from "bun:test"
import { adapterHello } from "../src/capabilities"
import { MediaGrantRegistry, withBaiduGrantHeaders } from "../src/grants"
import {
  extensionOriginPattern,
  isAllowedPageOrigin,
  isAllowedSentinelUrl,
  isApprovedBaiduDownloadUrl,
  validatedServerBase,
} from "../src/host-policy"
import {
  ChromiumGrantPort,
  installChromiumGrant,
  removeChromiumGrant,
} from "../src/network/chromium"
import { installFirefoxNetworkPort } from "../src/network/firefox"
import { BaiduPermitStore } from "../src/permits"
import { BaiduSelectionRegistry } from "../src/selections"
import type {
  AdapterStorage,
  ChromiumBrowser,
  FirefoxBrowser,
  WebRequestDetails,
  WebRequestHeadersReceivedDetails,
  WebRequestRedirectDetails,
} from "../src/types"

const grant = {
  id: "grant-1",
  tabId: 7,
  sentinelUrl: "https://houkago.example/baidu/media/capability",
  dlink: "https://d.pcs.baidu.com/file?cap=1",
  expiresAt: 10_000,
}

test("handshake identifies its device and keeps every media capability pairing-gated", () => {
  const unpaired = adapterHello("firefox", "0123456789abcdef", false)
  expect(unpaired.deviceId).toBe("0123456789abcdef")
  expect(unpaired.capabilities.every((capability) => !capability.ready)).toBe(true)
  const paired = adapterHello("firefox", "0123456789abcdef", true)
  expect(paired.capabilities.every((capability) => capability.ready)).toBe(true)
})

test("Firefox grant registry is exact, tab-scoped, expiring, and blocks unsafe redirects", () => {
  const registry = new MediaGrantRegistry()
  expect(() =>
    registry.install({ ...grant, sentinelUrl: "ftp://localhost/baidu/media/capability" }, 1_000),
  ).toThrow("sentinel origin denied")
  const lanGrant = {
    ...grant,
    id: "lan-grant",
    sentinelUrl: "http://windows-box:3000/baidu/media/capability",
  }
  registry.install(lanGrant, 1_000)
  expect(registry.redirectFor(lanGrant.sentinelUrl, "lan-request", 7, 1_000)).toBe(grant.dlink)
  registry.remove(lanGrant.id)
  registry.install(grant, 1_000)
  expect(registry.redirectFor(grant.sentinelUrl, "request-1", 8, 1_000)).toBeNull()
  expect(registry.redirectFor(`${grant.sentinelUrl}/other`, "request-1", 7, 1_000)).toBeNull()
  expect(registry.redirectFor(grant.sentinelUrl, "request-1", 7, 1_000)).toBe(grant.dlink)
  expect(registry.shouldInjectUserAgent(grant.dlink, "request-1", 8, 1_000)).toBe(false)
  expect(registry.shouldInjectUserAgent(grant.dlink, "request-1", 7, 1_000)).toBe(true)
  expect(registry.shouldInjectUserAgent(grant.dlink, "continued-range", 7, 1_000)).toBe(true)
  expect(
    registry.authorizeRedirect("continued-range", 7, "https://cdn.baidupcs.com/continued", 1_000),
  ).toBe(true)
  expect(
    registry.shouldInjectUserAgent(
      "https://cdn.baidupcs.com/continued",
      "continued-range",
      7,
      1_000,
    ),
  ).toBe(true)
  registry.completeRequest("continued-range")
  expect(
    registry.shouldInjectUserAgent(
      "https://cdn.baidupcs.com/continued",
      "continued-range",
      7,
      1_000,
    ),
  ).toBe(false)
  expect(registry.shouldInjectUserAgent(grant.dlink, "wrong-tab", 8, 1_000)).toBe(false)
  expect(registry.shouldInjectUserAgent(`${grant.dlink}&part=2`, "different-url", 7, 1_000)).toBe(
    false,
  )
  expect(
    registry.shouldInjectUserAgent("https://d.pcs.baidu.com/ordinary", "ordinary-baidu", 7, 1_000),
  ).toBe(false)

  expect(registry.authorizeRedirect("request-1", 7, "https://evil.example/stolen", 1_000)).toBe(
    false,
  )
  expect(registry.shouldCancel("https://evil.example/stolen", "request-1", 7, 1_000)).toBe(true)
  expect(registry.shouldInjectUserAgent(grant.dlink, "request-1", 7, 1_000)).toBe(false)
  expect(registry.authorizeRedirect("request-1", 7, "https://cdn.baidupcs.com/retry", 1_000)).toBe(
    false,
  )

  expect(registry.redirectFor(grant.sentinelUrl, "expired", 7, 10_001)).toBeNull()
  expect(registry.shouldInjectUserAgent(grant.dlink, "expired-range", 7, 10_001)).toBe(false)
  registry.install({ ...grant, id: "clear-grant" }, 1_000)
  expect(registry.shouldInjectUserAgent(grant.dlink, "clear-range", 7, 1_000)).toBe(true)
  registry.clear()
  expect(registry.shouldInjectUserAgent(grant.dlink, "after-clear", 7, 1_000)).toBe(false)
})

test("grant headers set UA, remove Referer, and preserve Range and unrelated headers", () => {
  expect(
    withBaiduGrantHeaders([
      { name: "Range", value: "bytes=10-" },
      { name: "User-Agent", value: "ordinary-browser" },
      { name: "Referer", value: "http://localhost:5173/" },
      { name: "Origin", value: "http://localhost:5173" },
      { name: "X-Unrelated", value: "unchanged" },
    ]),
  ).toEqual([
    { name: "Range", value: "bytes=10-" },
    { name: "Origin", value: "http://localhost:5173" },
    { name: "X-Unrelated", value: "unchanged" },
    { name: "User-Agent", value: "pan.baidu.com" },
  ])
  expect(isApprovedBaiduDownloadUrl("https://d.pcs.baidu.com/file")).toBe(true)
  expect(isApprovedBaiduDownloadUrl("https://evil.example/file")).toBe(false)
  expect(isApprovedBaiduDownloadUrl("http://d.pcs.baidu.com/file")).toBe(false)
  expect(isApprovedBaiduDownloadUrl("https://user@d.pcs.baidu.com/file")).toBe(false)
  expect(isApprovedBaiduDownloadUrl("https://d.pcs.baidu.com/file?ACCESS_TOKEN=leak")).toBe(false)
  expect(isApprovedBaiduDownloadUrl("https://d.pcs.baidu.com/file?refresh_token=leak")).toBe(false)
  expect(isApprovedBaiduDownloadUrl("https://d.pcs.baidu.com/file#credential")).toBe(false)
})

test("Firefox WebRequest port scopes listeners and mutates only an active grant chain", () => {
  const beforeRequest = new FakeEvent<
    WebRequestDetails,
    { redirectUrl?: string; cancel?: boolean } | undefined
  >()
  const beforeHeaders = new FakeEvent<
    WebRequestDetails,
    { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
  >()
  const beforeRedirect = new FakeEvent<WebRequestRedirectDetails, undefined>()
  const headersReceived = new FakeEvent<
    WebRequestHeadersReceivedDetails,
    { cancel?: boolean } | undefined
  >()
  const completed = new FakeEvent<WebRequestDetails, undefined>()
  const failed = new FakeEvent<WebRequestDetails, undefined>()
  const browserApi = {
    webRequest: {
      onBeforeRequest: beforeRequest,
      onBeforeSendHeaders: beforeHeaders,
      onBeforeRedirect: beforeRedirect,
      onHeadersReceived: headersReceived,
      onCompleted: completed,
      onErrorOccurred: failed,
    },
  } as unknown as FirefoxBrowser
  const registry = new MediaGrantRegistry()
  registry.install({ ...grant, expiresAt: Date.now() + 10_000 })
  const stop = installFirefoxNetworkPort(browserApi, registry, ["https://houkago.example/*"])
  expect(beforeRequest.filter?.urls).not.toContain("<all_urls>")

  const details = { requestId: "chain", url: grant.sentinelUrl, tabId: grant.tabId }
  expect(beforeRequest.call(details)).toEqual({ redirectUrl: grant.dlink })
  expect(
    beforeHeaders.call({
      ...details,
      url: grant.dlink,
      requestHeaders: [
        { name: "Range", value: "bytes=2-" },
        { name: "referer", value: "http://localhost:5173/" },
      ],
    }),
  ).toEqual({
    requestHeaders: [
      { name: "Range", value: "bytes=2-" },
      { name: "User-Agent", value: "pan.baidu.com" },
    ],
  })
  completed.call(details)
  const continued = {
    ...details,
    requestId: "continued-range",
    url: grant.dlink,
    requestHeaders: [
      { name: "Range", value: "bytes=1000-" },
      { name: "Referer", value: "http://localhost:5173/" },
      { name: "User-Agent", value: "ordinary-browser" },
    ],
  }
  expect(beforeHeaders.call(continued)).toEqual({
    requestHeaders: [
      { name: "Range", value: "bytes=1000-" },
      { name: "User-Agent", value: "pan.baidu.com" },
    ],
  })
  expect(
    beforeHeaders.call({ ...continued, requestId: "wrong-tab", tabId: grant.tabId + 1 }),
  ).toBeUndefined()
  expect(
    beforeHeaders.call({
      ...continued,
      requestId: "different-query",
      url: `${grant.dlink}&part=2`,
    }),
  ).toBeUndefined()
  expect(
    beforeHeaders.call({
      ...continued,
      requestId: "ordinary-baidu",
      url: "https://d.pcs.baidu.com/ordinary",
    }),
  ).toBeUndefined()
  expect(
    beforeHeaders.call({
      ...details,
      requestId: "unrelated",
      url: "https://ordinary.example/video.mp4",
    }),
  ).toBeUndefined()
  expect(
    headersReceived.call({
      ...continued,
      responseHeaders: [{ name: "LOCATION", value: "https://ordinary.example/stolen" }],
    }),
  ).toEqual({ cancel: true })
  expect(
    beforeHeaders.call({ ...continued, url: "https://cdn.baidupcs.com/after-block" }),
  ).toBeUndefined()
  expect(
    headersReceived.call({
      ...continued,
      requestId: "ordinary-baidu",
      responseHeaders: [{ name: "Location", value: "https://ordinary.example/redirect" }],
    }),
  ).toBeUndefined()
  completed.call(continued)
  expect(beforeHeaders.call({ ...continued, requestId: "third-range" })).toBeDefined()
  registry.remove(grant.id)
  expect(beforeHeaders.call({ ...continued, requestId: "removed-range" })).toBeUndefined()
  stop()
  expect(beforeRequest.listener).toBeNull()
  expect(headersReceived.listener).toBeNull()
})

test("development origins are web-open while production origins remain exact", () => {
  expect(isAllowedPageOrigin("http://192.168.50.20:5173/room/1")).toBe(true)
  expect(isAllowedPageOrigin("https://houkago-lan.local:8443/room/1")).toBe(true)
  expect(isAllowedPageOrigin("ftp://houkago-lan.local/room/1")).toBe(false)
  expect(
    isAllowedPageOrigin("https://watch.houkago.example/room/1", "https://watch.houkago.example"),
  ).toBe(true)
  expect(
    isAllowedPageOrigin(
      "https://watch.houkago.example:444/room/1",
      "https://watch.houkago.example",
    ),
  ).toBe(false)
  expect(validatedServerBase("http://192.168.50.10:3000", "http://192.168.50.20:5173/room/1")).toBe(
    "http://192.168.50.10:3000",
  )
  expect(validatedServerBase("https://api.lan.local:8443", "http://windows-box:5173/room/1")).toBe(
    "https://api.lan.local:8443",
  )
  expect(validatedServerBase("ftp://localhost", "ftp://localhost/room/1")).toBeNull()
  expect(isAllowedSentinelUrl("http://192.168.50.10:3000/baidu/media/grant")).toBe(true)
  expect(isAllowedSentinelUrl("https://api.lan.local/baidu/media/grant")).toBe(true)
  expect(isAllowedSentinelUrl("ftp://api.lan.local/baidu/media/grant")).toBe(false)
  expect(
    isAllowedSentinelUrl(
      "https://api.houkago.example/baidu/media/grant",
      "https://api.houkago.example",
    ),
  ).toBe(true)
  expect(
    isAllowedSentinelUrl("https://other.example/baidu/media/grant", "https://api.houkago.example"),
  ).toBe(false)
  expect(
    validatedServerBase(
      "https://api.houkago.example",
      "https://watch.houkago.example/room/1",
      "https://watch.houkago.example",
      "https://api.houkago.example",
    ),
  ).toBe("https://api.houkago.example")
  expect(
    validatedServerBase(
      "https://evil.example",
      "https://watch.houkago.example/room/1",
      "https://watch.houkago.example",
      "https://api.houkago.example",
    ),
  ).toBeNull()
  expect(extensionOriginPattern("http://127.0.0.1:3000")).toBe("http://127.0.0.1/*")
})

test("Chromium session rules bind redirect and headers to one tab and exact URLs", async () => {
  const updates: Array<{
    removeRuleIds: number[]
    addRules?: Array<Record<string, unknown>>
  }> = []
  const browserApi: ChromiumBrowser = {
    declarativeNetRequest: {
      async updateSessionRules(value) {
        updates.push(value)
      },
    },
  }
  const ids = await installChromiumGrant(browserApi, grant, 2)
  expect(ids).toEqual([20_004, 20_005])
  expect(JSON.stringify(updates[0])).toContain(`"tabIds":[${grant.tabId}]`)
  expect(JSON.stringify(updates[0])).toContain(grant.dlink)
  expect(JSON.stringify(updates[0])).not.toContain("requestDomains")
  expect(updates[0]?.addRules?.[1]).toMatchObject({
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "user-agent", operation: "set", value: "pan.baidu.com" },
        { header: "referer", operation: "remove" },
      ],
    },
    condition: {
      regexFilter: "^https://d\\.pcs\\.baidu\\.com/file\\?cap=1$",
      isUrlFilterCaseSensitive: true,
      tabIds: [grant.tabId],
      resourceTypes: ["media", "xmlhttprequest"],
    },
  })
  expect(updates[0]?.addRules?.[0]).toMatchObject({
    condition: {
      regexFilter: "^https://houkago\\.example/baidu/media/capability$",
      isUrlFilterCaseSensitive: true,
      tabIds: [grant.tabId],
    },
  })
  expect(JSON.stringify(updates[0])).not.toContain('"header":"range"')
  expect(JSON.stringify(updates[0])).not.toContain("ordinary.example")
  await removeChromiumGrant(browserApi, ids)
  expect(updates[1]).toEqual({ removeRuleIds: ids })
})

test("Chromium exact URL rules escape DNR filter metacharacters", async () => {
  const updates: Array<{
    removeRuleIds: number[]
    addRules?: Array<Record<string, unknown>>
  }> = []
  const browserApi: ChromiumBrowser = {
    declarativeNetRequest: {
      async updateSessionRules(value) {
        updates.push(value)
      },
    },
  }
  await installChromiumGrant(
    browserApi,
    {
      ...grant,
      sentinelUrl: "https://houkago.example/baidu/media/grant*one",
      dlink: "https://d.pcs.baidu.com/file?cap=one*two^three",
    },
    3,
  )
  expect(updates[0]?.addRules?.[0]).toMatchObject({
    condition: {
      regexFilter: "^https://houkago\\.example/baidu/media/grant\\*one$",
      isUrlFilterCaseSensitive: true,
    },
  })
  expect(updates[0]?.addRules?.[1]).toMatchObject({
    condition: {
      regexFilter: "^https://d\\.pcs\\.baidu\\.com/file\\?cap=one\\*two\\^three$",
      isUrlFilterCaseSensitive: true,
    },
  })
})

test("Chromium runtime port removes each session grant at its expiry", async () => {
  const updates: Array<{
    removeRuleIds: number[]
    addRules?: Array<Record<string, unknown>>
  }> = []
  const cleanups: Array<() => void> = []
  let delay = 0
  const browserApi: ChromiumBrowser = {
    declarativeNetRequest: {
      async updateSessionRules(value) {
        updates.push(value)
      },
    },
  }
  const port = new ChromiumGrantPort(browserApi, (handler, timeout) => {
    cleanups.push(handler)
    delay = timeout
  })
  const lanGrant = {
    ...grant,
    sentinelUrl: "http://192.168.50.10:3000/baidu/media/capability",
  }
  const ids = await port.install(lanGrant, 1_000)
  expect(delay).toBe(9_000)
  expect(updates).toHaveLength(1)
  expect(updates[0]?.addRules?.[0]).toMatchObject({
    condition: {
      regexFilter: "^http://192\\.168\\.50\\.10:3000/baidu/media/capability$",
      isUrlFilterCaseSensitive: true,
    },
  })
  cleanups[0]?.()
  await Promise.resolve()
  expect(updates[1]).toEqual({ removeRuleIds: ids })
})

test("Chromium runtime port cancels timers and removes every rule on account cleanup", async () => {
  const updates: Array<{
    removeRuleIds: number[]
    addRules?: Array<Record<string, unknown>>
  }> = []
  const timerHandle = { id: 1 }
  const cleared: unknown[] = []
  const browserApi: ChromiumBrowser = {
    declarativeNetRequest: {
      async updateSessionRules(value) {
        updates.push(value)
      },
    },
  }
  const port = new ChromiumGrantPort(
    browserApi,
    () => timerHandle,
    (handle) => cleared.push(handle),
  )
  const ids = await port.install(grant, 1_000)
  await port.clear()
  expect(cleared).toEqual([timerHandle])
  expect(updates[1]).toEqual({ removeRuleIds: ids })
})

test("persisted permit data is validated before it can authorize a dlink request", async () => {
  const values = new Map<string, unknown>()
  const storage: AdapterStorage = {
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
  values.set("baidu.permits", {
    "room-1:source-1": {
      sourceId: "source-1",
      bushitsuId: "room-1",
      upstreamHandle: "42",
      injected: "deny",
    },
  })
  const permits = new BaiduPermitStore(storage)
  expect(await permits.permitted("source-1", "room-1")).toBeNull()
  await permits.permit({ sourceId: "source-1", bushitsuId: "room-1", upstreamHandle: "42" })
  expect(await permits.permitted("source-1", "room-1")).toEqual({
    sourceId: "source-1",
    bushitsuId: "room-1",
    upstreamHandle: "42",
  })
})

test("a room permit can consume only a video handle returned by a prior listing", () => {
  const selections = new BaiduSelectionRegistry()
  selections.record([
    {
      id: "folder",
      name: "Anime",
      path: "/Anime",
      isDirectory: true,
      mediaType: "unsupported",
    },
    {
      id: "video",
      name: "episode.mp4",
      path: "/Anime/episode.mp4",
      isDirectory: false,
      mediaType: "video",
    },
    {
      id: "text",
      name: "notes.txt",
      path: "/notes.txt",
      isDirectory: false,
      mediaType: "unsupported",
    },
  ])
  expect(selections.consume("arbitrary-fsid")).toBe(false)
  expect(selections.consume("folder")).toBe(false)
  expect(selections.consume("text")).toBe(false)
  expect(selections.consume("video")).toBe(true)
  expect(selections.consume("video")).toBe(false)
})

class FakeEvent<T, R> {
  listener: ((details: T) => R) | null = null
  filter: { urls: string[]; types?: string[] } | null = null

  addListener(
    listener: (details: T) => R,
    filter: { urls: string[]; types?: string[] },
    _extraInfoSpec?: string[],
  ): void {
    this.listener = listener
    this.filter = filter
  }

  removeListener(listener: (details: T) => R): void {
    if (this.listener === listener) this.listener = null
  }

  call(details: T): R | undefined {
    return this.listener?.(details)
  }
}
