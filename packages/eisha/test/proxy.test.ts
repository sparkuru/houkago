import { expect, test } from "bun:test"
import { EishaBadRequest } from "../src/errors"
import { type FetchLike, decodeProxyRef, encodeProxyRef, proxyUpstream } from "../src/proxy"

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
