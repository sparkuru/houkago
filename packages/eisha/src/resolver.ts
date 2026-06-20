import type { Enmoku } from "houkago-kousoku"
import { EishaUpstreamError } from "./errors"
import { resolveBilibiliUrl } from "./parsers/bilibili"
import { parseHlsManifest } from "./parsers/hls"
import { type FetchLike, type ProxyRef, assertHttpUrl, encodeProxyRef } from "./proxy"

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

function defaultTitle(url: URL): string {
  const tail = url.pathname.split("/").filter(Boolean).at(-1)
  return tail ? decodeURIComponent(tail) : url.hostname
}
