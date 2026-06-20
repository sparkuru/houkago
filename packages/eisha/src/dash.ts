import { EishaBadRequest } from "./errors"
import { type ProxyRef, assertHttpUrl, encodeProxyRef } from "./proxy"

export type DashSegmentBase = {
  initialization?: string
  indexRange?: string
}

export type DashRepresentation = {
  id: string
  url: string
  bandwidth?: number
  codecs?: string
  width?: number
  height?: number
  segmentBase?: DashSegmentBase
}

export type DashManifestRef = {
  duration?: number
  headers?: Record<string, string>
  video: DashRepresentation[]
  audio: DashRepresentation[]
}

const DASH_MIME_TYPES = {
  video: "video/mp4",
  audio: "audio/mp4",
} as const

export function encodeDashManifestRef(ref: DashManifestRef): string {
  validateDashManifestRef(ref)
  return Buffer.from(JSON.stringify(ref), "utf8").toString("base64url")
}

export function decodeDashManifestRef(token: string): DashManifestRef {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as unknown
    const ref = parseDashManifestRef(parsed)
    validateDashManifestRef(ref)
    return ref
  } catch (error) {
    if (error instanceof EishaBadRequest) throw error
    throw new EishaBadRequest("dash manifest token is invalid")
  }
}

export function dashManifestResponse(ref: DashManifestRef, request: Request): Response {
  const body = buildDashManifest(ref, proxyPrefixFromRequest(request))
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/dash+xml; charset=utf-8",
    },
  })
}

export function buildDashManifest(ref: DashManifestRef, proxyPrefix: string): string {
  validateDashManifestRef(ref)
  const duration =
    ref.duration && ref.duration > 0 ? ` mediaPresentationDuration="PT${ref.duration}S"` : ""
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT1.5S"${duration}>`,
    "  <Period>",
    adaptationSet("video", ref.video, ref, proxyPrefix),
    adaptationSet("audio", ref.audio, ref, proxyPrefix),
    "  </Period>",
    "</MPD>",
  ].join("\n")
}

function parseDashManifestRef(value: unknown): DashManifestRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EishaBadRequest("dash manifest token is invalid")
  }
  const ref = value as {
    duration?: unknown
    headers?: unknown
    video?: unknown
    audio?: unknown
  }
  return {
    duration: typeof ref.duration === "number" ? ref.duration : undefined,
    headers: isHeaderRecord(ref.headers) ? ref.headers : undefined,
    video: parseRepresentations(ref.video),
    audio: parseRepresentations(ref.audio),
  }
}

function parseRepresentations(value: unknown): DashRepresentation[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => parseRepresentation(item))
    .filter((item): item is DashRepresentation => item !== undefined)
}

function parseRepresentation(value: unknown): DashRepresentation | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const item = value as {
    id?: unknown
    url?: unknown
    bandwidth?: unknown
    codecs?: unknown
    width?: unknown
    height?: unknown
    segmentBase?: unknown
  }
  if (typeof item.id !== "string" || typeof item.url !== "string") return undefined
  return {
    id: item.id,
    url: item.url,
    bandwidth: typeof item.bandwidth === "number" ? item.bandwidth : undefined,
    codecs: typeof item.codecs === "string" ? item.codecs : undefined,
    width: typeof item.width === "number" ? item.width : undefined,
    height: typeof item.height === "number" ? item.height : undefined,
    segmentBase: parseSegmentBase(item.segmentBase),
  }
}

function parseSegmentBase(value: unknown): DashSegmentBase | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const segmentBase = value as { initialization?: unknown; indexRange?: unknown }
  const parsed: DashSegmentBase = {}
  if (typeof segmentBase.initialization === "string")
    parsed.initialization = segmentBase.initialization
  if (typeof segmentBase.indexRange === "string") parsed.indexRange = segmentBase.indexRange
  return parsed.initialization || parsed.indexRange ? parsed : undefined
}

function validateDashManifestRef(ref: DashManifestRef): void {
  if (!Array.isArray(ref.video) || ref.video.length === 0) {
    throw new EishaBadRequest("dash manifest has no video representation")
  }
  if (!Array.isArray(ref.audio) || ref.audio.length === 0) {
    throw new EishaBadRequest("dash manifest has no audio representation")
  }
  if (ref.headers !== undefined && !isHeaderRecord(ref.headers)) {
    throw new EishaBadRequest("dash manifest headers are invalid")
  }
  for (const representation of [...ref.video, ...ref.audio]) {
    assertHttpUrl(representation.url)
  }
}

function adaptationSet(
  kind: "video" | "audio",
  representations: DashRepresentation[],
  ref: DashManifestRef,
  proxyPrefix: string,
): string {
  const contentType = `contentType="${kind}"`
  const mimeType = `mimeType="${DASH_MIME_TYPES[kind]}"`
  const lines = [`    <AdaptationSet ${contentType} ${mimeType} segmentAlignment="true">`]
  for (const representation of representations) {
    lines.push(representationNode(kind, representation, ref, proxyPrefix))
  }
  lines.push("    </AdaptationSet>")
  return lines.join("\n")
}

function representationNode(
  kind: "video" | "audio",
  representation: DashRepresentation,
  ref: DashManifestRef,
  proxyPrefix: string,
): string {
  const attributes = [
    `id="${xmlEscape(`${kind}-${representation.id}`)}"`,
    representation.bandwidth ? `bandwidth="${representation.bandwidth}"` : undefined,
    representation.codecs ? `codecs="${xmlEscape(representation.codecs)}"` : undefined,
    kind === "video" && representation.width ? `width="${representation.width}"` : undefined,
    kind === "video" && representation.height ? `height="${representation.height}"` : undefined,
  ].filter((item): item is string => item !== undefined)

  const refUrl = `${proxyPrefix}${encodeProxyRef({
    url: representation.url,
    headers: ref.headers,
  } satisfies ProxyRef)}`
  const lines = [
    `      <Representation ${attributes.join(" ")}>`,
    `        <BaseURL>${xmlEscape(refUrl)}</BaseURL>`,
  ]
  const segmentBase = segmentBaseNode(representation.segmentBase)
  if (segmentBase) lines.push(segmentBase)
  lines.push("      </Representation>")
  return lines.join("\n")
}

function segmentBaseNode(segmentBase: DashSegmentBase | undefined): string | undefined {
  if (!segmentBase) return undefined
  const attributes = segmentBase.indexRange
    ? ` indexRange="${xmlEscape(segmentBase.indexRange)}"`
    : ""
  if (!segmentBase.initialization) return `        <SegmentBase${attributes}/>`
  return [
    `        <SegmentBase${attributes}>`,
    `          <Initialization range="${xmlEscape(segmentBase.initialization)}"/>`,
    "        </SegmentBase>",
  ].join("\n")
}

function isHeaderRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.entries(value).every(([key, v]) => key.length > 0 && typeof v === "string")
}

function proxyPrefixFromRequest(request: Request): string {
  const url = new URL(request.url)
  const marker = "/dash/"
  const markerIndex = url.pathname.lastIndexOf(marker)
  const pathPrefix =
    markerIndex === -1 ? "/eisha/proxy/" : `${url.pathname.slice(0, markerIndex)}/proxy/`
  return `${url.origin}${pathPrefix}`
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}
