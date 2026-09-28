import { expect, test } from "bun:test"
import {
  BAIDU_MEDIA_FINGERPRINT_CAPABILITY,
  HOUKAGO_ADAPTER_PROTOCOL_VERSION,
} from "houkago-kousoku"
import {
  type BaiduPlaybackDependencies,
  prepareBaiduPlayback,
} from "../src/features/baidu/use-baidu-playback"

const hello = {
  protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION as 1,
  clientVersion: "1.0.0",
  browser: "firefox" as const,
  deviceId: "device-1234567890",
  capabilities: [
    { id: BAIDU_MEDIA_FINGERPRINT_CAPABILITY, schemaVersion: 1, ready: true as const },
  ],
}

function dependencies(): { values: BaiduPlaybackDependencies; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    values: {
      availability: async () => ({
        sourceId: "source-1",
        mode: "user-held",
        ownerOnline: true,
        playable: true,
      }),
      detect: async () => ({ hello, state: "ready", pairingFailed: false }),
      grant: async (_sourceId, _roomId, _signal, onPending) => {
        calls.push("grant")
        onPending()
        return {
          state: "ready",
          grantUrl: `https://housou.test/grant-${calls.filter((call) => call === "grant").length}`,
          expiresAt: Date.now() + 60_000,
        }
      },
      fingerprint: async () => {
        calls.push("fingerprint")
        return {
          algorithm: "md5",
          scope: "prefix",
          bytes: 16,
          value: "0123456789abcdef0123456789abcdef",
        }
      },
      prepareMedia: async (url) => {
        calls.push(`prepare:${url}`)
      },
    },
  }
}

test("fingerprint success claims one grant and passes digest to timeline matching", async () => {
  const { values, calls } = dependencies()
  let pending = 0
  const result = await prepareBaiduPlayback(
    "source-1",
    "room-1",
    new AbortController().signal,
    () => {
      pending += 1
    },
    values,
  )
  expect(result).toMatchObject({
    state: "ready",
    grantUrl: "https://housou.test/grant-1",
    fingerprint: { algorithm: "md5" },
  })
  expect(calls).toEqual(["grant", "fingerprint"])
  expect(pending).toBe(1)
})

test("optional fingerprint failure obtains exactly one fresh playback grant", async () => {
  const { values, calls } = dependencies()
  values.fingerprint = async () => {
    calls.push("fingerprint")
    throw new Error("bounded read failed")
  }
  const result = await prepareBaiduPlayback(
    "source-1",
    "room-1",
    new AbortController().signal,
    () => {},
    values,
  )
  expect(result).toEqual({
    state: "ready",
    grantUrl: "https://housou.test/grant-2",
    fingerprint: null,
  })
  expect(calls).toEqual(["grant", "fingerprint", "grant", "prepare:https://housou.test/grant-2"])
})

test("owner offline and cancellation stop before grant creation", async () => {
  const { values, calls } = dependencies()
  values.availability = async () => ({
    sourceId: "source-1",
    mode: "user-held",
    ownerOnline: false,
    playable: false,
    reason: "owner-offline",
  })
  await expect(
    prepareBaiduPlayback("source-1", "room-1", new AbortController().signal, () => {}, values),
  ).resolves.toMatchObject({ state: "owner-offline", grantUrl: null })
  expect(calls).toEqual([])

  const abort = new AbortController()
  values.availability = async () => {
    abort.abort()
    return { sourceId: "source-1", mode: "user-held", ownerOnline: true, playable: true }
  }
  await expect(
    prepareBaiduPlayback("source-1", "room-1", abort.signal, () => {}, values),
  ).rejects.toMatchObject({ name: "AbortError" })
  expect(calls).toEqual([])
})
