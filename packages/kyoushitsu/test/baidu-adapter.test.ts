import { expect, test } from "bun:test"
import type { AdapterHello } from "houkago-kousoku"
import { detectBaiduAdapter } from "../src/lib/baidu-adapter-detection"

const deviceId = "device-1234567890"

function hello(mediaReady: boolean): AdapterHello {
  return {
    protocolVersion: 1,
    clientVersion: "1.0.0",
    browser: "chromium",
    deviceId,
    capabilities: [
      mediaReady
        ? { id: "baidu.media.request-headers", schemaVersion: 1, ready: true }
        : {
            id: "baidu.media.request-headers",
            schemaVersion: 1,
            ready: false,
            reason: "not-paired",
          },
    ],
  }
}

test("validates a locally paired adapter against the current server user", async () => {
  const requests: Array<{ deviceId: string; localPaired: boolean }> = []
  let pairCalls = 0
  const result = await detectBaiduAdapter({
    hello: async () => hello(true),
    pair: async () => {
      pairCalls += 1
    },
    requestPairing: async (requestedDeviceId, localPaired) => {
      requests.push({ deviceId: requestedDeviceId, localPaired })
      return { data: { state: "paired" } }
    },
    serverBase: () => "https://housou.example.test",
  })

  expect(requests).toEqual([{ deviceId, localPaired: true }])
  expect(pairCalls).toBe(0)
  expect(result.state).toBe("ready")
})

test("pairs again when the server does not recognize the local device for this user", async () => {
  const hellos = [hello(true), hello(true)]
  const pairCalls: Array<{ serverBase: string; pairingCode: string }> = []
  const result = await detectBaiduAdapter({
    hello: async () => {
      const next = hellos.shift()
      if (!next) throw new Error("unexpected HELLO")
      return next
    },
    pair: async (serverBase, pairingCode) => pairCalls.push({ serverBase, pairingCode }),
    requestPairing: async (_requestedDeviceId, localPaired) => {
      expect(localPaired).toBe(true)
      return {
        data: {
          state: "pairing-required",
          pairingCode: "pairing-code-123456",
          expiresAt: Date.now() + 60_000,
        },
      }
    },
    serverBase: () => "https://housou.example.test",
  })

  expect(pairCalls).toEqual([
    { serverBase: "https://housou.example.test", pairingCode: "pairing-code-123456" },
  ])
  expect(result.state).toBe("ready")
})

test("reports unpaired local capability to the server before pairing", async () => {
  const hellos = [hello(false), hello(true)]
  const localStates: boolean[] = []
  const result = await detectBaiduAdapter({
    hello: async () => {
      const next = hellos.shift()
      if (!next) throw new Error("unexpected HELLO")
      return next
    },
    pair: async () => {},
    requestPairing: async (_requestedDeviceId, localPaired) => {
      localStates.push(localPaired)
      return {
        data: {
          state: "pairing-required",
          pairingCode: "pairing-code-123456",
          expiresAt: Date.now() + 60_000,
        },
      }
    },
    serverBase: () => "https://housou.example.test",
  })

  expect(localStates).toEqual([false])
  expect(result.state).toBe("ready")
})
