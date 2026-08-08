import { expect, test } from "bun:test"
import type { BaiduFetcher } from "houkago-eisha/baidu"
import { chromiumDlinkResolver, firefoxDlinkResolver } from "../src/dlink-exchange"
import type {
  ChromiumDlinkBrowser,
  FirefoxBrowser,
  WebRequestDetails,
  WebRequestHeadersReceivedDetails,
  WebRequestRedirectDetails,
} from "../src/types"

test("Firefox adds UA only to the private raw-dlink HEAD and removes the listener", async () => {
  const beforeHeaders = new FakeEvent<
    WebRequestDetails,
    { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
  >()
  const headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>()
  const browserApi = firefoxBrowser(beforeHeaders, headersReceived)
  let privateUrl = ""
  const fetcher: BaiduFetcher = async (input, init) => {
    if (init?.method !== "HEAD") {
      return Response.json({
        errno: 0,
        list: [{ fs_id: 42, dlink: "https://d.pcs.baidu.com/private?cap=1" }],
      })
    }
    privateUrl = String(input)
    expect(init.redirect).toBe("manual")
    expect(
      beforeHeaders.call({
        requestId: "private-head",
        url: privateUrl,
        tabId: -1,
        method: "HEAD",
        requestHeaders: [
          { name: "Range", value: "bytes=0-" },
          { name: "Referer", value: "https://owner.example/" },
          { name: "X-Unrelated", value: "unchanged" },
        ],
      }),
    ).toEqual({
      requestHeaders: [
        { name: "Range", value: "bytes=0-" },
        { name: "Referer", value: "https://owner.example/" },
        { name: "X-Unrelated", value: "unchanged" },
        { name: "User-Agent", value: "pan.baidu.com" },
      ],
    })
    expect(
      beforeHeaders.call({
        requestId: "ordinary",
        url: "https://d.pcs.baidu.com/ordinary",
        tabId: -1,
      }),
    ).toBeUndefined()
    headersReceived.call({
      requestId: "private-head",
      url: privateUrl,
      tabId: -1,
      method: "HEAD",
      statusCode: 302,
      responseHeaders: [{ name: "Location", value: "https://cdn.baidupcs.com/final?cap=2" }],
    })
    headersReceived.call({
      requestId: "foreign-private-head",
      url: privateUrl,
      tabId: -1,
      method: "HEAD",
      statusCode: 302,
      responseHeaders: [{ name: "Location", value: "https://evil.example/cross-wired" }],
    })
    return opaqueRedirect()
  }
  const result = await firefoxDlinkResolver(browserApi, fetcher)("access-secret", "42")
  expect(privateUrl).toContain("access_token=access-secret")
  expect(result.dlink).toBe("https://cdn.baidupcs.com/final?cap=2")
  expect(result.dlink).not.toContain("access-secret")
  expect(beforeHeaders.listener).toBeNull()
  expect(headersReceived.listener).toBeNull()
  expect(headersReceived.filter).toEqual({
    urls: ["https://d.pcs.baidu.com/private*"],
    types: ["xmlhttprequest"],
  })
})

test("Chromium wraps the private HEAD in one exact temporary DNR rule", async () => {
  const updates: Array<{
    removeRuleIds: number[]
    addRules?: Array<Record<string, unknown>>
  }> = []
  const beforeHeaders = new FakeEvent<WebRequestDetails, undefined>()
  const headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>()
  const browserApi: ChromiumDlinkBrowser = {
    declarativeNetRequest: {
      async updateSessionRules(update) {
        updates.push(update)
      },
    },
    webRequest: { onBeforeSendHeaders: beforeHeaders, onHeadersReceived: headersReceived },
  }
  const fetcher: BaiduFetcher = async (input, init) => {
    if (init?.method === "HEAD") {
      const details = {
        requestId: "chromium-private-head",
        url: String(input),
        tabId: -1,
        method: "HEAD",
      }
      beforeHeaders.call(details)
      headersReceived.call({
        ...details,
        statusCode: 302,
        responseHeaders: [{ name: "location", value: "https://cdn.baidupcs.com/final?cap=2" }],
      })
      headersReceived.call({
        ...details,
        requestId: "foreign-private-head",
        statusCode: 302,
        responseHeaders: [{ name: "location", value: "https://evil.example/cross-wired" }],
      })
      return opaqueRedirect()
    }
    return Response.json({
      errno: 0,
      list: [{ fs_id: 42, dlink: "https://d.pcs.baidu.com/private?cap=1" }],
    })
  }
  const result = await chromiumDlinkResolver(browserApi, fetcher)("access-secret", "42")
  expect(result.dlink).toBe("https://cdn.baidupcs.com/final?cap=2")
  expect(updates).toHaveLength(2)
  expect(JSON.stringify(updates[0])).toContain("access_token=access-secret")
  expect(JSON.stringify(updates[0])).toContain('"tabIds":[-1]')
  expect(updates[0]?.addRules?.[0]).toMatchObject({
    action: {
      type: "modifyHeaders",
      requestHeaders: [{ header: "user-agent", operation: "set", value: "pan.baidu.com" }],
    },
    condition: {
      regexFilter: "^https://d\\.pcs\\.baidu\\.com/private\\?cap=1&access_token=access-secret$",
      isUrlFilterCaseSensitive: true,
      tabIds: [-1],
      resourceTypes: ["xmlhttprequest"],
    },
  })
  expect(JSON.stringify(updates[0])).not.toContain('"header":"referer"')
  expect(JSON.stringify(updates[0])).not.toContain('"header":"range"')
  expect(updates[1]).toEqual({ removeRuleIds: [40_000] })
  expect(beforeHeaders.listener).toBeNull()
  expect(headersReceived.listener).toBeNull()
})

test("both browser ports reject unsafe or incomplete observed redirects and clean up", async () => {
  const cases: Array<{
    statusCode: number
    location?: string
  }> = [
    { statusCode: 200, location: "https://cdn.baidupcs.com/not-a-redirect" },
    { statusCode: 302 },
    { statusCode: 302, location: "https://evil.example/file" },
    { statusCode: 302, location: "https://cdn.baidupcs.com/file?access_token=leak" },
  ]
  for (const browser of ["firefox", "chromium"] as const) {
    for (const observed of cases) {
      const fixture = redirectFixture(browser, observed)
      await expect(fixture.resolve("access-secret", "42")).rejects.toThrow(
        "Baidu download link request failed",
      )
      expect(fixture.headersReceived.listener).toBeNull()
      expect(fixture.beforeHeaders?.listener ?? null).toBeNull()
      if (browser === "chromium")
        expect(fixture.updates.at(-1)).toEqual({ removeRuleIds: [40_000] })
    }
  }
})

test("concurrent private HEAD exchanges correlate exact URLs and remove every listener", async () => {
  for (const browser of ["firefox", "chromium"] as const) {
    const beforeHeaders = new FakeEvent<
      WebRequestDetails,
      { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
    >()
    const headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>()
    const updates: Array<{ removeRuleIds: number[]; addRules?: Array<Record<string, unknown>> }> =
      []
    let headCount = 0
    let releaseHeads: (() => void) | undefined
    const headsReady = new Promise<void>((resolve) => {
      releaseHeads = resolve
    })
    const fetcher: BaiduFetcher = async (input, init) => {
      const url = new URL(String(input))
      if (init?.method !== "HEAD") {
        const fsid = JSON.parse(url.searchParams.get("fsids") ?? "[]")[0]
        return Response.json({
          errno: 0,
          list: [{ fs_id: fsid, dlink: `https://d.pcs.baidu.com/private-${fsid}` }],
        })
      }
      headCount += 1
      if (headCount === 2) releaseHeads?.()
      await headsReady
      const details = {
        requestId: `head-${url.pathname}`,
        url: url.toString(),
        tabId: -1,
        method: "HEAD",
      }
      beforeHeaders.call(details)
      headersReceived.call({
        ...details,
        statusCode: 302,
        responseHeaders: [
          { name: "Location", value: `https://cdn.baidupcs.com/final${url.pathname}` },
        ],
      })
      return opaqueRedirect()
    }
    const resolve =
      browser === "firefox"
        ? firefoxDlinkResolver(firefoxBrowser(beforeHeaders, headersReceived), fetcher)
        : chromiumDlinkResolver(
            {
              declarativeNetRequest: {
                async updateSessionRules(update) {
                  updates.push(update)
                },
              },
              webRequest: {
                onBeforeSendHeaders: beforeHeaders,
                onHeadersReceived: headersReceived,
              },
            },
            fetcher,
          )
    const results = await Promise.all([resolve("access-one", "41"), resolve("access-two", "42")])
    expect(results.map((result) => result.dlink)).toEqual([
      "https://cdn.baidupcs.com/final/private-41",
      "https://cdn.baidupcs.com/final/private-42",
    ])
    expect(beforeHeaders.listener).toBeNull()
    expect(headersReceived.listener).toBeNull()
    if (browser === "chromium") {
      expect(updates.filter((update) => update.addRules)).toHaveLength(2)
      expect(updates.filter((update) => !update.addRules)).toHaveLength(2)
    }
  }
})

test("same private URL exchanges serialize without sharing redirect observations", async () => {
  for (const browser of ["firefox", "chromium"] as const) {
    const beforeHeaders = new FakeEvent<
      WebRequestDetails,
      { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
    >()
    const headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>()
    const updates: Array<{ removeRuleIds: number[]; addRules?: Array<Record<string, unknown>> }> =
      []
    let activeHeads = 0
    let maximumActiveHeads = 0
    let nextHead = 0
    const fetcher: BaiduFetcher = async (input, init) => {
      if (init?.method !== "HEAD") {
        return Response.json({
          errno: 0,
          list: [{ fs_id: 42, dlink: "https://d.pcs.baidu.com/private-same" }],
        })
      }
      activeHeads += 1
      maximumActiveHeads = Math.max(maximumActiveHeads, activeHeads)
      const head = ++nextHead
      await new Promise((resolve) => setTimeout(resolve, 0))
      const details = {
        requestId: `same-head-${head}`,
        url: String(input),
        tabId: -1,
        method: "HEAD",
      }
      beforeHeaders.call(details)
      headersReceived.call({
        ...details,
        statusCode: 302,
        responseHeaders: [
          { name: "Location", value: `https://cdn.baidupcs.com/final-same-${head}` },
        ],
      })
      activeHeads -= 1
      return opaqueRedirect()
    }
    const resolve =
      browser === "firefox"
        ? firefoxDlinkResolver(firefoxBrowser(beforeHeaders, headersReceived), fetcher)
        : chromiumDlinkResolver(
            {
              declarativeNetRequest: {
                async updateSessionRules(update) {
                  updates.push(update)
                },
              },
              webRequest: {
                onBeforeSendHeaders: beforeHeaders,
                onHeadersReceived: headersReceived,
              },
            },
            fetcher,
          )
    const results = await Promise.all([
      resolve("same-access", "42"),
      resolve("same-access", "42"),
      resolve("same-access", "42"),
    ])
    expect(maximumActiveHeads).toBe(1)
    expect(results.map((result) => result.dlink)).toEqual([
      "https://cdn.baidupcs.com/final-same-1",
      "https://cdn.baidupcs.com/final-same-2",
      "https://cdn.baidupcs.com/final-same-3",
    ])
    expect(beforeHeaders.listener).toBeNull()
    expect(headersReceived.listener).toBeNull()
  }
})

test("transport and Chromium rule-install failures remove redirect observers", async () => {
  for (const browser of ["firefox", "chromium"] as const) {
    const beforeHeaders = new FakeEvent<
      WebRequestDetails,
      { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
    >()
    const headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>()
    const updates: Array<{ removeRuleIds: number[]; addRules?: Array<Record<string, unknown>> }> =
      []
    const fetcher: BaiduFetcher = async (_input, init) => {
      if (init?.method === "HEAD") throw new Error("private transport detail")
      return Response.json({
        errno: 0,
        list: [{ fs_id: 42, dlink: "https://d.pcs.baidu.com/private" }],
      })
    }
    const resolve =
      browser === "firefox"
        ? firefoxDlinkResolver(firefoxBrowser(beforeHeaders, headersReceived), fetcher)
        : chromiumDlinkResolver(
            {
              declarativeNetRequest: {
                async updateSessionRules(update) {
                  updates.push(update)
                },
              },
              webRequest: {
                onBeforeSendHeaders: beforeHeaders,
                onHeadersReceived: headersReceived,
              },
            },
            fetcher,
          )
    await expect(resolve("access-secret", "42")).rejects.toThrow(
      "Baidu download link request failed",
    )
    expect(beforeHeaders.listener).toBeNull()
    expect(headersReceived.listener).toBeNull()
    if (browser === "chromium") expect(updates.at(-1)).toEqual({ removeRuleIds: [40_000] })
  }

  const headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>()
  const beforeHeaders = new FakeEvent<WebRequestDetails, undefined>()
  const resolve = chromiumDlinkResolver(
    {
      declarativeNetRequest: {
        async updateSessionRules() {
          throw new Error("DNR unavailable")
        },
      },
      webRequest: { onBeforeSendHeaders: beforeHeaders, onHeadersReceived: headersReceived },
    },
    async () =>
      Response.json({
        errno: 0,
        list: [{ fs_id: 42, dlink: "https://d.pcs.baidu.com/private" }],
      }),
  )
  await expect(resolve("access-secret", "42")).rejects.toThrow("Baidu download link request failed")
  expect(beforeHeaders.listener).toBeNull()
  expect(headersReceived.listener).toBeNull()
})

test("Chromium listener-install failure removes the already-installed observer", async () => {
  const beforeHeaders = new FakeEvent<WebRequestDetails, undefined>()
  const resolve = chromiumDlinkResolver(
    {
      declarativeNetRequest: {
        async updateSessionRules() {
          throw new Error("DNR must not be reached")
        },
      },
      webRequest: {
        onBeforeSendHeaders: beforeHeaders,
        onHeadersReceived: {
          addListener() {
            throw new Error("listener unavailable")
          },
          removeListener() {},
        },
      },
    },
    async (_input, init) => {
      if (init?.method === "HEAD") throw new Error("HEAD must not be reached")
      return Response.json({
        errno: 0,
        list: [{ fs_id: 42, dlink: "https://d.pcs.baidu.com/private" }],
      })
    },
  )
  await expect(resolve("access-secret", "42")).rejects.toThrow("Baidu download link request failed")
  expect(beforeHeaders.listener).toBeNull()
})

function firefoxBrowser(
  beforeHeaders: FakeEvent<
    WebRequestDetails,
    { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
  >,
  headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>(),
): FirefoxBrowser {
  const beforeRequest = new FakeEvent<
    WebRequestDetails,
    { redirectUrl?: string; cancel?: boolean } | undefined
  >()
  const beforeRedirect = new FakeEvent<WebRequestRedirectDetails, undefined>()
  const completed = new FakeEvent<WebRequestDetails, undefined>()
  return {
    webRequest: {
      onBeforeRequest: beforeRequest,
      onBeforeSendHeaders: beforeHeaders,
      onBeforeRedirect: beforeRedirect,
      onHeadersReceived: headersReceived,
      onCompleted: completed,
      onErrorOccurred: completed,
    },
  } as unknown as FirefoxBrowser
}

class FakeEvent<T, R> {
  private readonly listeners = new Set<(details: T) => R>()
  filter: { urls: string[]; types?: string[] } | null = null

  get listener(): ((details: T) => R) | null {
    return this.listeners.values().next().value ?? null
  }

  addListener(
    listener: (details: T) => R,
    filter: { urls: string[]; types?: string[] },
    _extraInfoSpec?: string[],
  ): void {
    this.listeners.add(listener)
    this.filter = filter
  }

  removeListener(listener: (details: T) => R): void {
    this.listeners.delete(listener)
  }

  call(details: T): R | undefined {
    let result: R | undefined
    for (const listener of this.listeners) {
      const next = listener(details)
      if (next !== undefined) result = next
    }
    return result
  }
}

function redirectFixture(
  browser: "firefox" | "chromium",
  observed: { statusCode: number; location?: string },
) {
  const beforeHeaders = new FakeEvent<
    WebRequestDetails,
    { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
  >()
  const headersReceived = new FakeEvent<WebRequestHeadersReceivedDetails, undefined>()
  const updates: Array<{ removeRuleIds: number[]; addRules?: Array<Record<string, unknown>> }> = []
  const fetcher: BaiduFetcher = async (input, init) => {
    if (init?.method !== "HEAD") {
      return Response.json({
        errno: 0,
        list: [{ fs_id: 42, dlink: "https://d.pcs.baidu.com/private" }],
      })
    }
    const details = {
      requestId: "private-head",
      url: String(input),
      tabId: -1,
      method: "HEAD",
    }
    beforeHeaders.call(details)
    headersReceived.call({
      ...details,
      statusCode: observed.statusCode,
      ...(observed.location
        ? { responseHeaders: [{ name: "Location", value: observed.location }] }
        : {}),
    })
    return opaqueRedirect()
  }
  if (browser === "firefox") {
    return {
      resolve: firefoxDlinkResolver(firefoxBrowser(beforeHeaders, headersReceived), fetcher),
      beforeHeaders,
      headersReceived,
      updates,
    }
  }
  return {
    resolve: chromiumDlinkResolver(
      {
        declarativeNetRequest: {
          async updateSessionRules(update) {
            updates.push(update)
          },
        },
        webRequest: { onBeforeSendHeaders: beforeHeaders, onHeadersReceived: headersReceived },
      },
      fetcher,
    ),
    beforeHeaders: null,
    headersReceived,
    updates,
  }
}

function opaqueRedirect(): Response {
  return { status: 0, headers: new Headers() } as Response
}
