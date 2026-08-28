import { expect, test } from "bun:test"
import { Value } from "@sinclair/typebox/value"
import { BAIDU_MEDIA_FINGERPRINT_MAX_BYTES, BaiduMediaFingerprintSchema } from "houkago-kousoku"
import { fingerprintBaiduMedia } from "../src/media-fingerprint"

test("fingerprint reads only a bounded sentinel prefix and labels the digest scope", async () => {
  let requestedRange = ""
  const fingerprint = await fingerprintBaiduMedia(
    "https://houkago.example/baidu/media/grant-1",
    5,
    async (input, init) => {
      expect(String(input)).toBe("https://houkago.example/baidu/media/grant-1")
      requestedRange = new Headers(init?.headers).get("range") ?? ""
      return new Response("hello world")
    },
  )

  expect(requestedRange).toBe("bytes=0-4")
  expect(fingerprint).toEqual({
    algorithm: "md5",
    scope: "prefix",
    bytes: 5,
    value: "5d41402abc4b2a76b9719d911017c592",
  })
  expect(Value.Check(BaiduMediaFingerprintSchema, fingerprint)).toBe(true)
})

test("fingerprint rejects unbounded or non-web requests and failed media reads", async () => {
  await expect(fingerprintBaiduMedia("file:///private/media.mkv", 10)).rejects.toThrow(
    "media fingerprint URL is invalid",
  )
  await expect(
    fingerprintBaiduMedia(
      "https://houkago.example/baidu/media/grant-2",
      BAIDU_MEDIA_FINGERPRINT_MAX_BYTES + 1,
    ),
  ).rejects.toThrow("media fingerprint range is invalid")
  await expect(
    fingerprintBaiduMedia(
      "https://houkago.example/baidu/media/grant-3",
      10,
      async () => new Response("denied", { status: 403 }),
    ),
  ).rejects.toThrow("media fingerprint request failed")
})
