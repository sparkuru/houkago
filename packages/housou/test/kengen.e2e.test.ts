import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"
import { clearKengen } from "../src/lib/kengen"
import {
  makeAuthenticatedRoom,
  openAuthenticatedPeer,
  openAuthenticatedSocket,
} from "./auth-fixture"

// 権限 enforcement over the real WS surface (prd role-permissions §2):
// - a new joiner receives a KENGEN snapshot on open
// - SETTEI from a non-host is rejected (KEIHOU), from the host broadcasts KENGEN
// - a guest without playback/chat is rejected (KEIHOU) and does not broadcast
// Mirrors jouei.e2e.test.ts driver style.

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

test("new joiner receives a KENGEN snapshot with the default permissions", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const k = await nextMatch(host, (m) => m.type === "KENGEN")
  if (k.type === "KENGEN") {
    expect(k.payload).toEqual({ playback: false, chat: true, playlist: false })
  }
  host.close()
})

test("non-部長 SETTEI is rejected with KEIHOU; host SETTEI broadcasts KENGEN", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const guest = await openAuthenticatedSocket(base, baseWs, room.id, "guest")
  await nextMatch(guest, (m) => m.type === "KENGEN") // consume initial snapshot

  // guest tries to set permissions → rejected
  const guestKeihou = nextMatch(guest, (m) => m.type === "KEIHOU")
  guest.send(
    JSON.stringify({
      type: "SETTEI",
      ts: Date.now(),
      senderId: "guest",
      payload: { playback: true, chat: true, playlist: true },
    } satisfies KousokuMessage),
  )
  expect((await guestKeihou).type).toBe("KEIHOU")

  // host turns playback on → KENGEN broadcast reaches the guest
  const guestKengen = nextMatch(guest, (m) => m.type === "KENGEN")
  host.send(
    JSON.stringify({
      type: "SETTEI",
      ts: Date.now(),
      senderId: "host",
      payload: { playback: true, chat: true, playlist: false },
    } satisfies KousokuMessage),
  )
  const k = await guestKengen
  if (k.type === "KENGEN") expect(k.payload.playback).toBe(true)

  host.close()
  guest.close()
})

test("owner policy survives an empty room and a cleared process cache", async () => {
  const room = await makeAuthenticatedRoom(base, "persistent-owner")
  const host = await openAuthenticatedPeer(base, baseWs, room.id, "persistent-owner")
  await host.nextMatch((message) => message.type === "KENGEN")

  const saved = host.nextMatch(
    (message) =>
      message.type === "KENGEN" &&
      message.payload.playback &&
      message.payload.chat &&
      message.payload.playlist,
  )
  host.ws.send(
    JSON.stringify({
      type: "SETTEI",
      ts: Date.now(),
      senderId: "persistent-owner",
      payload: { playback: true, chat: true, playlist: true },
    } satisfies KousokuMessage),
  )
  await saved

  const closed = new Promise<void>((resolve) => {
    host.ws.addEventListener("close", () => resolve(), { once: true })
  })
  host.ws.close()
  await closed
  clearKengen(room.id)

  const reconnected = await openAuthenticatedPeer(base, baseWs, room.id, "persistent-owner")
  const restored = await reconnected.nextMatch((message) => message.type === "KENGEN")
  if (restored.type === "KENGEN") {
    expect(restored.payload).toEqual({ playback: true, chat: true, playlist: true })
  }
  reconnected.ws.close()
})

test("guest without chat permission: OSHABERI and DANMAKU are rejected and not broadcast", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const guest = await openAuthenticatedSocket(base, baseWs, room.id, "guest")
  await nextMatch(guest, (m) => m.type === "KENGEN")

  // host turns chat OFF for guests
  const guestKengen = nextMatch(guest, (m) => m.type === "KENGEN")
  host.send(
    JSON.stringify({
      type: "SETTEI",
      ts: Date.now(),
      senderId: "host",
      payload: { playback: false, chat: false, playlist: false },
    } satisfies KousokuMessage),
  )
  await guestKengen

  let hostSawChat = false
  let hostSawDanmaku = false
  host.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data) as KousokuMessage
    if (m.type === "OSHABERI") hostSawChat = true
    if (m.type === "DANMAKU") hostSawDanmaku = true
  })

  const chatKeihou = nextMatch(guest, (m) => m.type === "KEIHOU")
  guest.send(
    JSON.stringify({
      type: "OSHABERI",
      ts: Date.now(),
      senderId: "guest",
      payload: { content: "hi" },
    } satisfies KousokuMessage),
  )
  expect((await chatKeihou).type).toBe("KEIHOU")
  const danmakuKeihou = nextMatch(guest, (m) => m.type === "KEIHOU")
  guest.send(
    JSON.stringify({
      type: "DANMAKU",
      ts: Date.now(),
      senderId: "guest",
      payload: { content: "fly" },
    } satisfies KousokuMessage),
  )
  expect((await danmakuKeihou).type).toBe("KEIHOU")
  expect(guest.readyState).toBe(WebSocket.OPEN)

  await new Promise((r) => setTimeout(r, 150))
  expect(hostSawChat).toBe(false)
  expect(hostSawDanmaku).toBe(false)

  host.close()
  guest.close()
})

test("guest WITH playback permission may drive SHINKOU", async () => {
  const room = await makeAuthenticatedRoom(base)
  const host = await openAuthenticatedSocket(base, baseWs, room.id, "host")
  const guest = await openAuthenticatedSocket(base, baseWs, room.id, "guest")
  await nextMatch(guest, (m) => m.type === "KENGEN")

  // host grants playback to guests
  const grant = nextMatch(guest, (m) => m.type === "KENGEN")
  host.send(
    JSON.stringify({
      type: "SETTEI",
      ts: Date.now(),
      senderId: "host",
      payload: { playback: true, chat: true, playlist: false },
    } satisfies KousokuMessage),
  )
  await grant

  // guest drives SHINKOU → host receives it (accepted, broadcast)
  const hostSaw = nextMatch(host, (m) => m.type === "SHINKOU")
  guest.send(
    JSON.stringify({
      type: "SHINKOU",
      ts: Date.now(),
      senderId: "guest",
      payload: { isPlaying: true, currentTime: 5, playbackRate: 1 },
    } satisfies KousokuMessage),
  )
  const s = await hostSaw
  if (s.type === "SHINKOU") expect(s.payload.currentTime).toBe(5)

  host.close()
  guest.close()
})
