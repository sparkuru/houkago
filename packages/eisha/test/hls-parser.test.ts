import { expect, test } from "bun:test"
import { parseHlsManifest } from "../src/parsers/hls"
import { decodeProxyRef } from "../src/proxy"

const proxyBase = "https://housou.example.test"
const upstreamUrl = new URL("https://media.example.test/hls/master.m3u8")

test("parses HLS master playlist sources through stable proxy refs", () => {
  const parsed = parseHlsManifest(
    [
      "#EXTM3U",
      "#EXT-X-STREAM-INF:BANDWIDTH=5800000,RESOLUTION=1920x1080",
      "hi/prog.m3u8",
      "#EXT-X-STREAM-INF:BANDWIDTH=1200000",
      "https://cdn.example.test/lo/prog.m3u8",
    ].join("\n"),
    {
      upstreamUrl,
      proxyBase,
      headers: { authorization: "Bearer hls" },
    },
  )

  expect(parsed.sources?.map((source) => source.name)).toEqual(["1920x1080 · 5800k", "1200k"])
  expect(parsed.live).toBeUndefined()
  expect(decodeProxyRef(proxyToken(parsed.sources?.[0]?.url))).toEqual({
    url: "https://media.example.test/hls/hi/prog.m3u8",
    headers: { authorization: "Bearer hls" },
  })
  expect(decodeProxyRef(proxyToken(parsed.sources?.[1]?.url))).toEqual({
    url: "https://cdn.example.test/lo/prog.m3u8",
    headers: { authorization: "Bearer hls" },
  })
})

test("parses HLS subtitle media tags", () => {
  const parsed = parseHlsManifest(
    [
      "#EXTM3U",
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",URI="subs/en.m3u8"',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Main",URI="audio/main.m3u8"',
      "#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720",
      "720.m3u8",
    ].join("\n"),
    { upstreamUrl, proxyBase },
  )

  const english = parsed.subtitles?.English
  expect(english).toBeDefined()
  expect(english?.type).toBe("hls")
  expect(decodeProxyRef(proxyToken(english?.url))).toEqual({
    url: "https://media.example.test/hls/subs/en.m3u8",
  })
})

test("marks media playlists as live unless EXT-X-ENDLIST is present", () => {
  expect(
    parseHlsManifest("#EXTM3U\n#EXTINF:4,\nsegment-1.ts", { upstreamUrl, proxyBase }).live,
  ).toBe(true)
  expect(
    parseHlsManifest("#EXTM3U\n#EXTINF:4,\nsegment-1.ts\n#EXT-X-ENDLIST", {
      upstreamUrl,
      proxyBase,
    }).live,
  ).toBe(false)
})

function proxyToken(url: string | undefined): string {
  expect(url).toStartWith(`${proxyBase}/eisha/proxy/`)
  return url?.split("/eisha/proxy/")[1] ?? ""
}
