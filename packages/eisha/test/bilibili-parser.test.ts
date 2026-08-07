import { expect, test } from "bun:test"
import { decodeDashManifestRef } from "../src/dash"
import { EishaUpstreamError } from "../src/errors"
import { bilibiliBvidFromUrl, isBilibiliUrl, resolveBilibiliUrl } from "../src/parsers/bilibili"
import { type FetchLike, decodeProxyRef } from "../src/proxy"

const proxyBase = "https://housou.example.test"

test("detects common Bilibili BV video URLs", () => {
  expect(isBilibiliUrl("https://www.bilibili.com/video/BV1xx411c7mD")).toBe(true)
  expect(isBilibiliUrl("https://m.bilibili.com/video/BV1xx411c7mD?p=2")).toBe(true)
  expect(bilibiliBvidFromUrl("https://www.bilibili.com/video/BV1xx411c7mD/")).toBe("BV1xx411c7mD")
  expect(
    bilibiliBvidFromUrl(
      "【字幕君交流场所】 https://www.bilibili.com/video/BV1xx411c7mD/?share_source=copy_web&vd_source=abc",
    ),
  ).toBe("BV1xx411c7mD")
  expect(
    bilibiliBvidFromUrl(
      "【给我11分钟绝对让你爱上绝密航天2.0跑刀320！】 https://www.bilibili.com/video/BV1LCVJ6QEYa/?share_source=copy_web&vd_source=dbe6d45450c232e032217d6426db08d7",
    ),
  ).toBe("BV1LCVJ6QEYa")
  expect(isBilibiliUrl("https://example.test/video/BV1xx411c7mD")).toBe(false)
  expect(isBilibiliUrl("not a url")).toBe(false)
})

test("resolves Bilibili view and playurl metadata into proxied sources", async () => {
  const seen: string[] = []
  const fetcher: FetchLike = async (input) => {
    const url = new URL(String(input))
    seen.push(`${url.pathname}?${url.searchParams.toString()}`)

    if (url.pathname === "/x/web-interface/view") {
      return Response.json({
        code: 0,
        data: {
          bvid: "BV1xx411c7mD",
          title: "字幕君交流场所",
          pic: "https://i0.hdslb.com/bfs/archive/cover.jpg",
          duration: 120,
          cid: 62131,
          owner: { name: "字幕君" },
          stat: {
            view: 1000,
            danmaku: 30,
            reply: 40,
            favorite: 50,
            coin: 60,
            share: 70,
            like: 80,
          },
          pages: [{ cid: 62131, page: 1 }],
        },
      })
    }

    return Response.json({
      code: 0,
      data: {
        quality: 32,
        support_formats: [
          { quality: 32, display_desc: "480P" },
          { quality: 16, display_desc: "360P" },
        ],
        dash: {
          video: [
            {
              id: 32,
              baseUrl: "https://upos.example.test/video-480.m4s?sig=1",
              backupUrl: ["https://upos-backup.example.test/video-480.m4s?sig=2"],
              width: 512,
              height: 384,
              codecs: "avc1.64001E",
              bandwidth: 155817,
              segment_base: {
                initialization: "0-1023",
                index_range: "1024-2048",
              },
            },
            {
              id: 32,
              baseUrl: "https://upos.example.test/video-480-hvc1.m4s?sig=1",
              width: 512,
              height: 384,
              codecs: "hvc1.1.6.L120.90",
              bandwidth: 155817,
              segment_base: {
                initialization: "0-1023",
                index_range: "1024-2048",
              },
            },
            {
              id: 16,
              base_url: "https://upos.example.test/video-360.m4s?sig=1",
              width: 480,
              height: 360,
              codecs: "hev1.1.6.L120.90",
              segment_base: {
                initialization: "0-923",
                index_range: "924-1600",
              },
            },
          ],
          audio: [
            {
              id: 30280,
              baseUrl: "https://upos.example.test/audio-192.m4s?sig=1",
              backup_url: ["https://upos-backup.example.test/audio-192.m4s?sig=2"],
              codecs: "mp4a.40.2",
              bandwidth: 132000,
              segment_base: {
                initialization: "0-919",
                index_range: "920-1100",
              },
            },
          ],
        },
      },
    })
  }

  const resolved = await resolveBilibiliUrl(
    "https://www.bilibili.com/video/BV1xx411c7mD",
    { proxyBase },
    fetcher,
  )

  expect(seen).toEqual([
    "/x/web-interface/view?bvid=BV1xx411c7mD",
    "/x/player/playurl?bvid=BV1xx411c7mD&cid=62131&fnval=16&qn=64&fourk=1",
  ])
  expect(resolved?.title).toBe("字幕君交流场所")
  expect(resolved?.type).toBe("dash")
  expect(resolved?.danmaku).toEqual({ type: "fetch", ref: "bilibili:62131" })
  expect(resolved?.provider).toEqual({
    kind: "bilibili",
    url: "https://www.bilibili.com/video/BV1xx411c7mD/",
    coverUrl: expect.stringContaining(`${proxyBase}/eisha/proxy/`),
    ownerName: "字幕君",
    stats: {
      view: 1000,
      danmaku: 30,
      reply: 40,
      favorite: 50,
      coin: 60,
      share: 70,
      like: 80,
    },
  })
  const provider = resolved?.provider?.kind === "bilibili" ? resolved.provider : undefined
  expect(decodeProxyRef(provider?.coverUrl?.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://i0.hdslb.com/bfs/archive/cover.jpg",
    headers: {
      referer: "https://www.bilibili.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    },
  })
  expect(resolved?.sources?.map((source) => source.name)).toEqual(["480P · 512x384 · avc1"])

  expect(resolved?.url.startsWith(`${proxyBase}/eisha/dash/`)).toBe(true)
  const primaryRef = decodeDashManifestRef(resolved?.url.split("/eisha/dash/")[1] ?? "")
  expect(primaryRef.duration).toBe(120)
  expect(primaryRef.video.map((video) => video.url)).toEqual([
    "https://upos.example.test/video-480.m4s?sig=1",
  ])
  expect(primaryRef.video[0]?.fallbackUrls).toEqual([
    "https://upos-backup.example.test/video-480.m4s?sig=2",
  ])
  expect(primaryRef.audio.map((audio) => audio.url)).toEqual([
    "https://upos.example.test/audio-192.m4s?sig=1",
  ])
  expect(primaryRef.audio[0]?.fallbackUrls).toEqual([
    "https://upos-backup.example.test/audio-192.m4s?sig=2",
  ])
  expect(primaryRef.headers?.referer).toBe("https://www.bilibili.com/")
  expect(primaryRef.headers?.["user-agent"]).toContain("Mozilla")
  expect(primaryRef.video[0]?.segmentBase).toEqual({
    initialization: "0-1023",
    indexRange: "1024-2048",
  })

  const firstSourceRef = decodeDashManifestRef(
    resolved?.sources?.[0]?.url.split("/eisha/dash/")[1] ?? "",
  )
  expect(firstSourceRef.video.map((video) => video.url)).toEqual([
    "https://upos.example.test/video-480.m4s?sig=1",
  ])
  expect(firstSourceRef.audio.map((audio) => audio.url)).toEqual([
    "https://upos.example.test/audio-192.m4s?sig=1",
  ])
  expect(firstSourceRef.headers).toEqual(primaryRef.headers)
})

test("returns undefined for non-Bilibili URLs", async () => {
  const resolved = await resolveBilibiliUrl("https://media.example.test/video.mp4", { proxyBase })

  expect(resolved).toBeUndefined()
})

test("wraps unsupported Bilibili API responses", async () => {
  await expect(
    resolveBilibiliUrl("https://www.bilibili.com/video/BV1xx411c7mD", { proxyBase }, () =>
      Response.json({ code: -400, message: "bad request" }),
    ),
  ).rejects.toThrow(EishaUpstreamError)
})
