import { expect, test } from "bun:test"
import { EishaBadRequest } from "../src/errors"
import {
  type FetchLike,
  type ProxyRef,
  decodeProxyRef,
  encodeProxyRef,
  proxyUpstream,
  rewriteM3u8Manifest,
} from "../src/proxy"

test("proxy refs round-trip through a URL-safe token", () => {
  const ref = {
    url: "https://media.example.test/video.mp4",
    headers: { authorization: "Bearer x" },
  }
  const token = encodeProxyRef(ref)

  expect(token).not.toContain("/")
  expect(token).not.toContain("+")
  expect(decodeProxyRef(token)).toEqual(ref)
})

test("proxy refs reject invalid tokens and non-http upstreams", () => {
  expect(() => decodeProxyRef("not-json")).toThrow(EishaBadRequest)
  expect(() => encodeProxyRef({ url: "file:///etc/passwd" })).toThrow(EishaBadRequest)
})

test("proxyUpstream forwards Range and preserves seek-relevant response headers", async () => {
  const seen: { url?: string; range?: string; authorization?: string } = {}
  const fetcher: FetchLike = async (input, init) => {
    seen.url = String(input)
    const headers = new Headers(init?.headers)
    seen.range = headers.get("range") ?? undefined
    seen.authorization = headers.get("authorization") ?? undefined
    return new Response("chunk", {
      status: 206,
      headers: {
        "accept-ranges": "bytes",
        "content-length": "5",
        "content-range": "bytes 0-4/10",
        "content-type": "video/mp4",
        "x-private": "hidden",
      },
    })
  }

  const response = await proxyUpstream(
    { url: "https://media.example.test/video.mp4", headers: { authorization: "Bearer x" } },
    new Request("https://proxy.test/eisha/proxy/token", { headers: { range: "bytes=0-4" } }),
    fetcher,
  )

  expect(seen).toEqual({
    url: "https://media.example.test/video.mp4",
    range: "bytes=0-4",
    authorization: "Bearer x",
  })
  expect(response.status).toBe(206)
  expect(response.headers.get("content-range")).toBe("bytes 0-4/10")
  expect(response.headers.get("accept-ranges")).toBe("bytes")
  expect(response.headers.get("content-length")).toBe("5")
  expect(response.headers.get("content-type")).toBe("video/mp4")
  expect(response.headers.get("x-private")).toBeNull()
  expect(await response.text()).toBe("chunk")
})

test("rewriteM3u8Manifest rewrites URI lines and URI attributes through proxy refs", () => {
  const manifest = [
    "#EXTM3U",
    '#EXT-X-KEY:METHOD=AES-128,URI="keys/key.bin"',
    "#EXT-X-MAP:URI='init.mp4'",
    '#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/main.m3u8"',
    "#EXTINF:4,",
    "seg-1.ts",
    "#EXT-X-STREAM-INF:BANDWIDTH=1280000",
    "../variant/high.m3u8",
    "https://cdn.example.test/abs.ts",
    "data:text/plain;base64,AAAA",
  ].join("\n")

  const rewritten = rewriteM3u8Manifest(manifest, {
    upstreamUrl: new URL("https://media.example.test/hls/master/index.m3u8?sig=1"),
    proxyPrefix: "https://proxy.test/eisha/proxy/",
    headers: { authorization: "Bearer x" },
  })

  expect(refFromProxyUrl(attributeUri(rewritten, "EXT-X-KEY"))).toEqual({
    url: "https://media.example.test/hls/master/keys/key.bin",
    headers: { authorization: "Bearer x" },
    hls: {
      manifestUrl: "https://media.example.test/hls/master/index.m3u8?sig=1",
      uri: "keys/key.bin",
      uriIndex: 0,
    },
  })
  expect(refFromProxyUrl(attributeUri(rewritten, "EXT-X-MAP"))).toEqual({
    url: "https://media.example.test/hls/master/init.mp4",
    headers: { authorization: "Bearer x" },
    hls: {
      manifestUrl: "https://media.example.test/hls/master/index.m3u8?sig=1",
      uri: "init.mp4",
      uriIndex: 1,
    },
  })
  expect(refFromProxyUrl(attributeUri(rewritten, "EXT-X-MEDIA"))).toEqual({
    url: "https://media.example.test/hls/master/audio/main.m3u8",
    headers: { authorization: "Bearer x" },
    hls: {
      manifestUrl: "https://media.example.test/hls/master/index.m3u8?sig=1",
      uri: "audio/main.m3u8",
      uriIndex: 2,
    },
  })

  const uriLines = rewritten.split("\n").filter((line) => line && !line.startsWith("#"))
  expect(refFromProxyUrl(uriLines[0] ?? "")).toEqual({
    url: "https://media.example.test/hls/master/seg-1.ts",
    headers: { authorization: "Bearer x" },
    hls: {
      manifestUrl: "https://media.example.test/hls/master/index.m3u8?sig=1",
      uri: "seg-1.ts",
      uriIndex: 3,
    },
  })
  expect(refFromProxyUrl(uriLines[1] ?? "")).toEqual({
    url: "https://media.example.test/hls/variant/high.m3u8",
    headers: { authorization: "Bearer x" },
    hls: {
      manifestUrl: "https://media.example.test/hls/master/index.m3u8?sig=1",
      uri: "../variant/high.m3u8",
      uriIndex: 4,
    },
  })
  expect(refFromProxyUrl(uriLines[2] ?? "")).toEqual({
    url: "https://cdn.example.test/abs.ts",
    headers: { authorization: "Bearer x" },
    hls: {
      manifestUrl: "https://media.example.test/hls/master/index.m3u8?sig=1",
      uri: "https://cdn.example.test/abs.ts",
      uriIndex: 5,
    },
  })
  expect(uriLines[3]).toBe("data:text/plain;base64,AAAA")
})

test("proxyUpstream rewrites m3u8 responses and removes stale byte headers", async () => {
  const fetcher: FetchLike = async () =>
    new Response(["#EXTM3U", "#EXTINF:4,", "seg-1.ts"].join("\n"), {
      headers: {
        "accept-ranges": "bytes",
        "cache-control": "max-age=3",
        "content-length": "999",
        "content-range": "bytes 0-998/999",
        "content-type": "application/vnd.apple.mpegurl",
        etag: '"stale"',
      },
    })

  const response = await proxyUpstream(
    { url: "https://media.example.test/live/index.m3u8", headers: { authorization: "Bearer x" } },
    new Request("https://proxy.test/eisha/proxy/token"),
    fetcher,
  )
  const body = await response.text()
  const segmentLine = body.split("\n").find((line) => line && !line.startsWith("#")) ?? ""

  expect(response.headers.get("content-type")).toBe("application/vnd.apple.mpegurl")
  expect(response.headers.get("cache-control")).toBe("max-age=3")
  expect(response.headers.get("accept-ranges")).toBeNull()
  expect(response.headers.get("content-length")).toBeNull()
  expect(response.headers.get("content-range")).toBeNull()
  expect(response.headers.get("etag")).toBeNull()
  expect(refFromProxyUrl(segmentLine)).toEqual({
    url: "https://media.example.test/live/seg-1.ts",
    headers: { authorization: "Bearer x" },
    hls: {
      manifestUrl: "https://media.example.test/live/index.m3u8",
      uri: "seg-1.ts",
      uriIndex: 0,
    },
  })
})

test("proxyUpstream refreshes expired HLS child refs from the origin manifest once", async () => {
  const seen: string[] = []
  const fetcher: FetchLike = async (input, init) => {
    seen.push(String(input))
    const headers = new Headers(init?.headers)

    if (String(input).endsWith("seg.ts?sig=old")) {
      return new Response("expired", { status: 403 })
    }

    if (String(input).endsWith("index.m3u8")) {
      return new Response(["#EXTM3U", "#EXTINF:4,", "seg.ts?sig=new"].join("\n"))
    }

    return new Response(`fresh:${headers.get("range")}`, {
      headers: { "content-type": "video/mp2t" },
    })
  }

  const response = await proxyUpstream(
    {
      url: "https://media.example.test/live/seg.ts?sig=old",
      hls: {
        manifestUrl: "https://media.example.test/live/index.m3u8",
        uri: "seg.ts?sig=old",
        uriIndex: 0,
      },
    },
    new Request("https://proxy.test/eisha/proxy/token", { headers: { range: "bytes=0-3" } }),
    fetcher,
  )

  expect(seen).toEqual([
    "https://media.example.test/live/seg.ts?sig=old",
    "https://media.example.test/live/index.m3u8",
    "https://media.example.test/live/seg.ts?sig=new",
  ])
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe("video/mp2t")
  expect(await response.text()).toBe("fresh:bytes=0-3")
})

function refFromProxyUrl(raw: string): ProxyRef {
  const token = raw.split("/eisha/proxy/")[1] ?? ""
  return decodeProxyRef(token)
}

function attributeUri(manifest: string, tag: string): string {
  const line = manifest.split("\n").find((item) => item.startsWith(`#${tag}:`)) ?? ""
  return line.match(/URI=["']([^"']+)["']/)?.[1] ?? ""
}
