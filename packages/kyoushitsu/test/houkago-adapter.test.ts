import { expect, test } from "bun:test"
import {
  adapterCapabilityReady,
  adapterMessageMatchesContext,
  adapterResponseForNonce,
} from "../src/lib/houkago-adapter"

test("adapter bridge accepts only same-window same-origin messages", () => {
  const pageWindow = {}
  expect(
    adapterMessageMatchesContext(pageWindow, pageWindow, "https://room.test", "https://room.test"),
  ).toBe(true)
  expect(
    adapterMessageMatchesContext({}, pageWindow, "https://room.test", "https://room.test"),
  ).toBe(false)
  expect(
    adapterMessageMatchesContext(pageWindow, pageWindow, "https://evil.test", "https://room.test"),
  ).toBe(false)
})

test("adapter bridge validates strict response schema and nonce", () => {
  const response = {
    source: "houkago-adapter",
    protocolVersion: 1,
    nonce: "0123456789abcdef",
    type: "RESULT",
    ok: true,
  }
  expect(adapterResponseForNonce(response, response.nonce)).toEqual(response)
  expect(
    adapterResponseForNonce({ ...response, nonce: "fedcba9876543210" }, response.nonce),
  ).toBeNull()
  expect(adapterResponseForNonce({ ...response, protocolVersion: 2 }, response.nonce)).toBeNull()
  expect(adapterResponseForNonce({ ...response, accessToken: "secret" }, response.nonce)).toBeNull()
})

test("capability checks require exact schema readiness", () => {
  const hello = {
    protocolVersion: 1,
    clientVersion: "0.1.0",
    browser: "firefox" as const,
    deviceId: "0123456789abcdef",
    capabilities: [{ id: "baidu.files.read", schemaVersion: 1, ready: true as const }],
  }
  expect(adapterCapabilityReady(hello, "baidu.files.read")).toBe(true)
  expect(adapterCapabilityReady(hello, "baidu.files.read", 2)).toBe(false)
  expect(adapterCapabilityReady(hello, "baidu.media.request-headers")).toBe(false)
})
