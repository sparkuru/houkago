import { parseBilibiliXml } from "houkago-kokuban"
import type { DanmakuCue } from "houkago-kokuban"
import { EishaBadRequest, EishaUpstreamError } from "./errors"
import type { FetchLike } from "./proxy"

const BILIBILI_DANMAKU_REF = /^bilibili:(\d+)$/
const BILIBILI_DANMAKU_HEADERS = {
  referer: "https://www.bilibili.com/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
}

export function decodeDanmakuRef(raw: string): { provider: "bilibili"; cid: string } {
  const ref = decodeURIComponent(raw)
  const match = ref.match(BILIBILI_DANMAKU_REF)
  if (!match?.[1]) throw new EishaBadRequest("danmaku ref is invalid")
  return { provider: "bilibili", cid: match[1] }
}

export async function fetchDanmakuCues(
  rawRef: string,
  fetcher: FetchLike = fetch,
): Promise<DanmakuCue[]> {
  const ref = decodeDanmakuRef(rawRef)
  switch (ref.provider) {
    case "bilibili":
      return fetchBilibiliDanmakuCues(ref.cid, fetcher)
  }
}

async function fetchBilibiliDanmakuCues(cid: string, fetcher: FetchLike): Promise<DanmakuCue[]> {
  const upstream = new URL(`https://comment.bilibili.com/${cid}.xml`)
  let response: Response
  try {
    response = await fetcher(upstream, { headers: BILIBILI_DANMAKU_HEADERS, redirect: "follow" })
  } catch (error) {
    throw new EishaUpstreamError(
      error instanceof Error ? error.message : "bilibili danmaku fetch failed",
    )
  }
  if (!response.ok) throw new EishaUpstreamError(`bilibili danmaku returned ${response.status}`)

  return parseBilibiliXml(await response.text())
}
