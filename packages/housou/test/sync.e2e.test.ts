import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import { app } from "../src/index"

// End-to-end sync slice (design §5) against a running Elysia instance: 部長
// SHINKOU broadcasts to 部員, a late joiner catches up via OIKAKE→GENJOU, and a
// non-部長 SHINKOU is rejected with KEIHOU and never broadcast.

let baseHttp: string
let baseWs: string

beforeAll(() => {
  app.listen(0)
  const port = app.server?.port
  baseHttp = `http://localhost:${port}`
  baseWs = `ws://localhost:${port}/ws`
})

afterAll(() => {
  app.server?.stop()
})

async function createRoom(buchouId: string): Promise<string> {
  const room = await fetch(`${baseHttp}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "sync", buchouId }),
  }).then((r) => r.json())
  return room.id
}

function open(bushitsuId: string, senderId: string): Promise<WebSocket> {
  const ws = new WebSocket(`${baseWs}?bushitsuId=${bushitsuId}&senderId=${senderId}`)
  return new Promise((resolve) => ws.addEventListener("open", () => resolve(ws), { once: true }))
}

function nextMatch(ws: WebSocket, pred: (m: KousokuMessage) => boolean): Promise<KousokuMessage> {
  return new Promise((resolve) => {
    const onMsg = (ev: MessageEvent) => {
      const m = JSON.parse(ev.data) as KousokuMessage
      if (pred(m)) {
        ws.removeEventListener("message", onMsg)
        resolve(m)
      }
    }
    ws.addEventListener("message", onMsg)
  })
}

const drive = (senderId: string, payload: Shinkou): string =>
  JSON.stringify({ type: "SHINKOU", ts: Date.now(), senderId, payload } satisfies KousokuMessage)

test("部長 SHINKOU is broadcast to 部員 in the same room", async () => {
  const roomId = await createRoom("host")
  const host = await open(roomId, "host")
  const member = await open(roomId, "viewer")

  const got = nextMatch(member, (m) => m.type === "SHINKOU")
  host.send(drive("host", { isPlaying: true, currentTime: 42, playbackRate: 1 }))

  const m = await got
  expect(m.type).toBe("SHINKOU")
  if (m.type === "SHINKOU") expect(m.payload.currentTime).toBe(42)

  host.close()
  member.close()
})

test("late joiner catches up: OIKAKE → GENJOU reflects the 部長's last Shinkou", async () => {
  const roomId = await createRoom("host")
  const host = await open(roomId, "host")
  host.send(drive("host", { isPlaying: false, currentTime: 100, playbackRate: 1 }))
  // let the server record authority state before the late joiner asks
  await new Promise((r) => setTimeout(r, 50))

  const late = await open(roomId, "late")
  const genjou = nextMatch(late, (m) => m.type === "GENJOU")
  late.send(JSON.stringify({ type: "OIKAKE", ts: Date.now(), senderId: "late", payload: {} }))

  const g = await genjou
  expect(g.type).toBe("GENJOU")
  if (g.type === "GENJOU") {
    expect(g.payload.shinkou.currentTime).toBe(100)
    expect(g.payload.serverTime).toBeGreaterThan(0)
  }

  host.close()
  late.close()
})

test("non-部長 SHINKOU is rejected with KEIHOU and not broadcast", async () => {
  const roomId = await createRoom("host")
  const host = await open(roomId, "host")
  const intruder = await open(roomId, "viewer")

  let hostSawShinkou = false
  host.addEventListener("message", (ev) => {
    if ((JSON.parse(ev.data) as KousokuMessage).type === "SHINKOU") hostSawShinkou = true
  })

  const keihou = nextMatch(intruder, (m) => m.type === "KEIHOU")
  intruder.send(drive("viewer", { isPlaying: true, currentTime: 5, playbackRate: 1 }))

  const k = await keihou
  expect(k.type).toBe("KEIHOU")

  // the rejected drive must not reach other members
  await new Promise((r) => setTimeout(r, 150))
  expect(hostSawShinkou).toBe(false)

  host.close()
  intruder.close()
})
