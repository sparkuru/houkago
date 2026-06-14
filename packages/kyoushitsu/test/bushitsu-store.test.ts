import { beforeEach, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { createPinia, setActivePinia } from "pinia"

// 名簿（roster）store test: applying SHUSSEKI updates the count and MERGES the
// roster from members (departed members' names are retained so historical chat/
// danmaku still resolves to a nickname); nicknameOf resolves and falls back to
// senderId. The store is the single write入口 for server truth; UI reads via
// nicknameOf.

// buinId() touches localStorage (browser-only); shim it so the store imports under bun.
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

const shusseki = (members: { id: string; nickname: string }[]): KousokuMessage => ({
  type: "SHUSSEKI",
  ts: Date.now(),
  senderId: "server",
  payload: { n: members.length, members },
})

beforeEach(() => {
  setActivePinia(createPinia())
})

test("apply SHUSSEKI updates count and roster; nicknameOf resolves", () => {
  const store = useBushitsuStore()
  store.apply(
    shusseki([
      { id: "u1", nickname: "Yui" },
      { id: "u2", nickname: "Mio" },
    ]),
  )
  expect(store.shusseki).toBe(2)
  expect(store.nicknameOf("u1")).toBe("Yui")
  expect(store.nicknameOf("u2")).toBe("Mio")
})

test("nicknameOf falls back to senderId when roster lacks it", () => {
  const store = useBushitsuStore()
  expect(store.nicknameOf("unknown-uuid")).toBe("unknown-uuid")
})

test("apply SHUSSEKI merges roster so a departed member's name is retained", () => {
  const store = useBushitsuStore()
  store.apply(
    shusseki([
      { id: "u1", nickname: "Yui" },
      { id: "u2", nickname: "Mio" },
    ]),
  )
  // u1 leaves: the next snapshot lists only u2. Count reflects the departure,
  // but u1's display name must survive for their historical messages.
  store.apply(shusseki([{ id: "u2", nickname: "Mio" }]))
  expect(store.shusseki).toBe(1)
  expect(store.nicknameOf("u2")).toBe("Mio")
  expect(store.nicknameOf("u1")).toBe("Yui") // departed → name retained, not uuid
})
