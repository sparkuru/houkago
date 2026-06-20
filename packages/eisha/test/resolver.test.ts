import { expect, test } from "bun:test"
import { EishaBadRequest, EishaUpstreamError } from "../src/errors"
import { decodeProxyRef } from "../src/proxy"
import { resolveUrl, resolveUrlWithMetadata } from "../src/resolver"

const proxyBase = "https://housou.example.test"

test("resolves a generic media URL to a stable direct proxy URL", () => {
  const resolved = resolveUrl({ url: "https://media.example.test/video.mp4" }, { proxyBase })
  const token = resolved.url.split("/").at(-1)

  expect(resolved.title).toBe("video.mp4")
  expect(resolved.type).toBe("direct")
  expect(resolved.url).toStartWith(`${proxyBase}/eisha/proxy/`)
  expect(token).toBeTruthy()
  expect(decodeProxyRef(token ?? "")).toEqual({ url: "https://media.example.test/video.mp4" })
})

test("infers HLS and DASH types from URL path", () => {
  expect(
    resolveUrl({ url: "https://media.example.test/live/index.m3u8" }, { proxyBase }).type,
  ).toBe("hls")
  expect(resolveUrl({ url: "https://media.example.test/manifest.mpd" }, { proxyBase }).type).toBe(
    "dash",
  )
})

test("rejects non-http URLs", () => {
  expect(() => resolveUrl({ url: "file:///tmp/video.mp4" }, { proxyBase })).toThrow(EishaBadRequest)
})

test("resolves HLS URLs with parsed manifest metadata", async () => {
  const resolved = await resolveUrlWithMetadata(
    {
      url: "https://media.example.test/live/master.m3u8",
      headers: { authorization: "Bearer resolver" },
    },
    { proxyBase },
    () =>
      new Response(
        [
          "#EXTM3U",
          '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",URI="subs/en.m3u8"',
          "#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720",
          "variant/720.m3u8",
        ].join("\n"),
        { status: 200 },
      ),
  )

  expect(resolved.type).toBe("hls")
  expect(decodeProxyRef(resolved.url.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://media.example.test/live/master.m3u8",
    headers: { authorization: "Bearer resolver" },
  })
  expect(resolved.sources?.[0]?.name).toBe("1280x720 · 2400k")
  expect(decodeProxyRef(resolved.sources?.[0]?.url.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://media.example.test/live/variant/720.m3u8",
    headers: { authorization: "Bearer resolver" },
  })
  const english = resolved.subtitles?.English
  expect(english).toBeDefined()
  expect(decodeProxyRef(english?.url.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://media.example.test/live/subs/en.m3u8",
    headers: { authorization: "Bearer resolver" },
  })
})

test("wraps HLS manifest fetch failures", async () => {
  await expect(
    resolveUrlWithMetadata(
      { url: "https://media.example.test/live/master.m3u8" },
      { proxyBase },
      () => new Response("nope", { status: 503 }),
    ),
  ).rejects.toThrow(EishaUpstreamError)
})
