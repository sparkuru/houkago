import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import { app } from "../src/index"
import { startTenko } from "../src/ws/tenko"

// 点呼 heartbeat integration (design §5): once a 部長 has driven a room, the
// server authority clock periodically broadcasts GENJOU to that room — without
// any client OIKAKE. A 部員 that never asks still receives the heartbeat.
//
// startTenko is not auto-started in this test process (it runs only from
// import.meta.main), so we start it explicitly with a short interval and stop it
// in afterAll so the timer never leaks.

let baseHttp: string
let baseWs: string
let stopTenko: () => void

beforeAll(() => {
  app.listen(0)
  const port = app.server?.port
  baseHttp = `http://localhost:${port}`
  baseWs = `ws://localhost:${port}/ws`
  stopTenko = startTenko(app, 100)
})

afterAll(() => {
  stopTenko()
  app.server?.stop()
})

async function createRoom(buchouId: string): Promise<string> {
  const room = await fetch(`${baseHttp}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "tenko", buchouId }),
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

test("部員 receives a periodic GENJOU heartbeat without sending OIKAKE", async () => {
  const roomId = await createRoom("host")
  const host = await open(roomId, "host")
  // 部長 records authority state so the room becomes heartbeat-eligible.
  host.send(drive("host", { isPlaying: true, currentTime: 10, playbackRate: 1 }))
  await new Promise((r) => setTimeout(r, 50))

  const member = await open(roomId, "viewer")
  // The member never sends OIKAKE; the heartbeat alone must deliver a GENJOU.
  const heartbeat = nextMatch(member, (m) => m.type === "GENJOU")

  const g = await heartbeat
  expect(g.type).toBe("GENJOU")
  if (g.type === "GENJOU") {
    expect(g.payload.serverTime).toBeGreaterThan(0)
    // projected while playing → at least the recorded currentTime.
    expect(g.payload.shinkou.currentTime).toBeGreaterThanOrEqual(10)
  }

  host.close()
  member.close()
})

test("a room never driven by a 部長 gets no heartbeat", async () => {
  const roomId = await createRoom("host2")
  const member = await open(roomId, "viewer2")

  let sawGenjou = false
  member.addEventListener("message", (ev) => {
    if ((JSON.parse(ev.data) as KousokuMessage).type === "GENJOU") sawGenjou = true
  })

  // Several heartbeat intervals pass with no authority state recorded.
  await new Promise((r) => setTimeout(r, 350))
  expect(sawGenjou).toBe(false)

  member.close()
})
