import { expect, test } from "bun:test"
import { Value } from "@sinclair/typebox/value"
import {
  AdapterCapabilitySchema,
  AdapterPageRequestSchema,
  AdapterPageResponseSchema,
  BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
  BaiduMediaFingerprintSchema,
  BaiduPlaybackGrantSchema,
  BaiduProviderSchema,
  BaiduSourceAvailabilitySchema,
  BilibiliProviderSchema,
  EnmokuProviderSchema,
  HOUKAGO_ADAPTER_PROTOCOL_VERSION,
} from "../src"

test("provider schema accepts only room-safe Baidu metadata", () => {
  expect(
    Value.Check(BaiduProviderSchema, {
      kind: "baidu",
      sourceId: "src-1",
      fileName: "film.mp4",
      size: 42,
    }),
  ).toBe(true)
  for (const forbidden of [
    "accessToken",
    "refreshToken",
    "dlink",
    "fsid",
    "path",
    "headers",
    "retentionMode",
    "deviceId",
  ]) {
    expect(
      Value.Check(EnmokuProviderSchema, {
        kind: "baidu",
        sourceId: "src-1",
        fileName: "film.mp4",
        [forbidden]: "secret",
      }),
    ).toBe(false)
  }
  expect(
    Value.Check(BilibiliProviderSchema, {
      kind: "bilibili",
      url: "https://www.bilibili.com/video/BV1xx",
      stats: { view: 1 },
    }),
  ).toBe(true)
})

test("capabilities are discriminated while future ids stay forward-compatible", () => {
  expect(
    Value.Check(AdapterCapabilitySchema, {
      id: "future.screen.capture",
      schemaVersion: 7,
      ready: true,
    }),
  ).toBe(true)
  expect(
    Value.Check(AdapterCapabilitySchema, {
      id: "baidu.files.read",
      schemaVersion: 1,
      ready: false,
      reason: "not-paired",
    }),
  ).toBe(true)
  expect(
    Value.Check(AdapterCapabilitySchema, {
      id: "baidu.files.read",
      schemaVersion: 1,
      ready: false,
    }),
  ).toBe(false)
  expect(
    Value.Check(AdapterCapabilitySchema, {
      id: "baidu.files.read",
      schemaVersion: 1,
      ready: true,
      reason: "not-paired",
    }),
  ).toBe(false)
})

test("Baidu source availability is room-safe and has stable failure reasons", () => {
  expect(
    Value.Check(BaiduSourceAvailabilitySchema, {
      sourceId: "source-1",
      mode: "user-held",
      ownerOnline: false,
      playable: false,
      reason: "owner-offline",
    }),
  ).toBe(true)
  expect(
    Value.Check(BaiduSourceAvailabilitySchema, {
      sourceId: "source-1",
      mode: "user-held",
      ownerOnline: false,
      playable: false,
      reason: "token-expired",
    }),
  ).toBe(false)
  expect(
    Value.Check(BaiduSourceAvailabilitySchema, {
      sourceId: "source-1",
      mode: "server-saved",
      ownerOnline: false,
      playable: true,
      refreshToken: "secret",
    }),
  ).toBe(false)
})

test("Baidu playback terminal failure is a fixed secret-free state", () => {
  expect(
    Value.Check(BaiduPlaybackGrantSchema, {
      state: "failed",
      reason: "upstream-resolution-failed",
    }),
  ).toBe(true)
  expect(
    Value.Check(BaiduPlaybackGrantSchema, {
      state: "failed",
      reason: "upstream-resolution-failed",
      dlink: "must-not-pass",
    }),
  ).toBe(false)
  expect(
    Value.Check(BaiduPlaybackGrantSchema, {
      state: "failed",
      reason: "authorization-revoked",
    }),
  ).toBe(false)
})

test("Baidu fingerprint contract records a bounded prefix without secrets", () => {
  const fingerprint = {
    algorithm: "md5",
    scope: "prefix",
    bytes: BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
    value: "0123456789abcdef0123456789abcdef",
  }
  expect(Value.Check(BaiduMediaFingerprintSchema, fingerprint)).toBe(true)
  expect(Value.Check(BaiduMediaFingerprintSchema, { ...fingerprint, bytes: 0 })).toBe(false)
  expect(
    Value.Check(BaiduMediaFingerprintSchema, {
      ...fingerprint,
      bytes: 1,
      value: fingerprint.value.toUpperCase(),
    }),
  ).toBe(false)
  expect(
    Value.Check(AdapterPageRequestSchema, {
      source: "houkago-page",
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: "0123456789abcdef",
      type: "BAIDU_MEDIA_FINGERPRINT",
      sourceId: "source-1",
      bushitsuId: "room-1",
      grantUrl: "https://houkago.example/baidu/media/grant-1",
      expiresAt: Date.now() + 60_000,
      bytes: 1024,
    }),
  ).toBe(true)
  expect(
    Value.Check(AdapterPageResponseSchema, {
      source: "houkago-adapter",
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: "0123456789abcdef",
      type: "BAIDU_MEDIA_FINGERPRINT_RESULT",
      ok: true,
      data: fingerprint,
    }),
  ).toBe(true)
})

test("adapter envelopes reject missing nonces, version drift, and secret fields", () => {
  const request = {
    source: "houkago-page",
    protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
    nonce: "0123456789abcdef",
    type: "HELLO",
  }
  expect(Value.Check(AdapterPageRequestSchema, request)).toBe(true)
  expect(Value.Check(AdapterPageRequestSchema, { ...request, nonce: "short" })).toBe(false)
  expect(Value.Check(AdapterPageRequestSchema, { ...request, protocolVersion: 2 })).toBe(false)

  const response = {
    source: "houkago-adapter",
    protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
    nonce: request.nonce,
    type: "RESULT",
    ok: true,
  }
  for (const forbidden of [
    "accessToken",
    "refreshToken",
    "dlink",
    "fsid",
    "path",
    "headers",
    "retentionMode",
    "deviceId",
  ]) {
    expect(Value.Check(AdapterPageResponseSchema, { ...response, [forbidden]: "secret" })).toBe(
      false,
    )
  }
})
