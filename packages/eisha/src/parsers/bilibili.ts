import type { Enmoku } from "houkago-kousoku"
import {
  type DashManifestRef,
  type DashRepresentation,
  type DashSegmentBase,
  encodeDashManifestRef,
} from "../dash"
import { EishaUpstreamError } from "../errors"
import { type FetchLike, assertHttpUrl } from "../proxy"

export type BilibiliResolveOptions = {
  proxyBase: string
}

export type BilibiliResolvedSource = {
  title: string
  type: Enmoku["type"]
  url: string
  headers: Record<string, string>
  sources?: Enmoku["sources"]
  danmaku?: Enmoku["danmaku"]
}

type BilibiliViewData = {
  title: string
  bvid: string
  duration?: number
  cid?: number
  pages?: { cid: number; page?: number; part?: string }[]
}

type BilibiliDashVideo = {
  id: number
  baseUrl: string
  width?: number
  height?: number
  codecs?: string
  bandwidth?: number
  segmentBase?: DashSegmentBase
}

type BilibiliDashAudio = {
  id: number
  baseUrl: string
  codecs?: string
  bandwidth?: number
  segmentBase?: DashSegmentBase
}

type BilibiliPlayData = {
  quality?: number
  dash?: {
    video?: BilibiliDashVideo[]
    audio?: BilibiliDashAudio[]
  }
  supportFormats?: { quality: number; displayDesc?: string; newDescription?: string }[]
}

const BVID_PATTERN = /BV[0-9A-Za-z]+/
const BILIBILI_HOSTS = new Set(["bilibili.com", "www.bilibili.com"])
const BILIBILI_MEDIA_HEADERS = {
  referer: "https://www.bilibili.com/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
}

export function isBilibiliUrl(raw: string): boolean {
  return bilibiliBvidFromUrl(raw) !== undefined
}

export function bilibiliBvidFromUrl(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
  if (!isBilibiliHost(url.hostname)) return undefined
  return url.pathname.match(BVID_PATTERN)?.[0]
}

export async function resolveBilibiliUrl(
  rawUrl: string,
  options: BilibiliResolveOptions,
  fetcher: FetchLike = fetch,
): Promise<BilibiliResolvedSource | undefined> {
  const bvid = bilibiliBvidFromUrl(rawUrl)
  if (!bvid) return undefined

  const view = await fetchBilibiliJson<BilibiliViewData>(
    bilibiliApiUrl("/x/web-interface/view", { bvid }),
    fetcher,
    parseViewData,
  )
  const cid = selectCid(view)
  const play = await fetchBilibiliJson<BilibiliPlayData>(
    bilibiliApiUrl("/x/player/playurl", {
      bvid,
      cid: String(cid),
      fnval: "16",
      qn: "64",
      fourk: "1",
    }),
    fetcher,
    parsePlayData,
  )

  const videos = play.dash?.video ?? []
  const audios = play.dash?.audio ?? []
  const playableVideos = preferredVideos(videos)
  const primary = playableVideos[0]
  if (!primary) throw new EishaUpstreamError("bilibili playurl has no playable video")
  if (!audios[0]) throw new EishaUpstreamError("bilibili playurl has no playable audio")

  const headers = { ...BILIBILI_MEDIA_HEADERS }
  return {
    title: view.title,
    type: "dash",
    url: bilibiliDashManifestUrl(playableVideos, audios, view, options, headers),
    headers,
    sources: sourcesFromVideos(playableVideos, audios, view, play, options, headers),
    danmaku: { type: "fetch", ref: `bilibili:${cid}` },
  }
}

function isBilibiliHost(hostname: string): boolean {
  if (BILIBILI_HOSTS.has(hostname)) return true
  return hostname.endsWith(".bilibili.com")
}

function bilibiliApiUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(path, "https://api.bilibili.com")
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

async function fetchBilibiliJson<T>(
  url: URL,
  fetcher: FetchLike,
  parseData: (value: unknown) => T | undefined,
): Promise<T> {
  let response: Response
  try {
    response = await fetcher(url, { headers: BILIBILI_MEDIA_HEADERS, redirect: "follow" })
  } catch (error) {
    throw new EishaUpstreamError(error instanceof Error ? error.message : "bilibili fetch failed")
  }
  if (!response.ok) throw new EishaUpstreamError(`bilibili api returned ${response.status}`)

  const payload = (await response.json()) as unknown
  const data = bilibiliApiData(payload)
  const parsed = parseData(data)
  if (!parsed) throw new EishaUpstreamError("bilibili api response is unsupported")
  return parsed
}

function bilibiliApiData(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    throw new EishaUpstreamError("bilibili api response is invalid")
  }
  const body = payload as { code?: unknown; message?: unknown; data?: unknown }
  if (body.code !== 0) {
    throw new EishaUpstreamError(
      typeof body.message === "string" ? body.message : "bilibili api returned an error",
    )
  }
  return body.data
}

function parseViewData(value: unknown): BilibiliViewData | undefined {
  if (!value || typeof value !== "object") return undefined
  const data = value as { title?: unknown; bvid?: unknown; cid?: unknown; pages?: unknown }
  if (typeof data.title !== "string" || typeof data.bvid !== "string") return undefined

  const view: BilibiliViewData = { title: data.title, bvid: data.bvid }
  if (typeof (data as { duration?: unknown }).duration === "number") {
    view.duration = (data as { duration: number }).duration
  }
  if (typeof data.cid === "number") view.cid = data.cid
  if (Array.isArray(data.pages)) {
    view.pages = data.pages
      .map((item) => parseBilibiliPage(item))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
  }
  return view
}

function parseBilibiliPage(
  value: unknown,
): { cid: number; page?: number; part?: string } | undefined {
  if (!value || typeof value !== "object") return undefined
  const page = value as { cid?: unknown; page?: unknown; part?: unknown }
  if (typeof page.cid !== "number") return undefined
  return {
    cid: page.cid,
    page: typeof page.page === "number" ? page.page : undefined,
    part: typeof page.part === "string" ? page.part : undefined,
  }
}

function parsePlayData(value: unknown): BilibiliPlayData | undefined {
  if (!value || typeof value !== "object") return undefined
  const data = value as {
    quality?: unknown
    dash?: unknown
    support_formats?: unknown
    supportFormats?: unknown
  }
  const play: BilibiliPlayData = {}
  if (typeof data.quality === "number") play.quality = data.quality
  if (data.dash && typeof data.dash === "object") {
    const dash = data.dash as { video?: unknown; audio?: unknown }
    if (Array.isArray(dash.video)) {
      play.dash = {
        video: dash.video
          .map((item) => parseDashVideo(item))
          .filter((item): item is NonNullable<typeof item> => item !== undefined),
      }
    }
    if (Array.isArray(dash.audio)) {
      play.dash = {
        ...play.dash,
        audio: dash.audio
          .map((item) => parseDashAudio(item))
          .filter((item): item is NonNullable<typeof item> => item !== undefined),
      }
    }
  }
  const rawFormats = Array.isArray(data.support_formats)
    ? data.support_formats
    : data.supportFormats
  if (Array.isArray(rawFormats)) {
    play.supportFormats = rawFormats
      .map((item) => parseSupportFormat(item))
      .filter((item): item is NonNullable<typeof item> => item !== undefined)
  }
  return play
}

function parseDashVideo(value: unknown): BilibiliDashVideo | undefined {
  if (!value || typeof value !== "object") return undefined
  const video = value as {
    id?: unknown
    baseUrl?: unknown
    base_url?: unknown
    width?: unknown
    height?: unknown
    codecs?: unknown
    bandwidth?: unknown
    segment_base?: unknown
  }
  const baseUrl = typeof video.baseUrl === "string" ? video.baseUrl : video.base_url
  if (typeof video.id !== "number" || typeof baseUrl !== "string") return undefined
  return {
    id: video.id,
    baseUrl,
    width: typeof video.width === "number" ? video.width : undefined,
    height: typeof video.height === "number" ? video.height : undefined,
    codecs: typeof video.codecs === "string" ? video.codecs : undefined,
    bandwidth: typeof video.bandwidth === "number" ? video.bandwidth : undefined,
    segmentBase: parseSegmentBase(video.segment_base),
  }
}

function parseDashAudio(value: unknown): BilibiliDashAudio | undefined {
  if (!value || typeof value !== "object") return undefined
  const audio = value as {
    id?: unknown
    baseUrl?: unknown
    base_url?: unknown
    codecs?: unknown
    bandwidth?: unknown
    segment_base?: unknown
  }
  const baseUrl = typeof audio.baseUrl === "string" ? audio.baseUrl : audio.base_url
  if (typeof audio.id !== "number" || typeof baseUrl !== "string") return undefined
  return {
    id: audio.id,
    baseUrl,
    codecs: typeof audio.codecs === "string" ? audio.codecs : undefined,
    bandwidth: typeof audio.bandwidth === "number" ? audio.bandwidth : undefined,
    segmentBase: parseSegmentBase(audio.segment_base),
  }
}

function parseSegmentBase(value: unknown): DashSegmentBase | undefined {
  if (!value || typeof value !== "object") return undefined
  const segmentBase = value as {
    initialization?: unknown
    index_range?: unknown
    indexRange?: unknown
  }
  const initialization =
    typeof segmentBase.initialization === "string" ? segmentBase.initialization : undefined
  const indexRange =
    typeof segmentBase.index_range === "string"
      ? segmentBase.index_range
      : typeof segmentBase.indexRange === "string"
        ? segmentBase.indexRange
        : undefined
  return initialization || indexRange ? { initialization, indexRange } : undefined
}

function parseSupportFormat(
  value: unknown,
): { quality: number; displayDesc?: string; newDescription?: string } | undefined {
  if (!value || typeof value !== "object") return undefined
  const format = value as {
    quality?: unknown
    display_desc?: unknown
    displayDesc?: unknown
    new_description?: unknown
    newDescription?: unknown
  }
  if (typeof format.quality !== "number") return undefined
  return {
    quality: format.quality,
    displayDesc:
      typeof format.display_desc === "string"
        ? format.display_desc
        : typeof format.displayDesc === "string"
          ? format.displayDesc
          : undefined,
    newDescription:
      typeof format.new_description === "string"
        ? format.new_description
        : typeof format.newDescription === "string"
          ? format.newDescription
          : undefined,
  }
}

function selectCid(view: BilibiliViewData): number {
  const cid = view.cid ?? view.pages?.[0]?.cid
  if (typeof cid !== "number") throw new EishaUpstreamError("bilibili view has no cid")
  return cid
}

function preferredVideos(videos: BilibiliDashVideo[]): BilibiliDashVideo[] {
  const byQuality = new Map<number, BilibiliDashVideo>()
  for (const video of videos.filter(isBrowserPlayableVideo)) {
    if (!byQuality.has(video.id)) byQuality.set(video.id, video)
  }
  return [...byQuality.values()]
}

function isBrowserPlayableVideo(video: BilibiliDashVideo): boolean {
  const codec = video.codecs?.toLowerCase()
  return codec === undefined || codec.startsWith("avc1")
}

function sourcesFromVideos(
  videos: BilibiliDashVideo[],
  audios: BilibiliDashAudio[],
  view: BilibiliViewData,
  play: BilibiliPlayData,
  options: BilibiliResolveOptions,
  headers: Record<string, string>,
): Enmoku["sources"] | undefined {
  if (videos.length === 0) return undefined
  return videos.map((video, index) => ({
    name: sourceName(video, play, index + 1),
    url: bilibiliDashManifestUrl([video], audios, view, options, headers),
  }))
}

function sourceName(video: BilibiliDashVideo, play: BilibiliPlayData, index: number): string {
  const quality = play.supportFormats?.find((format) => format.quality === video.id)
  const qualityName = quality?.displayDesc ?? quality?.newDescription
  const size = video.width && video.height ? `${video.width}x${video.height}` : undefined
  const codec = video.codecs?.split(".")[0]

  return (
    [qualityName, size, codec].filter((part) => part && part.length > 0).join(" · ") ||
    `Source ${index}`
  )
}

function bilibiliDashManifestUrl(
  videos: BilibiliDashVideo[],
  audios: BilibiliDashAudio[],
  view: BilibiliViewData,
  options: BilibiliResolveOptions,
  headers: Record<string, string>,
): string {
  const proxyBase = options.proxyBase.replace(/\/+$/, "")
  const ref: DashManifestRef = {
    duration: view.duration,
    headers,
    video: videos.map(dashVideoRepresentation),
    audio: audios.map(dashAudioRepresentation),
  }
  return `${proxyBase}/eisha/dash/${encodeDashManifestRef(ref)}`
}

function dashVideoRepresentation(video: BilibiliDashVideo): DashRepresentation {
  assertHttpUrl(video.baseUrl)
  return {
    id: String(video.id),
    url: video.baseUrl,
    bandwidth: video.bandwidth,
    codecs: video.codecs,
    width: video.width,
    height: video.height,
    segmentBase: video.segmentBase,
  }
}

function dashAudioRepresentation(audio: BilibiliDashAudio): DashRepresentation {
  assertHttpUrl(audio.baseUrl)
  return {
    id: String(audio.id),
    url: audio.baseUrl,
    bandwidth: audio.bandwidth,
    codecs: audio.codecs,
    segmentBase: audio.segmentBase,
  }
}
