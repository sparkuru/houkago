import { expect, test } from "bun:test"
import { decodeDashManifestRef } from "../src/dash"
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
    hls: {
      manifestUrl: "https://media.example.test/live/master.m3u8",
      uri: "variant/720.m3u8",
      uriIndex: 1,
    },
  })
  const english = resolved.subtitles?.English
  expect(english).toBeDefined()
  expect(decodeProxyRef(english?.url.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://media.example.test/live/subs/en.m3u8",
    headers: { authorization: "Bearer resolver" },
    hls: {
      manifestUrl: "https://media.example.test/live/master.m3u8",
      uri: "subs/en.m3u8",
      uriIndex: 0,
    },
  })
})

test("dispatches Bilibili URLs to the platform parser", async () => {
  const resolved = await resolveUrlWithMetadata(
    { url: "https://www.bilibili.com/video/BV1xx411c7mD" },
    { proxyBase },
    (input) => {
      const url = new URL(String(input))
      if (url.pathname === "/x/web-interface/view") {
        return Response.json({
          code: 0,
          data: {
            bvid: "BV1xx411c7mD",
            title: "Bilibili title",
            pic: "https://i0.hdslb.com/bfs/archive/cover.jpg",
            cid: 62131,
            owner: { name: "Bili UP" },
            stat: { view: 1, danmaku: 2, reply: 3 },
          },
        })
      }

      return Response.json({
        code: 0,
        data: {
          dash: {
            video: [
              {
                id: 32,
                baseUrl: "https://upos.example.test/video.m4s",
                width: 512,
                height: 384,
                codecs: "avc1.64001E",
              },
            ],
            audio: [
              {
                id: 30280,
                baseUrl: "https://upos.example.test/audio.m4s",
                codecs: "mp4a.40.2",
              },
            ],
          },
        },
      })
    },
  )

  expect(resolved.title).toBe("Bilibili title")
  expect(resolved.type).toBe("dash")
  expect(resolved.danmaku).toEqual({ type: "fetch", ref: "bilibili:62131" })
  expect(resolved.provider).toEqual({
    kind: "bilibili",
    url: "https://www.bilibili.com/video/BV1xx411c7mD/",
    coverUrl: expect.stringContaining(`${proxyBase}/eisha/proxy/`),
    ownerName: "Bili UP",
    stats: { view: 1, danmaku: 2, reply: 3 },
  })
  expect(decodeProxyRef(resolved.provider?.coverUrl?.split("/eisha/proxy/")[1] ?? "").url).toBe(
    "https://i0.hdslb.com/bfs/archive/cover.jpg",
  )
  const dashRef = decodeDashManifestRef(resolved.url.split("/eisha/dash/")[1] ?? "")
  expect(dashRef.video[0]?.url).toBe("https://upos.example.test/video.m4s")
  expect(dashRef.audio[0]?.url).toBe("https://upos.example.test/audio.m4s")
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
