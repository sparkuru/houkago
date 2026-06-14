import { beforeEach, expect, test } from "bun:test"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import { createPinia, setActivePinia } from "pinia"
import { ref } from "vue"
import type { PlayerHandle } from "../src/composables/useShinkou"

// 共有制御 (design §5 回填) の単体テスト: onLocalShinkou は canControl (host or 授権
// guest) で広播し、handleRemote の SHINKOU は房主含む全員が apply、GENJOU は非房主
// のみ追従する。DOM/player 不要 — PlayerHandle を spy 化し、store を pinia で組む。

// buinId() touches localStorage; shim it so the store imports under bun.
const mem = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

const { useBushitsuStore } = await import("../src/stores/bushitsu")
const { useShinkou } = await import("../src/composables/useShinkou")

const SHINKOU: Shinkou = { isPlaying: true, currentTime: 10, playbackRate: 1 }

// A spy PlayerHandle that records apply/alignTransport/snapshot calls. snapshot
// returns a fixed local state so applyGenjou's zure math is deterministic.
function spyPlayer() {
  const calls = { apply: 0, alignTransport: 0, setRate: 0 }
  const handle: PlayerHandle = {
    apply: () => {
      calls.apply++
    },
    alignTransport: () => {
      calls.alignTransport++
    },
    setRate: () => {
      calls.setRate++
    },
    snapshot: () => ({ isPlaying: true, currentTime: 10, playbackRate: 1 }),
  }
  return { calls, ref: ref<PlayerHandle | null>(handle) }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

test("onLocalShinkou broadcasts when canControl (host)", () => {
  const store = useBushitsuStore()
  store.buchouId = store.senderId // 房主
  const sent: KousokuMessage[] = []
  const { ref: player } = spyPlayer()
  const { onLocalShinkou } = useShinkou((m) => sent.push(m), player)

  onLocalShinkou(SHINKOU)
  expect(sent.length).toBe(1)
  expect(sent[0]?.type).toBe("SHINKOU")
})

test("onLocalShinkou broadcasts for an authorized guest (not host, kengen.playback)", () => {
  const store = useBushitsuStore()
  store.buchouId = "someone-else" // 非房主
  store.apply({
    type: "KENGEN",
    ts: Date.now(),
    senderId: "server",
    payload: { playback: true, chat: true, playlist: false },
  })
  expect(store.isBuchou).toBe(false)
  expect(store.canControl).toBe(true)

  const sent: KousokuMessage[] = []
  const { ref: player } = spyPlayer()
  const { onLocalShinkou } = useShinkou((m) => sent.push(m), player)

  onLocalShinkou(SHINKOU)
  expect(sent.length).toBe(1)
})

test("onLocalShinkou does NOT broadcast for an unauthorized guest", () => {
  const store = useBushitsuStore()
  store.buchouId = "someone-else"
  store.apply({
    type: "KENGEN",
    ts: Date.now(),
    senderId: "server",
    payload: { playback: false, chat: true, playlist: false },
  })
  expect(store.canControl).toBe(false)

  const sent: KousokuMessage[] = []
  const { ref: player } = spyPlayer()
  const { onLocalShinkou } = useShinkou((m) => sent.push(m), player)

  onLocalShinkou(SHINKOU)
  expect(sent.length).toBe(0)
})

test("handleRemote: the host APPLIES a peer's SHINKOU (共有制御 後写者勝ち)", () => {
  const store = useBushitsuStore()
  store.buchouId = store.senderId // 房主
  const { calls, ref: player } = spyPlayer()
  const { handleRemote } = useShinkou(() => {}, player)

  handleRemote({ type: "SHINKOU", ts: Date.now(), senderId: "guest", payload: SHINKOU })
  expect(calls.apply).toBe(1)
})

test("handleRemote: a guest APPLIES a peer's SHINKOU", () => {
  const store = useBushitsuStore()
  store.buchouId = "someone-else"
  const { calls, ref: player } = spyPlayer()
  const { handleRemote } = useShinkou(() => {}, player)

  handleRemote({ type: "SHINKOU", ts: Date.now(), senderId: "host", payload: SHINKOU })
  expect(calls.apply).toBe(1)
})

test("handleRemote: GENJOU is followed by non-host only", () => {
  const store = useBushitsuStore()
  store.buchouId = "someone-else" // 非房主
  const { calls, ref: player } = spyPlayer()
  const { handleRemote } = useShinkou(() => {}, player)

  handleRemote({
    type: "GENJOU",
    ts: Date.now(),
    senderId: "server",
    payload: { enmokuId: "e1", shinkou: SHINKOU, serverTime: Date.now() },
  })
  // local == remote (snapshot matches) → ignore tier still calls alignTransport.
  expect(calls.alignTransport).toBe(1)
})

test("handleRemote: GENJOU is NOT followed by the host (own heartbeat)", () => {
  const store = useBushitsuStore()
  store.buchouId = store.senderId // 房主
  const { calls, ref: player } = spyPlayer()
  const { handleRemote } = useShinkou(() => {}, player)

  handleRemote({
    type: "GENJOU",
    ts: Date.now(),
    senderId: "server",
    payload: { enmokuId: "e1", shinkou: SHINKOU, serverTime: Date.now() },
  })
  expect(calls.alignTransport).toBe(0)
  expect(calls.apply).toBe(0)
})
