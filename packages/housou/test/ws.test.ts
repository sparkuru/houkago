import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"
import { openAuthenticatedSocket } from "./auth-fixture"

// Integration test against a running Elysia instance, mirroring the spike
// driver: malformed envelope → KEIHOU (not disconnect), and two clients in the
// same room exchange OSHABERI echoes.

let base: string
let baseWs: string

beforeAll(() => {
  app.listen(0)
  const port = app.server?.port
  base = `http://localhost:${port}`
  baseWs = `ws://localhost:${port}/ws`
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

test("malformed envelope yields KEIHOU error, connection stays open", async () => {
  const ws = await openAuthenticatedSocket(base, baseWs, "rA", "u1")
  const keihou = await new Promise<KousokuMessage>((resolve) => {
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data) as KousokuMessage
      if (m.type === "KEIHOU") resolve(m)
    })
    ws.send(JSON.stringify({ nope: true }))
  })
  expect(keihou.type).toBe("KEIHOU")
  // connection must still be usable afterwards — not disconnected
  expect(ws.readyState).toBe(WebSocket.OPEN)
  ws.close()
})

test("two clients in the same room exchange OSHABERI echo", async () => {
  const a = await openAuthenticatedSocket(base, baseWs, "rB", "alice")
  const b = await openAuthenticatedSocket(base, baseWs, "rB", "bob")

  const gotByB = nextMatch(b, (m) => m.type === "OSHABERI")
  const gotByA = nextMatch(a, (m) => m.type === "OSHABERI")

  const msg: KousokuMessage = {
    type: "OSHABERI",
    ts: Date.now(),
    senderId: "alice",
    payload: { content: "hello room" },
  }
  a.send(JSON.stringify(msg))

  const [mb, ma] = await Promise.all([gotByB, gotByA])
  expect(mb.type).toBe("OSHABERI")
  expect(ma.type).toBe("OSHABERI")
  if (mb.type === "OSHABERI") expect(mb.payload.content).toBe("hello room")

  a.close()
  b.close()
})

test("two clients in the same room exchange DANMAKU echo", async () => {
  const a = await openAuthenticatedSocket(base, baseWs, "rDanmaku", "alice")
  const b = await openAuthenticatedSocket(base, baseWs, "rDanmaku", "bob")

  const gotByB = nextMatch(b, (m) => m.type === "DANMAKU")
  const gotByA = nextMatch(a, (m) => m.type === "DANMAKU")

  const msg: KousokuMessage = {
    type: "DANMAKU",
    ts: Date.now(),
    senderId: "alice",
    payload: { content: "fly", color: "#fff", mode: "scroll" },
  }
  a.send(JSON.stringify(msg))

  const [mb, ma] = await Promise.all([gotByB, gotByA])
  expect(mb.type).toBe("DANMAKU")
  expect(ma.type).toBe("DANMAKU")
  if (mb.type === "DANMAKU") {
    expect(mb.payload.content).toBe("fly")
    expect(mb.payload.color).toBe("#fff")
  }

  a.close()
  b.close()
})

test("room isolation: rC client does not receive rD chat", async () => {
  const c = await openAuthenticatedSocket(base, baseWs, "rC", "carol")
  const d = await openAuthenticatedSocket(base, baseWs, "rD", "dave")

  let leaked = false
  c.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data) as KousokuMessage
    if (m.type === "OSHABERI") leaked = true
  })

  d.send(
    JSON.stringify({
      type: "OSHABERI",
      ts: Date.now(),
      senderId: "dave",
      payload: { content: "other room" },
    } satisfies KousokuMessage),
  )

  await new Promise((r) => setTimeout(r, 150))
  expect(leaked).toBe(false)
  c.close()
  d.close()
})
