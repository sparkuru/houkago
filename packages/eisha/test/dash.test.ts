import { expect, test } from "bun:test"
import {
  buildDashManifest,
  dashManifestResponse,
  decodeDashManifestRef,
  encodeDashManifestRef,
} from "../src/dash"
import { decodeProxyRef } from "../src/proxy"

test("dash manifest refs round-trip through a URL-safe token", () => {
  const ref = dashRef()
  const token = encodeDashManifestRef(ref)

  expect(token).not.toContain("/")
  expect(token).not.toContain("+")
  expect(decodeDashManifestRef(token)).toEqual(ref)
})

test("buildDashManifest emits proxied audio and video representations", async () => {
  const manifest = buildDashManifest(dashRef(), "https://housou.test/eisha/proxy/")

  expect(manifest).toContain('contentType="video"')
  expect(manifest).toContain('contentType="audio"')
  expect(manifest).toContain('mediaPresentationDuration="PT120S"')
  expect(manifest).toContain('codecs="avc1.64001E"')
  expect(manifest).toContain('codecs="mp4a.40.2"')
  expect(manifest).toContain('<SegmentBase indexRange="1024-2048">')
  expect(manifest).toContain('<Initialization range="0-1023"/>')

  const urls = [...manifest.matchAll(/<BaseURL>(.*?)<\/BaseURL>/g)].map((match) =>
    xmlUnescape(match[1] ?? ""),
  )
  expect(urls).toHaveLength(2)
  expect(decodeProxyRef(urls[0]?.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://upos.example.test/video.m4s?sig=1",
    headers: { referer: "https://www.bilibili.com/" },
  })
  expect(decodeProxyRef(urls[1]?.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://upos.example.test/audio.m4s?sig=1",
    headers: { referer: "https://www.bilibili.com/" },
  })
})

test("dashManifestResponse serves DASH XML from the eisha dash route shape", async () => {
  const response = dashManifestResponse(
    dashRef(),
    new Request("https://housou.test/eisha/dash/token"),
  )
  const body = await response.text()

  expect(response.headers.get("content-type")).toBe("application/dash+xml; charset=utf-8")
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(body).toContain("https://housou.test/eisha/proxy/")
})

function dashRef() {
  return {
    duration: 120,
    headers: { referer: "https://www.bilibili.com/" },
    video: [
      {
        id: "32",
        url: "https://upos.example.test/video.m4s?sig=1",
        bandwidth: 155817,
        codecs: "avc1.64001E",
        width: 512,
        height: 384,
        segmentBase: { initialization: "0-1023", indexRange: "1024-2048" },
      },
    ],
    audio: [
      {
        id: "30280",
        url: "https://upos.example.test/audio.m4s?sig=1",
        bandwidth: 132000,
        codecs: "mp4a.40.2",
        segmentBase: { initialization: "0-923", indexRange: "924-1200" },
      },
    ],
  }
}

function xmlUnescape(value: string): string {
  return value.replaceAll("&amp;", "&").replaceAll("&quot;", '"')
}
