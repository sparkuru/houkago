import { EishaBadRequest, EishaUpstreamError } from "./errors"

export type ProxyRef = {
  url: string
  headers?: Record<string, string>
  hls?: HlsRefreshRef
}

export type HlsRefreshRef = {
  manifestUrl: string
  uri: string
  uriIndex: number
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Response | Promise<Response>

export type RewriteM3u8Options = {
  upstreamUrl: URL
  proxyPrefix: string
  headers?: Record<string, string>
}

const RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const

const REWRITTEN_RESPONSE_HEADERS = ["cache-control", "content-type", "last-modified"] as const
const URI_ATTRIBUTE = /\bURI=(?:"([^"]*)"|'([^']*)'|([^,]*))/g
const EXPIRY_STATUSES = new Set([401, 403, 404, 410])

export function assertHttpUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new EishaBadRequest("upstream URL is invalid")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new EishaBadRequest("only http(s) upstream URLs are supported")
  }
  return url
}

export function encodeProxyRef(ref: ProxyRef): string {
  assertHttpUrl(ref.url)
  return Buffer.from(JSON.stringify(ref), "utf8").toString("base64url")
}

export function decodeProxyRef(token: string): ProxyRef {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as unknown
    if (!parsed || typeof parsed !== "object") throw new Error("not an object")
    const ref = parsed as { url?: unknown; headers?: unknown; hls?: unknown }
    if (typeof ref.url !== "string") throw new Error("missing url")
    if (ref.headers !== undefined && !isHeaderRecord(ref.headers)) {
      throw new Error("invalid headers")
    }
    const proxyRef: ProxyRef = { url: ref.url }
    if (ref.headers !== undefined) proxyRef.headers = ref.headers
    const hls = parseHlsRefreshRef(ref.hls)
    if (hls) proxyRef.hls = hls
    assertHttpUrl(proxyRef.url)
    return proxyRef
  } catch (error) {
    if (error instanceof EishaBadRequest) throw error
    throw new EishaBadRequest("proxy token is invalid")
  }
}

export async function proxyUpstream(
  ref: ProxyRef,
  request: Request,
  fetcher: FetchLike = fetch,
  allowRefresh = true,
): Promise<Response> {
  const upstreamUrl = assertHttpUrl(ref.url)
  const headers = new Headers(ref.headers)
  const range = request.headers.get("range")
  if (range) headers.set("range", range)

  let upstream: Response
  try {
    upstream = await fetcher(upstreamUrl, { headers, redirect: "follow" })
  } catch (error) {
    throw new EishaUpstreamError(error instanceof Error ? error.message : "upstream fetch failed")
  }

  if (allowRefresh && shouldRetryWithRefRefresh(ref, upstream)) {
    const refreshedRef = await refreshHlsProxyRef(ref, fetcher)
    if (refreshedRef) {
      return proxyUpstream(refreshedRef, request, fetcher, false)
    }
  }

  const responseHeaders = new Headers()
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value !== null) responseHeaders.set(name, value)
  }

  if (!range && upstream.ok && shouldRewriteM3u8(upstreamUrl, upstream)) {
    const rewrittenHeaders = new Headers()
    for (const name of REWRITTEN_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name)
      if (value !== null) rewrittenHeaders.set(name, value)
    }
    if (!rewrittenHeaders.has("content-type")) {
      rewrittenHeaders.set("content-type", "application/vnd.apple.mpegurl")
    }

    const manifest = await upstream.text()
    const rewritten = rewriteM3u8Manifest(manifest, {
      upstreamUrl,
      proxyPrefix: proxyPrefixFromRequest(request),
      headers: ref.headers,
    })

    return new Response(rewritten, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: rewrittenHeaders,
    })
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export function rewriteM3u8Manifest(manifest: string, options: RewriteM3u8Options): string {
  let uriIndex = 0
  return manifest
    .split("\n")
    .map((line) =>
      rewriteM3u8Line(line, options, () => {
        const next = uriIndex
        uriIndex += 1
        return next
      }),
    )
    .join("\n")
}

function isHeaderRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.entries(value).every(([key, v]) => key.length > 0 && typeof v === "string")
}

function parseHlsRefreshRef(value: unknown): HlsRefreshRef | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid hls refresh")
  }

  const hls = value as { manifestUrl?: unknown; uri?: unknown; uriIndex?: unknown }
  const uriIndex = hls.uriIndex
  if (typeof hls.manifestUrl !== "string") throw new Error("missing hls manifest")
  if (typeof hls.uri !== "string") throw new Error("missing hls uri")
  if (typeof uriIndex !== "number" || !Number.isInteger(uriIndex) || uriIndex < 0) {
    throw new Error("invalid hls uri index")
  }

  assertHttpUrl(hls.manifestUrl)
  return { manifestUrl: hls.manifestUrl, uri: hls.uri, uriIndex }
}

function rewriteM3u8Line(
  line: string,
  options: RewriteM3u8Options,
  nextUriIndex: () => number,
): string {
  const trimmed = line.trim()
  if (!trimmed) return line
  if (!trimmed.startsWith("#")) return rewriteUri(trimmed, options, nextUriIndex) ?? line
  if (!trimmed.includes("URI=")) return line

  return line.replace(URI_ATTRIBUTE, (match, doubleQuoted, singleQuoted, unquoted) => {
    const value = (doubleQuoted ?? singleQuoted ?? unquoted ?? "").trim()
    const rewritten = rewriteUri(value, options, nextUriIndex)
    if (!rewritten) return match
    if (doubleQuoted !== undefined) return `URI="${rewritten}"`
    if (singleQuoted !== undefined) return `URI='${rewritten}'`
    return `URI=${rewritten}`
  })
}

function rewriteUri(
  uri: string,
  options: RewriteM3u8Options,
  nextUriIndex: () => number,
): string | undefined {
  let resolved: URL
  try {
    resolved = new URL(uri, options.upstreamUrl)
  } catch {
    return undefined
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return undefined
  const uriIndex = nextUriIndex()
  return `${options.proxyPrefix}${encodeProxyRef({
    url: resolved.toString(),
    headers: options.headers,
    hls: {
      manifestUrl: options.upstreamUrl.toString(),
      uri,
      uriIndex,
    },
  })}`
}

async function refreshHlsProxyRef(
  ref: ProxyRef,
  fetcher: FetchLike,
): Promise<ProxyRef | undefined> {
  if (!ref.hls) return undefined

  const manifestUrl = assertHttpUrl(ref.hls.manifestUrl)
  let manifest: Response
  try {
    manifest = await fetcher(manifestUrl, { headers: ref.headers, redirect: "follow" })
  } catch (error) {
    throw new EishaUpstreamError(error instanceof Error ? error.message : "upstream fetch failed")
  }

  if (!manifest.ok) return undefined

  const manifestText = await manifest.text()
  const refreshedBaseUrl = responseUrl(manifest, manifestUrl)
  const refreshedUri = hlsUriAt(manifestText, refreshedBaseUrl, ref.hls.uriIndex) ?? ref.hls.uri
  const refreshedUrl = assertHttpUrl(new URL(refreshedUri, refreshedBaseUrl).toString()).toString()
  return { ...ref, url: refreshedUrl }
}

function hlsUriAt(manifest: string, upstreamUrl: URL, targetIndex: number): string | undefined {
  let uriIndex = 0
  for (const line of manifest.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (!trimmed.startsWith("#")) {
      if (isRewriteableUri(trimmed, upstreamUrl)) {
        if (uriIndex === targetIndex) return trimmed
        uriIndex += 1
      }
      continue
    }

    if (!trimmed.includes("URI=")) continue
    for (const match of trimmed.matchAll(URI_ATTRIBUTE)) {
      const value = (match[1] ?? match[2] ?? match[3] ?? "").trim()
      if (!isRewriteableUri(value, upstreamUrl)) continue
      if (uriIndex === targetIndex) return value
      uriIndex += 1
    }
  }
  return undefined
}

function isRewriteableUri(uri: string, upstreamUrl: URL): boolean {
  try {
    const resolved = new URL(uri, upstreamUrl)
    return resolved.protocol === "http:" || resolved.protocol === "https:"
  } catch {
    return false
  }
}

function responseUrl(response: Response, fallback: URL): URL {
  return response.url ? assertHttpUrl(response.url) : fallback
}

function shouldRetryWithRefRefresh(ref: ProxyRef, upstream: Response): boolean {
  return ref.hls !== undefined && EXPIRY_STATUSES.has(upstream.status)
}

function shouldRewriteM3u8(upstreamUrl: URL, upstream: Response): boolean {
  const contentType = upstream.headers.get("content-type")?.toLowerCase() ?? ""
  return (
    upstreamUrl.pathname.toLowerCase().endsWith(".m3u8") ||
    contentType.includes("mpegurl") ||
    contentType.includes("m3u8")
  )
}

function proxyPrefixFromRequest(request: Request): string {
  const url = new URL(request.url)
  const marker = "/proxy/"
  const markerIndex = url.pathname.lastIndexOf(marker)
  const pathPrefix =
    markerIndex === -1 ? "/eisha/proxy/" : url.pathname.slice(0, markerIndex + marker.length)
  return `${url.origin}${pathPrefix}`
}
