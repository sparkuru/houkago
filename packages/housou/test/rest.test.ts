import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"

// Exercise the domain → db layering through the real REST surface. Bootstrap
// (CREATE TABLE IF NOT EXISTS) runs on import of the db client.

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

test("create bushitsu, then read it back", async () => {
  const created = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "映画部", buchouId: "u1" }),
  }).then((r) => r.json())

  expect(created.id).toBeTruthy()
  expect(created.buchouId).toBe("u1")

  const fetched = await fetch(`${base}/bushitsu/${created.id}`).then((r) => r.json())
  expect(fetched.id).toBe(created.id)
  expect(fetched.name).toBe("映画部")
})

test("add enmoku and list bangumi", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r", buchouId: "u1" }),
  }).then((r) => r.json())

  await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "test", type: "direct", url: "https://e/v.mp4", addedBy: "u1" }),
  })

  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(Array.isArray(bangumi)).toBe(true)
  expect(bangumi[0].title).toBe("test")
})

test("delete enmoku removes it from bangumi", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-delete", buchouId: "u1" }),
  }).then((r) => r.json())

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "delete-me",
      type: "direct",
      url: "https://e/v.mp4",
      addedBy: "u1",
    }),
  }).then((r) => r.json())

  const deleted = await fetch(`${base}/bushitsu/${room.id}/enmoku/${enmoku.id}`, {
    method: "DELETE",
  })
  expect(deleted.status).toBe(200)

  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(bangumi.some((e: { id: string }) => e.id === enmoku.id)).toBe(false)
})

test("delete missing enmoku yields 404 with structured error", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-delete-missing", buchouId: "u1" }),
  }).then((r) => r.json())

  const res = await fetch(`${base}/bushitsu/${room.id}/enmoku/nope`, {
    method: "DELETE",
  })
  expect(res.status).toBe(404)
  const body = await res.json()
  expect(body.error.code).toBe("ENMOKU_NOT_FOUND")
})

test("delete enmoku broadcasts BANGUMI to active room members", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-delete-broadcast", buchouId: "host" }),
  }).then((r) => r.json())

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "broadcast-delete",
      type: "direct",
      url: "https://e/v.mp4",
      addedBy: "host",
    }),
  }).then((r) => r.json())

  const host = await open(room.id, "host")
  const guest = await open(room.id, "guest")
  const hostBangumi = nextMatch(host, (m) => m.type === "BANGUMI")
  const guestBangumi = nextMatch(guest, (m) => m.type === "BANGUMI")

  await fetch(`${base}/bushitsu/${room.id}/enmoku/${enmoku.id}`, {
    method: "DELETE",
  })

  const [hostMsg, guestMsg] = await Promise.all([hostBangumi, guestBangumi])
  if (hostMsg.type === "BANGUMI") expect(hostMsg.payload.enmoku).toEqual([])
  if (guestMsg.type === "BANGUMI") expect(guestMsg.payload.enmoku).toEqual([])

  host.close()
  guest.close()
})

test("missing bushitsu yields 404 with structured error", async () => {
  const res = await fetch(`${base}/bushitsu/nope`)
  expect(res.status).toBe(404)
  const body = await res.json()
  expect(body.error.code).toBe("BUSHITSU_NOT_FOUND")
})
