import { afterAll, beforeAll, expect, test } from "bun:test"
import { Elysia } from "elysia"
import { decodeProxyRef, encodeProxyRef } from "houkago-eisha"
import { app } from "../src/index"

let base: string
let upstreamBase: string
const upstream = new Elysia()
  .get("/video.mp4", ({ request }) => {
    const range = request.headers.get("range") ?? ""
    return new Response(range, {
      status: range ? 206 : 200,
      headers: {
        "accept-ranges": "bytes",
        "content-length": String(range.length),
        "content-range": "bytes 0-3/10",
        "content-type": "video/mp4",
        "x-private": "hidden",
      },
    })
  })
  .get("/playlist/index.m3u8", () => {
    return new Response(["#EXTM3U", "#EXTINF:4,", "seg-1.ts"].join("\n"), {
      headers: {
        "content-length": "999",
        "content-type": "application/vnd.apple.mpegurl",
      },
    })
  })
  .get("/playlist/seg-1.ts", ({ request }) => {
    const range = request.headers.get("range") ?? ""
    return new Response(`segment:${range}`, {
      status: range ? 206 : 200,
      headers: {
        "accept-ranges": "bytes",
        "content-range": "bytes 0-3/10",
        "content-type": "video/mp2t",
      },
    })
  })
  .get(
    "/refresh/index.m3u8",
    () => new Response(["#EXTM3U", "#EXTINF:4,", "seg.ts?sig=new"].join("\n")),
  )
  .get("/refresh/seg.ts", ({ query }) => {
    if (query.sig === "old") return new Response("expired", { status: 403 })
    return new Response("fresh-segment", { headers: { "content-type": "video/mp2t" } })
  })

beforeAll(() => {
  app.listen(0)
  upstream.listen(0)
  base = `http://localhost:${app.server?.port}`
  upstreamBase = `http://localhost:${upstream.server?.port}`
})

afterAll(() => {
  app.server?.stop()
  upstream.server?.stop()
})

test("eisha proxy route forwards Range and preserves seek headers", async () => {
  const token = encodeProxyRef({ url: `${upstreamBase}/video.mp4` })
  const response = await fetch(`${base}/eisha/proxy/${token}`, {
    headers: { range: "bytes=0-3" },
  })

  expect(response.status).toBe(206)
  expect(response.headers.get("accept-ranges")).toBe("bytes")
  expect(response.headers.get("content-range")).toBe("bytes 0-3/10")
  expect(response.headers.get("content-type")).toBe("video/mp4")
  expect(response.headers.get("x-private")).toBeNull()
  expect(await response.text()).toBe("bytes=0-3")
})

test("eisha proxy route rewrites m3u8 segment URLs back through the proxy", async () => {
  const token = encodeProxyRef({ url: `${upstreamBase}/playlist/index.m3u8` })
  const response = await fetch(`${base}/eisha/proxy/${token}`)
  const body = await response.text()
  const segmentUrl = body.split("\n").find((line) => line && !line.startsWith("#")) ?? ""

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("application/vnd.apple.mpegurl")
  expect(response.headers.get("content-length")).not.toBe("999")
  expect(response.headers.get("content-range")).toBeNull()
  expect(response.headers.get("accept-ranges")).toBeNull()
  expect(decodeProxyRef(segmentUrl.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: `${upstreamBase}/playlist/seg-1.ts`,
    hls: {
      manifestUrl: `${upstreamBase}/playlist/index.m3u8`,
      uri: "seg-1.ts",
      uriIndex: 0,
    },
  })

  const segment = await fetch(segmentUrl, { headers: { range: "bytes=0-3" } })

  expect(segment.status).toBe(206)
  expect(segment.headers.get("content-range")).toBe("bytes 0-3/10")
  expect(segment.headers.get("content-type")).toBe("video/mp2t")
  expect(await segment.text()).toBe("segment:bytes=0-3")
})

test("eisha proxy route re-resolves expired HLS segment refs", async () => {
  const token = encodeProxyRef({
    url: `${upstreamBase}/refresh/seg.ts?sig=old`,
    hls: {
      manifestUrl: `${upstreamBase}/refresh/index.m3u8`,
      uri: "seg.ts?sig=old",
      uriIndex: 0,
    },
  })
  const response = await fetch(`${base}/eisha/proxy/${token}`)

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe("video/mp2t")
  expect(await response.text()).toBe("fresh-segment")
})
