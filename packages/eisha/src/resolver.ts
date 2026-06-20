import type { Enmoku } from "houkago-kousoku"
import { type ProxyRef, assertHttpUrl, encodeProxyRef } from "./proxy"

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

function defaultTitle(url: URL): string {
  const tail = url.pathname.split("/").filter(Boolean).at(-1)
  return tail ? decodeURIComponent(tail) : url.hostname
}
