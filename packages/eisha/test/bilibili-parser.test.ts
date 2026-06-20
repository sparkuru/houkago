import { expect, test } from "bun:test"
import { EishaUpstreamError } from "../src/errors"
import { bilibiliBvidFromUrl, isBilibiliUrl, resolveBilibiliUrl } from "../src/parsers/bilibili"
import { type FetchLike, decodeProxyRef } from "../src/proxy"

const proxyBase = "https://housou.example.test"

test("detects common Bilibili BV video URLs", () => {
  expect(isBilibiliUrl("https://www.bilibili.com/video/BV1xx411c7mD")).toBe(true)
  expect(isBilibiliUrl("https://m.bilibili.com/video/BV1xx411c7mD?p=2")).toBe(true)
  expect(bilibiliBvidFromUrl("https://www.bilibili.com/video/BV1xx411c7mD/")).toBe("BV1xx411c7mD")
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
          cid: 62131,
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
              width: 512,
              height: 384,
              codecs: "avc1.64001E",
              bandwidth: 155817,
            },
            {
              id: 16,
              base_url: "https://upos.example.test/video-360.m4s?sig=1",
              width: 480,
              height: 360,
              codecs: "hev1.1.6.L120.90",
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
  expect(resolved?.sources?.map((source) => source.name)).toEqual([
    "480P · 512x384 · avc1",
    "360P · 480x360 · hev1",
  ])

  const primaryRef = decodeProxyRef(resolved?.url.split("/eisha/proxy/")[1] ?? "")
  expect(primaryRef.url).toBe("https://upos.example.test/video-480.m4s?sig=1")
  expect(primaryRef.headers?.referer).toBe("https://www.bilibili.com/")
  expect(primaryRef.headers?.["user-agent"]).toContain("Mozilla")

  const secondSourceRef = decodeProxyRef(
    resolved?.sources?.[1]?.url.split("/eisha/proxy/")[1] ?? "",
  )
  expect(secondSourceRef.url).toBe("https://upos.example.test/video-360.m4s?sig=1")
  expect(secondSourceRef.headers).toEqual(primaryRef.headers)
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
