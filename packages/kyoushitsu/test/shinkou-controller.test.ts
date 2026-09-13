import { expect, test } from "bun:test"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import type { PlayerHandle } from "../src/lib/player"
import {
  type ShinkouControllerOptions,
  createShinkouController,
} from "../src/lib/shinkou-controller"

const state: Shinkou = { isPlaying: true, currentTime: 10, playbackRate: 1 }

function playerSpy() {
  const calls = { apply: [] as Shinkou[], alignTransport: 0, setRate: [] as number[] }
  const player: PlayerHandle = {
    apply: (next) => calls.apply.push(next),
    alignTransport: () => {
      calls.alignTransport += 1
    },
    setRate: (rate) => calls.setRate.push(rate),
    snapshot: () => ({ isPlaying: true, currentTime: 10, playbackRate: 1 }),
  }
  return { calls, player }
}

function makeOptions(overrides: Partial<ShinkouControllerOptions> = {}) {
  const spy = playerSpy()
  const sent: KousokuMessage[] = []
  let canControl = true
  let isBuchou = false
  let now = 1_000
  const options: ShinkouControllerOptions = {
    send: (message) => sent.push(message),
    getPlayer: () => spy.player,
    canControl: () => canControl,
    isBuchou: () => isBuchou,
    senderId: () => "guest",
    getAuthoritativeState: () => ({ shinkou: state, serverTime: 1_000 }),
    now: () => now,
    ...overrides,
  }
  return {
    spy,
    sent,
    options,
    setCanControl: (value: boolean) => {
      canControl = value
    },
    setBuchou: (value: boolean) => {
      isBuchou = value
    },
    setNow: (value: number) => {
      now = value
    },
  }
}

function remoteShinkou(): KousokuMessage {
  return { type: "SHINKOU", ts: 1_000, senderId: "host", payload: state }
}

test("framework-free sync gates local drive by authority and suppresses echoes", () => {
  let scheduled: (() => void) | null = null
  const harness = makeOptions({
    schedule: (task) => {
      scheduled = task
      return task
    },
  })
  const controller = createShinkouController(harness.options)

  harness.setCanControl(false)
  controller.onLocalShinkou(state)
  expect(harness.sent).toEqual([])

  harness.setCanControl(true)
  controller.handleRemote(remoteShinkou())
  controller.onLocalShinkou(state)
  expect(harness.sent).toEqual([])
  scheduled?.()
  controller.onLocalShinkou(state)
  expect(harness.sent).toHaveLength(1)
  expect(harness.sent[0]?.type).toBe("SHINKOU")
})

test("remote SHINKOU is applied for guests and GENJOU is ignored by the host", () => {
  const harness = makeOptions()
  const controller = createShinkouController(harness.options)

  controller.handleRemote(remoteShinkou())
  expect(harness.spy.calls.apply).toHaveLength(1)

  harness.setBuchou(true)
  controller.handleRemote({
    type: "GENJOU",
    ts: 1_000,
    senderId: "server",
    payload: { enmokuId: "e1", shinkou: state, serverTime: 1_000 },
  })
  expect(harness.spy.calls.alignTransport).toBe(0)
})

test("GENJOU follows a guest through the player port and catchUp projects authority time", () => {
  const harness = makeOptions()
  const controller = createShinkouController(harness.options)

  controller.handleRemote({
    type: "GENJOU",
    ts: 1_000,
    senderId: "server",
    payload: { enmokuId: "e1", shinkou: state, serverTime: 1_000 },
  })
  expect(harness.spy.calls.alignTransport).toBe(1)

  controller.catchUp()
  expect(harness.spy.calls.apply).toHaveLength(1)
  expect(harness.spy.calls.apply[0]?.currentTime).toBe(10)
})

test("dispose cancels future sync effects and the core has no framework/media imports", async () => {
  const harness = makeOptions()
  const controller = createShinkouController(harness.options)
  controller.dispose()
  controller.onLocalShinkou(state)
  controller.handleRemote(remoteShinkou())
  controller.catchUp()

  expect(harness.sent).toEqual([])
  expect(harness.spy.calls.apply).toEqual([])
  expect(
    await Bun.file(new URL("../src/lib/shinkou-controller.ts", import.meta.url)).text(),
  ).not.toMatch(/from "(?:vue|pinia|artplayer|hls\.js|dashjs)"|HTML(?:Video|Element)/)
})
