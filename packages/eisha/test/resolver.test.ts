import { expect, test } from "bun:test"
import { EishaBadRequest } from "../src/errors"
import { decodeProxyRef } from "../src/proxy"
import { resolveUrl } from "../src/resolver"

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
