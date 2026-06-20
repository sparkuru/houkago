import type { Enmoku } from "houkago-kousoku"
import { type ProxyRef, encodeProxyRef } from "../proxy"

export type HlsParseOptions = {
  upstreamUrl: URL
  proxyBase: string
  headers?: Record<string, string>
}

export type HlsMetadata = Pick<Enmoku, "sources" | "subtitles" | "live">

export function parseHlsManifest(manifest: string, options: HlsParseOptions): HlsMetadata {
  const sources: NonNullable<Enmoku["sources"]> = []
  const subtitles: NonNullable<Enmoku["subtitles"]> = {}
  const lines = manifest.split(/\r?\n/)
  let pendingStream: Record<string, string> | undefined
  let isMasterPlaylist = false
  let uriIndex = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith("#EXT-X-STREAM-INF:")) {
      pendingStream = parseAttributeList(trimmed.slice("#EXT-X-STREAM-INF:".length))
      isMasterPlaylist = true
      continue
    }

    if (trimmed.startsWith("#EXT-X-MEDIA:")) {
      const media = parseAttributeList(trimmed.slice("#EXT-X-MEDIA:".length))
      if (media.URI) {
        const currentUriIndex = uriIndex
        if (isRewriteableHlsUri(media.URI, options.upstreamUrl)) uriIndex += 1
        const url =
          media.TYPE === "SUBTITLES" ? proxyHlsUrl(media.URI, options, currentUriIndex) : undefined
        if (url) {
          subtitles[
            media.NAME || media.LANGUAGE || `subtitles-${Object.keys(subtitles).length + 1}`
          ] = {
            type: "hls",
            url,
          }
        }
      }
      isMasterPlaylist = true
      continue
    }

    if (pendingStream && !trimmed.startsWith("#")) {
      const currentUriIndex = uriIndex
      if (isRewriteableHlsUri(trimmed, options.upstreamUrl)) uriIndex += 1
      const url = proxyHlsUrl(trimmed, options, currentUriIndex)
      if (url) {
        sources.push({
          name: sourceName(pendingStream, sources.length + 1),
          url,
        })
      }
      pendingStream = undefined
    }
  }

  return {
    sources: sources.length > 0 ? sources : undefined,
    subtitles: Object.keys(subtitles).length > 0 ? subtitles : undefined,
    live: isMasterPlaylist ? undefined : !manifest.includes("#EXT-X-ENDLIST"),
  }
}

function proxyHlsUrl(uri: string, options: HlsParseOptions, uriIndex: number): string | undefined {
  let resolved: URL
  try {
    resolved = new URL(uri, options.upstreamUrl)
  } catch {
    return undefined
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return undefined

  const proxyBase = options.proxyBase.replace(/\/+$/, "")
  const ref: ProxyRef = {
    url: resolved.toString(),
    headers: options.headers,
    hls: {
      manifestUrl: options.upstreamUrl.toString(),
      uri,
      uriIndex,
    },
  }
  return `${proxyBase}/eisha/proxy/${encodeProxyRef(ref)}`
}

function isRewriteableHlsUri(uri: string, upstreamUrl: URL): boolean {
  try {
    const resolved = new URL(uri, upstreamUrl)
    return resolved.protocol === "http:" || resolved.protocol === "https:"
  } catch {
    return false
  }
}

function sourceName(attrs: Record<string, string>, index: number): string {
  const bandwidth = Number(attrs.BANDWIDTH)
  const bandwidthLabel = Number.isFinite(bandwidth) ? `${Math.round(bandwidth / 1000)}k` : undefined

  if (attrs.RESOLUTION && bandwidthLabel) return `${attrs.RESOLUTION} · ${bandwidthLabel}`
  if (attrs.RESOLUTION) return attrs.RESOLUTION
  if (bandwidthLabel) return bandwidthLabel
  return `Source ${index}`
}

function parseAttributeList(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const part of splitAttributeList(raw)) {
    const equalsIndex = part.indexOf("=")
    if (equalsIndex === -1) continue

    const key = part.slice(0, equalsIndex).trim()
    const value = unquoteAttributeValue(part.slice(equalsIndex + 1).trim())
    if (key) attrs[key] = value
  }
  return attrs
}

function splitAttributeList(raw: string): string[] {
  const parts: string[] = []
  let quote: string | undefined
  let start = 0

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    if ((char === '"' || char === "'") && raw[i - 1] !== "\\") {
      quote = quote === char ? undefined : (quote ?? char)
    } else if (char === "," && !quote) {
      parts.push(raw.slice(start, i))
      start = i + 1
    }
  }

  parts.push(raw.slice(start))
  return parts
}

function unquoteAttributeValue(value: string): string {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}
