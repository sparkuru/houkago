import { type BaiduDlink, type BaiduFetcher, fetchBaiduDlink } from "houkago-eisha/baidu"
import { withBaiduUserAgent } from "./grants"
import type {
  ChromiumDlinkBrowser,
  FirefoxBrowser,
  WebRequestDetails,
  WebRequestHeadersReceivedDetails,
} from "./types"

export type BaiduDlinkResolver = (accessToken: string, fsid: string) => Promise<BaiduDlink>

export function firefoxDlinkResolver(
  browserApi: FirefoxBrowser,
  baseFetcher: BaiduFetcher = fetch,
): BaiduDlinkResolver {
  const runExclusive = exclusiveByKey()
  return (accessToken, fsid) =>
    fetchBaiduDlink(accessToken, fsid, async (input, init) => {
      if (init?.method !== "HEAD") return baseFetcher(input, init)
      const rawUrl = String(input)
      return runExclusive(rawUrl, async () => {
        let requestId: string | null = null
        let redirect: ObservedRedirect | null = null
        const beforeHeaders = (details: WebRequestDetails) => {
          if (!isExactPrivateHead(details, rawUrl) || requestId !== null) return undefined
          requestId = details.requestId
          return { requestHeaders: withBaiduUserAgent(details.requestHeaders) }
        }
        const headersReceived = (details: WebRequestHeadersReceivedDetails) => {
          if (details.requestId === requestId && isExactPrivateHead(details, rawUrl)) {
            redirect = observedRedirect(details)
          }
          return undefined
        }
        browserApi.webRequest.onBeforeSendHeaders.addListener(
          beforeHeaders,
          { urls: [requestPattern(rawUrl)], types: ["xmlhttprequest"] },
          ["blocking", "requestHeaders"],
        )
        try {
          browserApi.webRequest.onHeadersReceived.addListener(
            headersReceived,
            { urls: [requestPattern(rawUrl)], types: ["xmlhttprequest"] },
            ["responseHeaders"],
          )
          return adaptOpaqueRedirect(await baseFetcher(input, init), redirect)
        } finally {
          browserApi.webRequest.onBeforeSendHeaders.removeListener(beforeHeaders)
          browserApi.webRequest.onHeadersReceived.removeListener(headersReceived)
        }
      })
    })
}

export function chromiumDlinkResolver(
  browserApi: ChromiumDlinkBrowser,
  baseFetcher: BaiduFetcher = fetch,
): BaiduDlinkResolver {
  let nextRuleId = 40_000
  const runExclusive = exclusiveByKey()
  return (accessToken, fsid) =>
    fetchBaiduDlink(accessToken, fsid, async (input, init) => {
      if (init?.method !== "HEAD") return baseFetcher(input, init)
      const rawUrl = String(input)
      return runExclusive(rawUrl, async () => {
        const ruleId = nextRuleId++
        let requestId: string | null = null
        let redirect: ObservedRedirect | null = null
        const beforeHeaders = (details: WebRequestDetails) => {
          if (isExactPrivateHead(details, rawUrl) && requestId === null) {
            requestId = details.requestId
          }
          return undefined
        }
        const headersReceived = (details: WebRequestHeadersReceivedDetails) => {
          if (details.requestId === requestId && isExactPrivateHead(details, rawUrl)) {
            redirect = observedRedirect(details)
          }
          return undefined
        }
        let beforeHeadersInstalled = false
        let headersReceivedInstalled = false
        let ruleInstalled = false
        try {
          browserApi.webRequest.onBeforeSendHeaders.addListener(beforeHeaders, {
            urls: [requestPattern(rawUrl)],
            types: ["xmlhttprequest"],
          })
          beforeHeadersInstalled = true
          browserApi.webRequest.onHeadersReceived.addListener(
            headersReceived,
            { urls: [requestPattern(rawUrl)], types: ["xmlhttprequest"] },
            ["responseHeaders"],
          )
          headersReceivedInstalled = true
          await browserApi.declarativeNetRequest.updateSessionRules({
            removeRuleIds: [ruleId],
            addRules: [
              {
                id: ruleId,
                priority: 2,
                action: {
                  type: "modifyHeaders",
                  requestHeaders: [
                    { header: "user-agent", operation: "set", value: "pan.baidu.com" },
                  ],
                },
                condition: {
                  urlFilter: `|${rawUrl}|`,
                  tabIds: [-1],
                  resourceTypes: ["xmlhttprequest"],
                },
              },
            ],
          })
          ruleInstalled = true
          return adaptOpaqueRedirect(await baseFetcher(input, init), redirect)
        } finally {
          if (beforeHeadersInstalled) {
            browserApi.webRequest.onBeforeSendHeaders.removeListener(beforeHeaders)
          }
          if (headersReceivedInstalled) {
            browserApi.webRequest.onHeadersReceived.removeListener(headersReceived)
          }
          if (ruleInstalled) {
            await browserApi.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] })
          }
        }
      })
    })
}

type ObservedRedirect = { statusCode: number; location?: string }

function observedRedirect(details: WebRequestHeadersReceivedDetails): ObservedRedirect | null {
  if (details.statusCode === undefined) return null
  const location = details.responseHeaders?.find(
    (header) => header.name.toLowerCase() === "location",
  )?.value
  return location === undefined
    ? { statusCode: details.statusCode }
    : { statusCode: details.statusCode, location }
}

function adaptOpaqueRedirect(response: Response, redirect: ObservedRedirect | null): Response {
  if (response.status !== 0 || !redirect) return response
  if (redirect.statusCode < 300 || redirect.statusCode >= 400) return response
  const headers = new Headers()
  if (redirect.location) headers.set("location", redirect.location)
  return new Response(null, { status: redirect.statusCode, headers })
}

function isExactPrivateHead(details: WebRequestDetails, rawUrl: string): boolean {
  return details.url === rawUrl && details.method?.toUpperCase() === "HEAD"
}

function requestPattern(value: string): string {
  const url = new URL(value)
  return `${url.protocol}//${url.hostname}${url.pathname}*`
}

function exclusiveByKey() {
  const tails = new Map<string, Promise<void>>()
  return async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve()
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => gate)
    tails.set(key, tail)
    await previous
    try {
      return await operation()
    } finally {
      release()
      if (tails.get(key) === tail) tails.delete(key)
    }
  }
}
