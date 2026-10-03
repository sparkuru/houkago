import { describe, expect, test } from "bun:test"
import type { Bushitsu, Enmoku, KousokuMessage, Shinkou } from "houkago-kousoku"
import { configureHousouHttpClient } from "houkago-kyoushitsu-core/http"
import type { PlayerHandle } from "houkago-kyoushitsu-core/player"
import { RoomRuntime, type RoomServices } from "../src/features/room/room-runtime"

const room: Bushitsu = { id: "room-1", name: "Test room", buchouId: "host", createdAt: 1 }
const item: Enmoku = {
  id: "item-1",
  bushitsuId: "room-1",
  title: "First",
  type: "direct",
  url: "https://example.test/a.mp4",
  addedBy: "host",
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function fixture(
  roomRequest = Promise.resolve(room),
  queueRequest = Promise.resolve<Enmoku[]>([]),
  identityId = "host",
  onRevoked = () => {},
  roomId = "room-1",
) {
  let receive!: (message: KousokuMessage) => void
  let status!: (value: "connecting" | "open" | "closed" | "error") => void
  let connections = 0
  let closes = 0
  let roomReads = 0
  let queueReads = 0
  const sent: KousokuMessage[] = []
  const services: RoomServices = {
    transport: (onMessage, onStatus) => {
      receive = onMessage
      status = onStatus
      return {
        connect: () => {
          connections++
        },
        send: (message) => sent.push(message),
        close: () => {
          closes++
        },
      }
    },
    room: async () => {
      roomReads++
      return roomRequest
    },
    queue: async () => {
      queueReads++
      return queueRequest
    },
  }
  const runtime = new RoomRuntime(roomId, identityId, onRevoked, services)
  const server = <T extends KousokuMessage["type"]>(
    type: T,
    payload: Extract<KousokuMessage, { type: T }>["payload"],
    ts = Date.now(),
  ) => receive({ type, payload, senderId: "server", ts } as KousokuMessage)
  return {
    runtime,
    server,
    status: (value: "connecting" | "open" | "closed" | "error") => status(value),
    sent,
    get connections() {
      return connections
    },
    get closes() {
      return closes
    },
    get roomReads() {
      return roomReads
    },
    get queueReads() {
      return queueReads
    },
  }
}

const entered = { mode: "open" as const, status: "entered" as const, pending: [] }

describe("React room runtime", () => {
  test("presence follows SHUSSEKI time, retains departed names and resets on session replacement", () => {
    const f = fixture()
    f.runtime.start()
    f.status("open")
    f.server("NYUUSHITSU", entered)
    const host = { id: "host", nickname: "Owner", yakuwari: "buchou" as const }
    const guest = { id: "guest", nickname: "Visitor", yakuwari: "kengaku" as const }
    f.server("SHUSSEKI", { n: 1, members: [host] }, 1_000)
    f.server("SHUSSEKI", { n: 2, members: [host, guest] }, 5_000)
    expect(f.runtime.getSnapshot().presenceById.host?.joinedAt).toBe(1_000)
    expect(f.runtime.getSnapshot().presenceById.guest?.joinedAt).toBe(5_000)
    f.server("SHUSSEKI", { n: 1, members: [host] }, 10_000)
    expect(f.runtime.getSnapshot().presenceById.guest).toMatchObject({
      online: false,
      lastSeenAt: 10_000,
    })
    expect(f.runtime.getSnapshot().names.guest).toBe("Visitor")
    f.server("SHUSSEKI", { n: 2, members: [host, guest] }, 20_000)
    expect(f.runtime.getSnapshot().presenceById.guest).toMatchObject({
      joinedAt: 20_000,
      online: true,
    })
    f.runtime.reconnect()
    expect(f.runtime.getSnapshot().presenceById.guest?.joinedAt).toBe(20_000)
    f.runtime.dispose()
    const replacement = fixture(
      Promise.resolve({ ...room, id: "room-2" }),
      Promise.resolve([]),
      "host",
      () => {},
      "room-2",
    )
    replacement.runtime.start()
    expect(replacement.runtime.getSnapshot().presenceById).toEqual({})
    expect(replacement.runtime.getSnapshot().names).toEqual({})
    replacement.runtime.dispose()
  })
  test("playlist permission does not grant deletion; an admitted host can delete", async () => {
    const requests: Request[] = []
    configureHousouHttpClient({
      baseUrl: "https://housou.test",
      fetch: Object.assign(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          requests.push(new Request(input, init))
          return Response.json({ ok: true })
        },
        { preconnect: fetch.preconnect },
      ),
    })
    const guest = fixture(Promise.resolve(room), Promise.resolve([item]), "guest")
    const host = fixture(Promise.resolve(room), Promise.resolve([item]))
    try {
      for (const f of [guest, host]) {
        f.runtime.start()
        f.status("open")
        f.server("NYUUSHITSU", entered)
        f.server("KENGEN", { chat: true, playlist: true, playback: false })
      }
      await Bun.sleep(0)
      expect(guest.runtime.can("playlist")).toBe(true)
      expect(await guest.runtime.delete(item.id)).toBeUndefined()
      expect(guest.runtime.getSnapshot().error).toBe("Action unavailable")
      expect(requests).toHaveLength(0)
      await host.runtime.delete(item.id)
      expect(requests).toHaveLength(1)
      expect(requests[0]?.method).toBe("DELETE")
      expect(requests[0]?.url).toBe("https://housou.test/bushitsu/room-1/enmoku/item-1")
      expect(host.runtime.getSnapshot().error).toBeNull()
    } finally {
      guest.runtime.dispose()
      host.runtime.dispose()
      configureHousouHttpClient()
    }
  })

  test("starts once and gates protected reads and commands on server admission", async () => {
    const f = fixture()
    expect(f.runtime.start()).toBe(true)
    expect(f.runtime.start()).toBe(false)
    expect(f.connections).toBe(1)
    expect(f.roomReads).toBe(0)
    expect(f.queueReads).toBe(0)
    expect(f.runtime.chat("before admission")).toBe(false)
    f.status("open")
    f.server("NYUUSHITSU", { ...entered, status: "waiting" })
    expect(f.roomReads).toBe(0)
    f.server("NYUUSHITSU", entered)
    expect(f.roomReads).toBe(1)
    expect(f.queueReads).toBe(1)
    await Bun.sleep(0)
    expect(f.runtime.getSnapshot().room?.name).toBe("Test room")
    expect(f.runtime.chat("hello")).toBe(true)
    expect(f.sent.at(-1)).toMatchObject({ type: "OSHABERI", payload: { content: "hello" } })
    f.server("OSHABERI", { content: "hello" })
    expect(f.runtime.getSnapshot().chat.at(-1)).toMatchObject({
      content: "hello",
      kind: "chat",
    })
    f.runtime.dispose()
    f.runtime.dispose()
    expect(f.closes).toBe(1)
  })

  test("newer BANGUMI wins over a delayed HTTP bootstrap", async () => {
    const delayed = deferred<Enmoku[]>()
    const f = fixture(Promise.resolve(room), delayed.promise)
    f.runtime.start()
    f.status("open")
    f.server("NYUUSHITSU", entered)
    f.server("BANGUMI", { enmoku: [item] })
    delayed.resolve([])
    await Bun.sleep(0)
    expect(f.runtime.getSnapshot().queue.map((value) => value.id)).toEqual(["item-1"])
    f.server("JOUEI", { enmokuId: item.id })
    expect(f.runtime.getSnapshot().current?.id).toBe(item.id)
    f.runtime.dispose()
  })

  test("reconnect gates commands again and an old room cannot revive after replacement", async () => {
    const delayed = deferred<Bushitsu>()
    const old = fixture(delayed.promise)
    old.runtime.start()
    old.status("open")
    old.server("NYUUSHITSU", entered)
    old.runtime.reconnect()
    expect(old.connections).toBe(2)
    expect(old.runtime.getSnapshot().admission).toBe("idle")
    expect(old.runtime.chat("while reconnecting")).toBe(false)
    old.runtime.dispose()
    const next = fixture(Promise.resolve(room), Promise.resolve([]), "guest")
    next.runtime.start()
    next.status("open")
    next.server("NYUUSHITSU", entered)
    delayed.resolve(room)
    old.server("BANGUMI", { enmoku: [item] })
    await Bun.sleep(0)
    expect(old.runtime.getSnapshot().room).toBeNull()
    expect(next.runtime.getSnapshot().queue).toEqual([])
    expect(next.runtime.getSnapshot().admission).toBe("entered")
    expect(next.runtime.identityId).toBe("guest")
    next.runtime.dispose()
  })

  test("revocation closes transport and rejects late bootstrap", async () => {
    const delayed = deferred<Bushitsu>()
    let revoked = 0
    const f = fixture(delayed.promise, Promise.resolve([]), "host", () => revoked++)
    f.runtime.start()
    f.status("open")
    f.server("NYUUSHITSU", entered)
    f.server("NYUUSHITSU", { ...entered, status: "revoked" })
    delayed.resolve(room)
    await Bun.sleep(0)
    expect(f.runtime.getSnapshot().room).toBeNull()
    expect(revoked).toBe(1)
    expect(f.closes).toBe(1)
    f.runtime.dispose()
  })

  test("guest gates and governance pending use only matching server replies", async () => {
    const guest = fixture(Promise.resolve(room), Promise.resolve([]), "guest")
    guest.runtime.start()
    guest.status("open")
    guest.server("NYUUSHITSU", entered)
    await Bun.sleep(0)
    expect(guest.runtime.chat("allowed")).toBe(true)
    expect(guest.runtime.select(item.id)).toBe(false)
    guest.runtime.setPermissions({ chat: false, playlist: true, playback: false })
    guest.runtime.decide("someone", true)
    expect(
      guest.sent.some(
        (message) => message.type === "SETTEI" || message.type === "NYUUSHITSU_HANTEI",
      ),
    ).toBe(false)
    guest.server("KENGEN", { chat: false, playlist: true, playback: false })
    expect(guest.runtime.chat("denied")).toBe(false)
    expect(guest.runtime.select(item.id)).toBe(true)
    guest.runtime.dispose()

    const host = fixture()
    host.runtime.start()
    host.status("open")
    host.server("NYUUSHITSU", entered)
    await Bun.sleep(0)
    host.runtime.setAdmission("approval")
    expect(host.runtime.getSnapshot().command).toBe("admission")
    host.server("BANGUMI", { enmoku: [] })
    host.server("KENGEN", { chat: true, playlist: false, playback: false })
    expect(host.runtime.getSnapshot().command).toBe("admission")
    host.server("NYUUSHITSU", { ...entered, mode: "approval" })
    expect(host.runtime.getSnapshot().command).toBeNull()
    host.runtime.setPermissions({ chat: false, playlist: false, playback: false })
    expect(host.runtime.getSnapshot().command).toBe("permissions")
    host.server("KENGEN", { chat: true, playlist: false, playback: false })
    expect(host.runtime.getSnapshot().command).toBe("permissions")
    host.server("KENGEN", { chat: false, playlist: false, playback: false })
    expect(host.runtime.getSnapshot().command).toBeNull()
    host.runtime.decide("visitor", true)
    expect(host.runtime.getSnapshot().command).toBe("decision")
    host.server("NYUUSHITSU", {
      ...entered,
      mode: "approval",
      pending: [{ senderId: "visitor", nickname: "Visitor", requestedAt: 1 }],
    })
    expect(host.runtime.getSnapshot().command).toBe("decision")
    host.server("NYUUSHITSU", { ...entered, mode: "approval" })
    expect(host.runtime.getSnapshot().command).toBeNull()
    host.runtime.setPermissions({ chat: true, playlist: false, playback: false })
    host.server("KEIHOU", { message: "denied" })
    expect(host.runtime.getSnapshot()).toMatchObject({ command: null, error: "denied" })
    host.runtime.dispose()
  })

  test("disconnect cancels a pending HTTP command and ignores its late acknowledgement", async () => {
    const f = fixture()
    const delayed = deferred<string>()
    let signal: AbortSignal | undefined
    f.runtime.start()
    f.status("open")
    f.server("NYUUSHITSU", entered)
    await Bun.sleep(0)
    const result = f.runtime.command("move", "host", (ownedSignal) => {
      signal = ownedSignal
      return delayed.promise
    })
    expect(f.runtime.getSnapshot().command).toBe("move")
    f.status("closed")
    expect(signal?.aborted).toBe(true)
    expect(f.runtime.getSnapshot().command).toBeNull()
    delayed.resolve("late success")
    expect(await result).toBeUndefined()
    f.runtime.dispose()
  })

  test("failed HTTP command reports error without changing live queue", async () => {
    const f = fixture()
    f.runtime.start()
    f.status("open")
    f.server("NYUUSHITSU", entered)
    await Bun.sleep(0)
    await f.runtime.command("move", "host", async () => {
      throw new Error("move denied")
    })
    expect(f.runtime.getSnapshot()).toMatchObject({
      command: null,
      error: "move denied",
      queue: [],
    })
    f.runtime.dispose()
  })

  test("server playback and default snapshots precede player effects, and permission gates local drive", async () => {
    const f = fixture(Promise.resolve(room), Promise.resolve([item]), "guest")
    f.runtime.start()
    f.status("open")
    f.server("NYUUSHITSU", entered)
    await Bun.sleep(0)
    f.server("JOUEI", { enmokuId: item.id })
    const playback: Shinkou = { isPlaying: true, currentTime: 12, playbackRate: 1 }
    const observed: Array<{ time: number; snapshotTime: number | undefined }> = []
    const player: PlayerHandle = {
      apply: (state) =>
        observed.push({
          time: state.currentTime,
          snapshotTime: f.runtime.getSnapshot().playback?.currentTime,
        }),
      alignTransport: () => {},
      setRate: () => {},
      snapshot: () => ({ isPlaying: false, currentTime: 0, playbackRate: 1 }),
    }
    const detach = f.runtime.attachPlayer(player)
    f.server("SHINKOU", playback)
    expect(observed).toHaveLength(1)
    expect(observed[0]?.snapshotTime).toBe(12)
    expect(f.runtime.getSnapshot().playbackServerTime).toBeGreaterThan(0)
    await Bun.sleep(225)
    f.runtime.localPlayback({ ...playback, currentTime: 13 })
    expect(f.sent.some((message) => message.type === "SHINKOU")).toBe(false)
    f.server("KENGEN", { chat: true, playlist: false, playback: true })
    f.runtime.localPlayback({ ...playback, currentTime: 13 })
    expect(f.sent.some((message) => message.type === "SHINKOU")).toBe(true)
    f.server("DANMAKU_DEFAULT", { bushitsuId: "other-room", defaults: [] })
    expect(f.runtime.getSnapshot().danmakuDefaultsAuthoritative).toBe(false)
    f.server("DANMAKU_DEFAULT", { bushitsuId: "room-1", defaults: [] })
    expect(f.runtime.getSnapshot()).toMatchObject({
      danmakuDefaults: {},
      danmakuDefaultsAuthoritative: true,
    })
    expect(f.runtime.danmaku("live line")).toBe(true)
    expect(f.sent.at(-1)).toMatchObject({ type: "DANMAKU", payload: { content: "live line" } })
    f.server("DANMAKU", { content: "live line" })
    expect(f.runtime.getSnapshot().chat.at(-1)).toMatchObject({
      content: "live line",
      kind: "danmaku",
    })
    f.server("JOUEI", { enmokuId: "item-2" })
    expect(f.runtime.getSnapshot().playback).toEqual({
      isPlaying: false,
      currentTime: 0,
      playbackRate: 1,
    })
    detach()
    f.server("SHINKOU", { ...playback, currentTime: 30 })
    expect(observed).toHaveLength(1)
    f.runtime.dispose()
  })
})
