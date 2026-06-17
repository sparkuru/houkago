import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage, NyuushitsuMode } from "houkago-kousoku"
import { app } from "../src/index"

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

async function makeRoom(buchouId: string): Promise<{ id: string }> {
  return fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r", buchouId }),
  }).then((r) => r.json())
}

type Peer = {
  ws: WebSocket
  nextMatch(pred: (m: KousokuMessage) => boolean): Promise<KousokuMessage>
}

function open(bushitsuId: string, senderId: string): Promise<Peer> {
  const ws = new WebSocket(`${baseWs}?bushitsuId=${bushitsuId}&senderId=${senderId}`)
  const inbox: KousokuMessage[] = []
  const waiters: { pred: (m: KousokuMessage) => boolean; resolve: (m: KousokuMessage) => void }[] =
    []
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data) as KousokuMessage
    const index = waiters.findIndex((w) => w.pred(m))
    if (index === -1) {
      inbox.push(m)
      return
    }
    const [waiter] = waiters.splice(index, 1)
    waiter.resolve(m)
  })
  const peer: Peer = {
    ws,
    nextMatch(pred) {
      const index = inbox.findIndex(pred)
      if (index !== -1) {
        const [m] = inbox.splice(index, 1)
        return Promise.resolve(m)
      }
      return new Promise((resolve) => waiters.push({ pred, resolve }))
    },
  }
  return new Promise((resolve) => {
    ws.addEventListener("open", () => resolve(peer), { once: true })
  })
}

function setMode(ws: WebSocket, senderId: string, mode: NyuushitsuMode): void {
  ws.send(
    JSON.stringify({
      type: "NYUUSHITSU_SETTEI",
      ts: Date.now(),
      senderId,
      payload: { mode },
    } satisfies KousokuMessage),
  )
}

function decide(ws: WebSocket, senderId: string, targetId: string, approved: boolean): void {
  ws.send(
    JSON.stringify({
      type: "NYUUSHITSU_HANTEI",
      ts: Date.now(),
      senderId,
      payload: { senderId: targetId, approved },
    } satisfies KousokuMessage),
  )
}

test("default open mode admits a guest and sends the admission snapshot", async () => {
  const room = await makeRoom("host-open")
  const guest = await open(room.id, "guest-open")
  const n = await guest.nextMatch((m) => m.type === "NYUUSHITSU")
  if (n.type === "NYUUSHITSU") {
    expect(n.payload.mode).toBe("open")
    expect(n.payload.status).toBe("entered")
  }
  const k = await guest.nextMatch((m) => m.type === "KENGEN")
  expect(k.type).toBe("KENGEN")
  guest.ws.close()
})

test("closed mode rejects new guests before roster join", async () => {
  const room = await makeRoom("host-closed")
  const host = await open(room.id, "host-closed")
  await host.nextMatch((m) => m.type === "NYUUSHITSU")
  setMode(host.ws, "host-closed", "closed")
  await host.nextMatch((m) => m.type === "NYUUSHITSU" && m.payload.mode === "closed")

  const guest = await open(room.id, "guest-closed")
  const closed = await guest.nextMatch((m) => m.type === "NYUUSHITSU")
  if (closed.type === "NYUUSHITSU") {
    expect(closed.payload.status).toBe("closed")
  }

  let hostSawGuest = false
  host.ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data) as KousokuMessage
    if (m.type === "SHUSSEKI" && m.payload.members.some((b) => b.id === "guest-closed")) {
      hostSawGuest = true
    }
  })
  await new Promise((r) => setTimeout(r, 150))
  expect(hostSawGuest).toBe(false)
  host.ws.close()
  guest.ws.close()
})

test("approval mode waits, blocks room actions, then admits on host approval", async () => {
  const room = await makeRoom("host-approval")
  const host = await open(room.id, "host-approval")
  await host.nextMatch((m) => m.type === "NYUUSHITSU")
  setMode(host.ws, "host-approval", "approval")
  await host.nextMatch((m) => m.type === "NYUUSHITSU" && m.payload.mode === "approval")

  const guest = await open(room.id, "guest-approval")
  const waiting = await guest.nextMatch((m) => m.type === "NYUUSHITSU")
  if (waiting.type === "NYUUSHITSU") expect(waiting.payload.status).toBe("waiting")

  const hostPending = await host.nextMatch(
    (m) =>
      m.type === "NYUUSHITSU" && m.payload.pending.some((p) => p.senderId === "guest-approval"),
  )
  if (hostPending.type === "NYUUSHITSU") expect(hostPending.payload.pending).toHaveLength(1)

  const blocked = guest.nextMatch((m) => m.type === "KEIHOU")
  guest.ws.send(
    JSON.stringify({
      type: "OSHABERI",
      ts: Date.now(),
      senderId: "guest-approval",
      payload: { content: "not yet" },
    } satisfies KousokuMessage),
  )
  expect((await blocked).type).toBe("KEIHOU")

  const entered = guest.nextMatch((m) => m.type === "NYUUSHITSU" && m.payload.status === "entered")
  decide(host.ws, "host-approval", "guest-approval", true)
  expect((await entered).type).toBe("NYUUSHITSU")
  const kengen = await guest.nextMatch((m) => m.type === "KENGEN")
  expect(kengen.type).toBe("KENGEN")

  host.ws.close()
  guest.ws.close()
})

test("approval mode survives host offline; host sees pending after reconnect", async () => {
  const room = await makeRoom("host-offline")
  const host = await open(room.id, "host-offline")
  await host.nextMatch((m) => m.type === "NYUUSHITSU")
  setMode(host.ws, "host-offline", "approval")
  await host.nextMatch((m) => m.type === "NYUUSHITSU" && m.payload.mode === "approval")
  host.ws.close()
  await new Promise((r) => setTimeout(r, 50))

  const guest = await open(room.id, "guest-offline")
  const waiting = await guest.nextMatch((m) => m.type === "NYUUSHITSU")
  if (waiting.type === "NYUUSHITSU") {
    expect(waiting.payload.mode).toBe("approval")
    expect(waiting.payload.status).toBe("waiting")
  }

  const hostAgain = await open(room.id, "host-offline")
  const pending = await hostAgain.nextMatch(
    (m) => m.type === "NYUUSHITSU" && m.payload.pending.some((p) => p.senderId === "guest-offline"),
  )
  if (pending.type === "NYUUSHITSU") expect(pending.payload.status).toBe("entered")

  hostAgain.ws.close()
  guest.ws.close()
})

test("non-host cannot set admission mode or approve guests", async () => {
  const room = await makeRoom("host-auth")
  const host = await open(room.id, "host-auth")
  const guest = await open(room.id, "guest-auth")
  await guest.nextMatch((m) => m.type === "NYUUSHITSU")

  const setRejected = guest.nextMatch((m) => m.type === "KEIHOU")
  setMode(guest.ws, "guest-auth", "closed")
  expect((await setRejected).type).toBe("KEIHOU")

  const approvalRejected = guest.nextMatch((m) => m.type === "KEIHOU")
  decide(guest.ws, "guest-auth", "someone", true)
  expect((await approvalRejected).type).toBe("KEIHOU")

  host.ws.close()
  guest.ws.close()
})
