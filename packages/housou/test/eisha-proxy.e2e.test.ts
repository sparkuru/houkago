import { afterAll, beforeAll, expect, test } from "bun:test"
import { Elysia } from "elysia"
import { encodeProxyRef } from "houkago-eisha"
import { app } from "../src/index"

let base: string
let upstreamBase: string
const upstream = new Elysia().get("/video.mp4", ({ request }) => {
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
