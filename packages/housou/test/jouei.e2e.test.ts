import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"
import {
  addAuthenticatedEnmoku,
  makeAuthenticatedRoom,
  openAuthenticatedSocket,
} from "./auth-fixture"

// JOUEI source-sync over the real WS surface: the 部長 sets a 演目, every client
// (including the host echo) receives JOUEI; a 部員 attempt is rejected with
// KEIHOU and never broadcasts. Mirrors the ws.test.ts driver style.

let base: string
let baseWs: string

beforeAll(() => {
  app.listen(0)
  base = `http://localhost:${app.server?.port}`
  baseWs = `ws://localhost:${app.server?.port}/ws`
})

afterAll(() => {
  app.server?.stop()
})

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

test("部長 JOUEI broadcasts to a 部員 and echoes back to the host", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const enmoku = await addAuthenticatedEnmoku(base, room.id)
  const member = await openAuthenticatedSocket(base, baseWs, room.id, "member")

  const gotByMember = nextMatch(member, (m) => m.type === "JOUEI")
  const gotByHost = nextMatch(host, (m) => m.type === "JOUEI")

  host.send(
    JSON.stringify({
      type: "JOUEI",
      ts: Date.now(),
      senderId: "host",
      payload: { enmokuId: enmoku.id },
    } satisfies KousokuMessage),
  )

  const [mm, mh] = await Promise.all([gotByMember, gotByHost])
  if (mm.type === "JOUEI") expect(mm.payload.enmokuId).toBe(enmoku.id)
  if (mh.type === "JOUEI") expect(mh.payload.enmokuId).toBe(enmoku.id)

  host.close()
  member.close()
})

test("JOUEI resets transport and broadcasts GENJOU for the new source", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const enmoku = await addAuthenticatedEnmoku(base, room.id)
  const member = await openAuthenticatedSocket(base, baseWs, room.id, "member")

  host.send(
    JSON.stringify({
      type: "SHINKOU",
      ts: Date.now(),
      senderId: "host",
      payload: { isPlaying: true, currentTime: 30, playbackRate: 1 },
    } satisfies KousokuMessage),
  )
  await new Promise((r) => setTimeout(r, 50))

  const gotGenjou = nextMatch(member, (m) => m.type === "GENJOU")
  host.send(
    JSON.stringify({
      type: "JOUEI",
      ts: Date.now(),
      senderId: "host",
      payload: { enmokuId: enmoku.id },
    } satisfies KousokuMessage),
  )

  const genjou = await gotGenjou
  expect(genjou.type).toBe("GENJOU")
  if (genjou.type === "GENJOU") {
    expect(genjou.payload.enmokuId).toBe(enmoku.id)
    expect(genjou.payload.shinkou).toEqual({ isPlaying: false, currentTime: 0, playbackRate: 1 })
  }

  host.close()
  member.close()
})

test("non-部長 JOUEI is rejected with KEIHOU and does not broadcast", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const enmoku = await addAuthenticatedEnmoku(base, room.id)
  const intruder = await openAuthenticatedSocket(base, baseWs, room.id, "intruder")

  let hostSawJouei = false
  host.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data) as KousokuMessage
    if (m.type === "JOUEI") hostSawJouei = true
  })

  const keihou = nextMatch(intruder, (m) => m.type === "KEIHOU")
  intruder.send(
    JSON.stringify({
      type: "JOUEI",
      ts: Date.now(),
      senderId: "intruder",
      payload: { enmokuId: enmoku.id },
    } satisfies KousokuMessage),
  )

  const k = await keihou
  expect(k.type).toBe("KEIHOU")
  // connection stays open after a rejected action (error-handling spec)
  expect(intruder.readyState).toBe(WebSocket.OPEN)

  await new Promise((r) => setTimeout(r, 150))
  expect(hostSawJouei).toBe(false)

  host.close()
  intruder.close()
})

test("late joiner OIKAKE → GENJOU carries the current enmokuId", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const enmoku = await addAuthenticatedEnmoku(base, room.id)
  host.send(
    JSON.stringify({
      type: "JOUEI",
      ts: Date.now(),
      senderId: "host",
      payload: { enmokuId: enmoku.id },
    } satisfies KousokuMessage),
  )
  await nextMatch(host, (m) => m.type === "JOUEI")

  const late = await openAuthenticatedSocket(base, baseWs, room.id, "late")
  const genjou = nextMatch(late, (m) => m.type === "GENJOU")
  late.send(
    JSON.stringify({
      type: "OIKAKE",
      ts: Date.now(),
      senderId: "late",
      payload: {},
    } satisfies KousokuMessage),
  )

  const g = await genjou
  if (g.type === "GENJOU") expect(g.payload.enmokuId).toBe(enmoku.id)

  host.close()
  late.close()
})
