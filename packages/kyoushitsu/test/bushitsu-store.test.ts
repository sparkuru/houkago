import { beforeEach, expect, test } from "bun:test"
import type { Enmoku, KousokuMessage, Yakuwari } from "houkago-kousoku"
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

type M = { id: string; nickname: string; yakuwari?: Yakuwari }
const shusseki = (members: M[], ts = Date.now()): KousokuMessage => ({
  type: "SHUSSEKI",
  ts,
  senderId: "server",
  payload: {
    n: members.length,
    members: members.map((m) => ({ ...m, yakuwari: m.yakuwari ?? "kengaku" })),
  },
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

test("apply SHUSSEKI records yakuwari; yakuwariOf resolves and defaults to ゲスト", () => {
  const store = useBushitsuStore()
  store.apply(
    shusseki([
      { id: "u1", nickname: "Yui", yakuwari: "buchou" },
      { id: "u2", nickname: "Mio", yakuwari: "kengaku" },
    ]),
  )
  expect(store.yakuwariOf("u1")).toBe("buchou")
  expect(store.yakuwariOf("u2")).toBe("kengaku")
  expect(store.yakuwariOf("unknown")).toBe("kengaku")
})

test("apply SHUSSEKI tracks online members and departed member history", () => {
  const store = useBushitsuStore()
  store.apply(
    shusseki(
      [
        { id: "u1", nickname: "Yui", yakuwari: "buchou" },
        { id: "u2", nickname: "Mio", yakuwari: "kengaku" },
      ],
      1000,
    ),
  )

  expect(store.onlineBuinInfo.map((member) => member.id)).toEqual(["u1", "u2"])
  expect(store.onlineBuinInfo[0]).toMatchObject({
    id: "u1",
    nickname: "Yui",
    yakuwari: "buchou",
    joinedAt: 1000,
    lastSeenAt: 1000,
    online: true,
  })
  expect(store.historyBuinInfo).toEqual([])

  store.apply(shusseki([{ id: "u2", nickname: "Mio", yakuwari: "kengaku" }], 5000))

  expect(store.onlineBuinInfo).toEqual([
    {
      id: "u2",
      nickname: "Mio",
      yakuwari: "kengaku",
      joinedAt: 1000,
      lastSeenAt: 5000,
      online: true,
    },
  ])
  expect(store.historyBuinInfo).toEqual([
    {
      id: "u1",
      nickname: "Yui",
      yakuwari: "buchou",
      joinedAt: 1000,
      lastSeenAt: 5000,
      online: false,
    },
  ])
})

test("apply OSHABERI stores chat while DANMAKU stores overlay and a marked chat mirror", () => {
  const store = useBushitsuStore()
  store.apply({
    type: "OSHABERI",
    ts: 100,
    senderId: "u1",
    payload: { content: "chat line" },
  })
  store.apply({
    type: "DANMAKU",
    ts: 200,
    senderId: "u2",
    payload: { content: "danmaku line", color: "#fff", mode: "scroll" },
  })

  expect(store.chat).toEqual([
    { senderId: "u1", content: "chat line", ts: 100, kind: "oshaberi" },
    { senderId: "u2", content: "danmaku line", ts: 200, kind: "danmaku", color: "#fff" },
  ])
  expect(store.danmaku).toEqual([
    { senderId: "u2", content: "danmaku line", ts: 200, color: "#fff", mode: "scroll" },
  ])
})

const kengenMsg = (payload: {
  playback: boolean
  chat: boolean
  playlist: boolean
}): KousokuMessage => ({ type: "KENGEN", ts: Date.now(), senderId: "server", payload })

const nyuushitsuMsg = (payload: {
  mode: "open" | "approval" | "closed" | "password"
  status: "entered" | "waiting" | "rejected" | "closed"
  pending: { senderId: string; nickname: string; requestedAt: number }[]
}): KousokuMessage => ({ type: "NYUUSHITSU", ts: Date.now(), senderId: "server", payload })

const enmoku = (id: string): Enmoku => ({
  id,
  bushitsuId: "rA",
  title: `t-${id}`,
  type: "hls",
  url: `https://x/${id}.m3u8`,
  addedBy: "host",
})

test("default kengen is guest-chat-only before any KENGEN arrives", () => {
  const store = useBushitsuStore()
  expect(store.kengen).toEqual({ playback: false, chat: true, playlist: false })
  // guest (no buchouId set → isBuchou false): chat only
  expect(store.canControl).toBe(false)
  expect(store.canChat).toBe(true)
  expect(store.canPlaylist).toBe(false)
})

test("apply KENGEN updates the snapshot and derived guest gates", () => {
  const store = useBushitsuStore()
  store.apply(kengenMsg({ playback: true, chat: false, playlist: true }))
  expect(store.kengen).toEqual({ playback: true, chat: false, playlist: true })
  expect(store.canControl).toBe(true)
  expect(store.canChat).toBe(false)
  expect(store.canPlaylist).toBe(true)
})

test("host (isBuchou) may do everything regardless of kengen", () => {
  const store = useBushitsuStore()
  store.buchouId = store.senderId // I am the 部長
  store.apply(kengenMsg({ playback: false, chat: false, playlist: false }))
  expect(store.isBuchou).toBe(true)
  expect(store.canControl).toBe(true)
  expect(store.canChat).toBe(true)
  expect(store.canPlaylist).toBe(true)
})

test("default nyuushitsu state is open and idle before the server snapshot", () => {
  const store = useBushitsuStore()
  expect(store.nyuushitsuMode).toBe("open")
  expect(store.nyuushitsuStatus).toBe("idle")
  expect(store.pendingNyuushitsu).toEqual([])
})

test("apply NYUUSHITSU updates mode, my admission status, and pending requests", () => {
  const store = useBushitsuStore()
  store.apply(
    nyuushitsuMsg({
      mode: "approval",
      status: "entered",
      pending: [{ senderId: "u2", nickname: "Mio", requestedAt: 123 }],
    }),
  )
  expect(store.nyuushitsuMode).toBe("approval")
  expect(store.nyuushitsuStatus).toBe("entered")
  expect(store.pendingNyuushitsu).toEqual([{ senderId: "u2", nickname: "Mio", requestedAt: 123 }])
})

test("apply NYUUSHITSU accepts password admission mode snapshot", () => {
  const store = useBushitsuStore()
  store.apply(
    nyuushitsuMsg({
      mode: "password",
      status: "closed",
      pending: [],
    }),
  )
  expect(store.nyuushitsuMode).toBe("password")
  expect(store.nyuushitsuStatus).toBe("closed")
})

test("apply BANGUMI updates the room queue snapshot", () => {
  const store = useBushitsuStore()
  const queue = [enmoku("e1"), enmoku("e2")]
  store.apply({ type: "BANGUMI", ts: Date.now(), senderId: "server", payload: { enmoku: queue } })
  expect(store.bangumi.map((e) => e.id)).toEqual(["e1", "e2"])
})

test("setBangumi and BANGUMI dedupe by enmoku id", () => {
  const store = useBushitsuStore()
  const e1 = enmoku("e1")
  store.setBangumi([e1, e1, enmoku("e2")])
  expect(store.bangumi.map((e) => e.id)).toEqual(["e1", "e2"])

  store.apply({
    type: "BANGUMI",
    ts: Date.now(),
    senderId: "server",
    payload: { enmoku: [enmoku("e3"), enmoku("e3")] },
  })
  expect(store.bangumi.map((e) => e.id)).toEqual(["e3"])
})
