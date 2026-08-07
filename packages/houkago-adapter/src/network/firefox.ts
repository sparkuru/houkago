import { type MediaGrantRegistry, withBaiduGrantHeaders } from "../grants"
import type {
  FirefoxBrowser,
  WebRequestDetails,
  WebRequestHeadersReceivedDetails,
  WebRequestRedirectDetails,
} from "../types"

const BAIDU_URLS = [
  "https://d.pcs.baidu.com/*",
  "https://pcs.baidu.com/*",
  "https://*.baidupcs.com/*",
]

export function installFirefoxNetworkPort(
  browserApi: FirefoxBrowser,
  grants: MediaGrantRegistry,
  sentinelUrls: string[],
): () => void {
  const beforeRequest = (details: WebRequestDetails) => {
    if (grants.shouldCancel(details.url, details.requestId, details.tabId)) return { cancel: true }
    const redirectUrl = grants.redirectFor(details.url, details.requestId, details.tabId)
    return redirectUrl ? { redirectUrl } : undefined
  }
  const beforeHeaders = (details: WebRequestDetails) => {
    if (!grants.shouldInjectUserAgent(details.url, details.requestId, details.tabId))
      return undefined
    return { requestHeaders: withBaiduGrantHeaders(details.requestHeaders) }
  }
  const beforeRedirect = (details: WebRequestRedirectDetails) => {
    grants.authorizeRedirect(details.requestId, details.tabId, details.redirectUrl)
    return undefined
  }
  const headersReceived = (details: WebRequestHeadersReceivedDetails) => {
    const location = details.responseHeaders?.find(
      (header) => header.name.toLowerCase() === "location",
    )?.value
    if (!location) return undefined
    let redirectUrl = location
    try {
      redirectUrl = new URL(location, details.url).toString()
    } catch {
      // The tracked grant rejects malformed redirect targets below.
    }
    return grants.shouldBlockRedirect(details.requestId, details.tabId, redirectUrl)
      ? { cancel: true }
      : undefined
  }
  const complete = (details: WebRequestDetails) => {
    grants.completeRequest(details.requestId)
    return undefined
  }

  browserApi.webRequest.onBeforeRequest.addListener(
    beforeRequest,
    { urls: [...sentinelUrls, ...BAIDU_URLS], types: ["media", "xmlhttprequest"] },
    ["blocking"],
  )
  browserApi.webRequest.onBeforeSendHeaders.addListener(
    beforeHeaders,
    { urls: BAIDU_URLS, types: ["media", "xmlhttprequest"] },
    ["blocking", "requestHeaders"],
  )
  browserApi.webRequest.onHeadersReceived.addListener(
    headersReceived,
    { urls: BAIDU_URLS, types: ["media", "xmlhttprequest"] },
    ["blocking", "responseHeaders"],
  )
  browserApi.webRequest.onBeforeRedirect.addListener(beforeRedirect, { urls: BAIDU_URLS })
  browserApi.webRequest.onCompleted.addListener(complete, { urls: BAIDU_URLS })
  browserApi.webRequest.onErrorOccurred.addListener(complete, { urls: BAIDU_URLS })

  return () => {
    browserApi.webRequest.onBeforeRequest.removeListener(beforeRequest)
    browserApi.webRequest.onBeforeSendHeaders.removeListener(beforeHeaders)
    browserApi.webRequest.onHeadersReceived.removeListener(headersReceived)
    browserApi.webRequest.onBeforeRedirect.removeListener(beforeRedirect)
    browserApi.webRequest.onCompleted.removeListener(complete)
    browserApi.webRequest.onErrorOccurred.removeListener(complete)
  }
}
