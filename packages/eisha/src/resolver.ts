import type { Enmoku } from "houkago-kousoku"
import { EishaUnsupportedSource, EishaUpstreamError } from "./errors"
import { resolveBilibiliUrl } from "./parsers/bilibili"
import { parseHlsManifest } from "./parsers/hls"
import {
  type FetchLike,
  type ProxyRef,
  assertHttpUrl,
  assertPublicHttpUrl,
  encodeProxyRef,
} from "./proxy"

export type ResolveUrlInput = {
  title?: string
  url: string
  headers?: Record<string, string>
}

export type ResolveUrlOptions = {
  proxyBase: string
}

export type ResolvedEnmokuSource = {
  title: string
  type: Enmoku["type"]
  url: string
  headers?: Record<string, string>
  subtitles?: Enmoku["subtitles"]
  sources?: Enmoku["sources"]
  danmaku?: Enmoku["danmaku"]
  provider?: Enmoku["provider"]
  live?: boolean
}

export type ResolvedEnmokuPreview = Pick<
  ResolvedEnmokuSource,
  "title" | "type" | "subtitles" | "sources" | "provider" | "live"
>

export function resolveUrl(
  input: ResolveUrlInput,
  options: ResolveUrlOptions,
): ResolvedEnmokuSource {
  const upstream = assertHttpUrl(input.url)
  const proxyBase = options.proxyBase.replace(/\/+$/, "")
  const ref: ProxyRef = { url: upstream.toString(), headers: input.headers }
  const title = input.title?.trim() || defaultTitle(upstream)

  return {
    title,
    type: inferEnmokuType(upstream),
    url: `${proxyBase}/eisha/proxy/${encodeProxyRef(ref)}`,
    headers: input.headers,
  }
}

export function inferEnmokuType(url: URL): Enmoku["type"] {
  const path = url.pathname.toLowerCase()
  if (path.endsWith(".m3u8")) return "hls"
  if (path.endsWith(".mpd")) return "dash"
  return "direct"
}

export async function resolveUrlWithMetadata(
  input: ResolveUrlInput,
  options: ResolveUrlOptions,
  fetcher: FetchLike = fetch,
): Promise<ResolvedEnmokuSource> {
  const bilibili = await resolveBilibiliUrl(input.url, options, fetcher)
  if (bilibili) return { ...bilibili, title: input.title?.trim() || bilibili.title }

  const resolved = resolveUrl(input, options)
  if (resolved.type !== "hls") return resolved

  const upstream = assertHttpUrl(input.url)
  let response: Response
  try {
    response = await fetcher(upstream, { headers: input.headers, redirect: "follow" })
  } catch (error) {
    throw new EishaUpstreamError(error instanceof Error ? error.message : "upstream fetch failed")
  }

  if (!response.ok) {
    throw new EishaUpstreamError(`upstream manifest returned ${response.status}`)
  }

  const metadata = parseHlsManifest(await response.text(), {
    upstreamUrl: upstream,
    proxyBase: options.proxyBase,
    headers: input.headers,
  })
  return { ...resolved, ...metadata }
}

export async function previewPublicUrlWithMetadata(
  input: ResolveUrlInput,
  options: ResolveUrlOptions,
  fetcher: FetchLike = fetch,
): Promise<ResolvedEnmokuPreview> {
  const upstream = assertPublicHttpUrl(input.url)
  const bilibili = await resolveBilibiliUrl(upstream.toString(), options, fetcher)
  if (bilibili) return previewOf({ ...bilibili, title: input.title?.trim() || bilibili.title })

  const resolved = resolveUrl({ ...input, url: upstream.toString() }, options)
  const response = await fetchPreview(upstream, input.headers, fetcher)
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

  if (resolved.type === "hls") {
    if (!isHlsContentType(contentType)) {
      throw new EishaUnsupportedSource("the URL did not return an HLS manifest")
    }
    const metadata = parseHlsManifest(await response.text(), {
      upstreamUrl: upstream,
      proxyBase: options.proxyBase,
      headers: input.headers,
    })
    return previewOf({ ...resolved, ...metadata })
  }

  if (resolved.type === "dash") {
    if (!isDashContentType(contentType)) {
      throw new EishaUnsupportedSource("the URL did not return a DASH manifest")
    }
    return previewOf(resolved)
  }

  if (!contentType.startsWith("video/")) {
    throw new EishaUnsupportedSource("the URL did not return playable video media")
  }
  await response.body?.cancel()
  return previewOf(resolved)
}

function previewOf(source: ResolvedEnmokuSource): ResolvedEnmokuPreview {
  return {
    title: source.title,
    type: source.type,
    subtitles: source.subtitles,
    sources: source.sources,
    provider: source.provider,
    live: source.live,
  }
}

async function fetchPreview(
  upstream: URL,
  headers: Record<string, string> | undefined,
  fetcher: FetchLike,
): Promise<Response> {
  let response: Response
  try {
    response = await fetcher(upstream, {
      headers: { ...headers, range: "bytes=0-0" },
      redirect: "manual",
    })
  } catch (error) {
    throw new EishaUpstreamError(error instanceof Error ? error.message : "upstream fetch failed")
  }

  if (!response.ok) {
    throw new EishaUpstreamError(`upstream preview returned ${response.status}`)
  }
  return response
}

function isHlsContentType(contentType: string): boolean {
  return (
    contentType.includes("application/vnd.apple.mpegurl") ||
    contentType.includes("application/x-mpegurl")
  )
}

function isDashContentType(contentType: string): boolean {
  return contentType.includes("application/dash+xml")
}

function defaultTitle(url: URL): string {
  const tail = url.pathname.split("/").filter(Boolean).at(-1)
  return tail ? decodeURIComponent(tail) : url.hostname
}
