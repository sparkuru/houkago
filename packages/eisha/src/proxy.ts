import { EishaBadRequest, EishaUpstreamError } from "./errors"

export type ProxyRef = {
  url: string
  headers?: Record<string, string>
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
    const ref = parsed as { url?: unknown; headers?: unknown }
    if (typeof ref.url !== "string") throw new Error("missing url")
    if (ref.headers !== undefined && !isHeaderRecord(ref.headers)) {
      throw new Error("invalid headers")
    }
    const proxyRef: ProxyRef = { url: ref.url, headers: ref.headers }
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
  return manifest
    .split("\n")
    .map((line) => rewriteM3u8Line(line, options))
    .join("\n")
}

function isHeaderRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.entries(value).every(([key, v]) => key.length > 0 && typeof v === "string")
}

function rewriteM3u8Line(line: string, options: RewriteM3u8Options): string {
  const trimmed = line.trim()
  if (!trimmed) return line
  if (!trimmed.startsWith("#")) return rewriteUri(trimmed, options) ?? line
  if (!trimmed.includes("URI=")) return line

  return line.replace(URI_ATTRIBUTE, (match, doubleQuoted, singleQuoted, unquoted) => {
    const value = (doubleQuoted ?? singleQuoted ?? unquoted ?? "").trim()
    const rewritten = rewriteUri(value, options)
    if (!rewritten) return match
    if (doubleQuoted !== undefined) return `URI="${rewritten}"`
    if (singleQuoted !== undefined) return `URI='${rewritten}'`
    return `URI=${rewritten}`
  })
}

function rewriteUri(uri: string, options: RewriteM3u8Options): string | undefined {
  let resolved: URL
  try {
    resolved = new URL(uri, options.upstreamUrl)
  } catch {
    return undefined
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return undefined
  return `${options.proxyPrefix}${encodeProxyRef({ url: resolved.toString(), headers: options.headers })}`
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
