import { expect, test } from "bun:test"
import type { Bushitsu, Enmoku, KousokuMessage, NyuushitsuStatus } from "houkago-kousoku"
import {
  type RoomSessionController,
  type RoomSessionTransport,
  createRoomSessionController,
} from "../src/lib/room-session"

const room: Bushitsu = { id: "room-a", name: "Room A", buchouId: "host", createdAt: 1 }

function enmoku(id: string): Enmoku {
  return {
    id,
    bushitsuId: room.id,
    title: id,
    type: "hls",
    url: `https://example.test/${id}.m3u8`,
    addedBy: "host",
  }
}

function enmokuFor(bushitsuId: string, id: string): Enmoku {
  return { ...enmoku(id), bushitsuId }
}

function nyuushitsu(status: NyuushitsuStatus): KousokuMessage {
  return {
    type: "NYUUSHITSU",
    ts: 1,
    senderId: "server",
    payload: { mode: "open", status, pending: [] },
  }
}

function jouei(enmokuId: string | null): KousokuMessage {
  return {
    type: "JOUEI",
    ts: 2,
    senderId: "server",
    payload: { enmokuId },
  }
}

function bangumi(items: readonly Enmoku[]): KousokuMessage {
  return {
    type: "BANGUMI",
    ts: 3,
    senderId: "server",
    payload: { enmoku: [...items] },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function flush(): Promise<void> {
  return Promise.resolve().then(() => undefined)
}

type Harness = {
  session: RoomSessionController
  events: string[]
  sent: KousokuMessage[]
  emitMessage: (message: KousokuMessage) => void
  emitStatus: (status: "connecting" | "open" | "closed" | "error") => void
  connectCalls: string[]
  closeCalls: number
  setBangumiCalls: Enmoku[][]
  currentId: string | null
}

function makeHarness(
  overrides: {
    fetchRoom?: () => Bushitsu | null | PromiseLike<Bushitsu | null>
    fetchBangumi?: () => readonly Enmoku[] | null | PromiseLike<readonly Enmoku[] | null>
  } = {},
): Harness {
  const events: string[] = []
  const sent: KousokuMessage[] = []
  const connectCalls: string[] = []
  const setBangumiCalls: Enmoku[][] = []
  let closeCalls = 0
  let messageHandler: ((message: KousokuMessage) => void) | null = null
  let statusHandler: ((status: "connecting" | "open" | "closed" | "error") => void) | null = null
  let currentId: string | null = null
  let localBangumi: Enmoku[] = []

  const transport: RoomSessionTransport = {
    connect: (roomId) => {
      connectCalls.push(roomId)
      events.push(`connect:${roomId}`)
    },
    send: (message) => {
      sent.push(message)
      events.push(`send:${message.type}`)
    },
    close: () => {
      closeCalls += 1
      events.push("close")
    },
  }

  const session = createRoomSessionController({
    roomId: room.id,
    identityKey: "guest",
    createTransport: (onMessage, onStatus) => {
      messageHandler = onMessage
      statusHandler = onStatus
      return transport
    },
    fetchRoom: overrides.fetchRoom ?? (() => room),
    fetchBangumi: overrides.fetchBangumi ?? (() => []),
    applyMessage: (message) => {
      events.push(`apply:${message.type}`)
      if (message.type === "JOUEI") currentId = message.payload.enmokuId
      if (message.type === "GENJOU") currentId = message.payload.enmokuId
      if (message.type === "BANGUMI") localBangumi = [...message.payload.enmoku]
    },
    resetRoom: (roomId) => events.push(`reset:${roomId ?? "null"}`),
    setRoom: (nextRoom) => events.push(`room:${nextRoom?.id ?? "null"}`),
    setBangumi: (items) => {
      localBangumi = [...items]
      setBangumiCalls.push([...items])
      events.push(`queue:${items.map((item) => item.id).join(",")}`)
    },
    getBangumi: () => localBangumi,
    getCurrentEnmokuId: () => currentId,
    onCurrentEnmoku: (item) => events.push(`current:${item?.id ?? "null"}`),
    onStatus: (status) => events.push(`status:${status}`),
    onAdmission: (status) => events.push(`admission:${status}`),
    onRevoked: () => events.push("revoked"),
    isBuchou: () => false,
    senderId: () => "guest",
    now: () => 100,
  })

  return {
    session,
    events,
    sent,
    emitMessage: (message) => messageHandler?.(message),
    emitStatus: (status) => statusHandler?.(status),
    connectCalls,
    get closeCalls() {
      return closeCalls
    },
    setBangumiCalls,
    get currentId() {
      return currentId
    },
  }
}

test("bootstrap is admission-gated and preserves room → host decision → OIKAKE → queue order", async () => {
  const harness = makeHarness({
    fetchRoom: () => {
      harness.events.push("fetch-room")
      return room
    },
    fetchBangumi: () => {
      harness.events.push("fetch-queue")
      return [enmoku("e1")]
    },
  })

  harness.session.start()
  expect(harness.session.send(jouei("e1"))).toBe(false)
  harness.emitMessage(nyuushitsu("waiting"))
  await flush()
  expect(harness.events).not.toContain("fetch-room")
  expect(harness.events).not.toContain("fetch-queue")

  harness.emitMessage(nyuushitsu("entered"))
  await flush()
  await flush()

  expect(harness.events.indexOf("fetch-room")).toBeGreaterThan(-1)
  expect(harness.events.indexOf("fetch-queue")).toBeGreaterThan(-1)
  expect(harness.events.indexOf("room:room-a")).toBeLessThan(harness.events.indexOf("send:OIKAKE"))
  expect(harness.events.indexOf("send:OIKAKE")).toBeLessThan(harness.events.indexOf("queue:e1"))
  expect(harness.session.send(jouei("e1"))).toBe(true)
})

test("a newer WS BANGUMI snapshot wins over a delayed bootstrap queue response", async () => {
  const queue = deferred<readonly Enmoku[] | null>()
  const harness = makeHarness({ fetchBangumi: () => queue.promise })
  harness.session.start()
  harness.emitMessage(nyuushitsu("entered"))
  await flush()
  harness.emitMessage(bangumi([enmoku("ws-new")]))
  queue.resolve([enmoku("http-old")])
  await flush()
  await flush()

  expect(harness.setBangumiCalls).toEqual([])
  expect(harness.events).toContain("apply:BANGUMI")
})

test("bootstrap ignores room-mismatched HTTP responses", async () => {
  const foreignRoom = { ...room, id: "room-b", name: "Foreign room" }
  const harness = makeHarness({
    fetchRoom: () => foreignRoom,
    fetchBangumi: () => [enmokuFor(foreignRoom.id, "foreign-item")],
  })

  harness.session.start()
  harness.emitMessage(nyuushitsu("entered"))
  await flush()
  await flush()

  expect(harness.events).not.toContain("room:room-b")
  expect(harness.setBangumiCalls).toEqual([])
  expect(harness.sent.map((message) => message.type)).toEqual(["OIKAKE"])
})

test("reconnect keeps one transport and invalidates the previous admission epoch", async () => {
  const roomRequests = [deferred<Bushitsu | null>(), deferred<Bushitsu | null>()]
  const queueRequests = [deferred<readonly Enmoku[] | null>(), deferred<readonly Enmoku[] | null>()]
  let roomRequest = 0
  let queueRequest = 0
  const harness = makeHarness({
    fetchRoom: () => roomRequests[roomRequest++].promise,
    fetchBangumi: () => queueRequests[queueRequest++].promise,
  })

  harness.session.start()
  harness.emitMessage(nyuushitsu("entered"))
  await flush()
  expect(harness.session.reconnect()).toBe(true)
  harness.emitMessage(nyuushitsu("entered"))
  await flush()

  roomRequests[0].resolve({ ...room, name: "old" })
  queueRequests[0].resolve([enmoku("old")])
  roomRequests[1].resolve({ ...room, name: "new" })
  queueRequests[1].resolve([enmoku("new")])
  await flush()
  await flush()

  expect(harness.connectCalls).toEqual([room.id, room.id])
  expect(harness.setBangumiCalls).toEqual([[enmoku("new")]])
  expect(harness.events.filter((event) => event.startsWith("room:")).slice(-1)).toEqual([
    "room:room-a",
  ])
})

test("a closed status does not suppress the next connecting epoch", () => {
  const harness = makeHarness()
  harness.session.start()
  const afterStart = harness.session.getSnapshot().connectionEpoch

  harness.emitStatus("closed")
  const afterClosed = harness.session.getSnapshot().connectionEpoch
  harness.emitStatus("connecting")

  expect(afterClosed).toBe(afterStart + 1)
  expect(harness.session.getSnapshot().connectionEpoch).toBe(afterClosed + 1)
})

test("revocation invalidates pending bootstrap and closes the admitted transport", async () => {
  const roomRequest = deferred<Bushitsu | null>()
  const queueRequest = deferred<readonly Enmoku[] | null>()
  const harness = makeHarness({
    fetchRoom: () => roomRequest.promise,
    fetchBangumi: () => queueRequest.promise,
  })
  harness.session.start()
  harness.emitMessage(nyuushitsu("entered"))
  await flush()
  harness.emitMessage(nyuushitsu("revoked"))
  roomRequest.resolve(room)
  queueRequest.resolve([enmoku("late")])
  await flush()
  await flush()

  expect(harness.closeCalls).toBe(1)
  expect(harness.events).toContain("revoked")
  expect(harness.setBangumiCalls).toEqual([])
  expect(harness.session.send(jouei("late"))).toBe(false)
})

test("dispose is idempotent and late transport callbacks cannot reach the session", () => {
  const harness = makeHarness()
  harness.session.start()
  harness.session.dispose()
  harness.session.dispose()
  harness.emitMessage(bangumi([enmoku("late")]))
  harness.emitStatus("open")

  expect(harness.closeCalls).toBe(1)
  expect(harness.events.filter((event) => event === "apply:BANGUMI")).toEqual([])
  expect(harness.session.getSnapshot()).toMatchObject({ disposed: true, hasTransport: false })
})

test("late current-item resolution cannot replace a newer requested item", async () => {
  const currentRequests = [
    deferred<readonly Enmoku[] | null>(),
    deferred<readonly Enmoku[] | null>(),
  ]
  let request = 0
  const harness = makeHarness({
    fetchBangumi: () => {
      if (request++ === 0) return []
      return currentRequests[request - 2].promise
    },
  })
  harness.session.start()
  harness.emitMessage(nyuushitsu("entered"))
  await flush()
  await flush()

  harness.emitMessage(jouei("e1"))
  harness.emitMessage(jouei("e2"))
  currentRequests[0].resolve([enmoku("e1")])
  await flush()
  currentRequests[1].resolve([enmoku("e2")])
  await flush()
  await flush()

  expect(harness.events).not.toContain("current:e1")
  expect(harness.events).toContain("current:e2")
  expect(harness.currentId).toBe("e2")
})

test("a room-mismatched current-item response cannot clear current state", async () => {
  const queue = deferred<readonly Enmoku[] | null>()
  const harness = makeHarness({
    fetchBangumi: () => queue.promise,
  })

  harness.session.start()
  harness.emitMessage(nyuushitsu("entered"))
  await flush()
  await flush()
  harness.events.length = 0
  harness.setBangumiCalls.length = 0

  harness.emitMessage(jouei("e1"))
  queue.resolve([enmokuFor("room-b", "e1")])
  await flush()
  await flush()

  expect(harness.setBangumiCalls).toEqual([])
  expect(harness.events).not.toContain("current:null")
})

test("a transport creation failure can be retried", () => {
  let attempts = 0
  const transport: RoomSessionTransport = {
    connect: () => {},
    send: () => {},
    close: () => {},
  }
  const session = createRoomSessionController({
    roomId: room.id,
    identityKey: "guest",
    createTransport: () => {
      attempts += 1
      if (attempts === 1) throw new Error("construction failed")
      return transport
    },
    fetchRoom: () => room,
    fetchBangumi: () => [],
    applyMessage: () => {},
    setRoom: () => {},
    setBangumi: () => {},
    getBangumi: () => [],
    getCurrentEnmokuId: () => null,
  })

  expect(session.start()).toBe(false)
  expect(session.getSnapshot()).toMatchObject({ started: false, hasTransport: false })
  expect(session.start()).toBe(true)
  expect(attempts).toBe(2)
  session.dispose()
})
