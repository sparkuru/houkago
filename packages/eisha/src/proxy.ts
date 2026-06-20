import { EishaBadRequest, EishaUpstreamError } from "./errors"

export type ProxyRef = {
  url: string
  headers?: Record<string, string>
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Response | Promise<Response>

const RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const

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

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

function isHeaderRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.entries(value).every(([key, v]) => key.length > 0 && typeof v === "string")
}
