import { expect } from "bun:test"
import type { Enmoku, KousokuMessage } from "houkago-kousoku"

const origin = "http://127.0.0.1:5173"
const fixtureId = crypto.randomUUID().replaceAll("-", "").slice(0, 8)
const sessions = new Map<string, string>()
const pendingSessions = new Map<string, Promise<string>>()

function key(base: string, alias: string): string {
  return `${base}:${alias}`
}

export async function sessionFor(base: string, alias: string): Promise<string> {
  const sessionKey = key(base, alias)
  const cached = sessions.get(sessionKey)
  if (cached) return cached
  const pending = pendingSessions.get(sessionKey)
  if (pending) return pending
  const created = (async () => {
    const username = `t_${fixtureId}_${alias.replaceAll(/[^a-zA-Z0-9_]/g, "_")}`
    let response = await fetch(`${base}/seitoshou/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ username, password: "correct-horse-battery" }),
    })
    if (response.status === 409) {
      response = await fetch(`${base}/seitoshou/sign-in`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ username, password: "correct-horse-battery" }),
      })
    }
    expect(response.status).toBe(200)
    const cookie = response.headers.get("set-cookie")?.split(";")[0]
    if (!cookie) throw new Error("missing session cookie")
    sessions.set(sessionKey, cookie)
    return cookie
  })()
  pendingSessions.set(sessionKey, created)
  try {
    return await created
  } finally {
    pendingSessions.delete(sessionKey)
  }
}

export async function makeAuthenticatedRoom(base: string, owner = "host"): Promise<{ id: string }> {
  const cookie = await sessionFor(base, owner)
  const response = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie },
    body: JSON.stringify({ name: "r" }),
  })
  expect(response.status).toBe(200)
  return response.json()
}

export async function openAuthenticatedSocket(
  base: string,
  baseWs: string,
  bushitsuId: string,
  alias: string,
): Promise<WebSocket> {
  const cookie = await sessionFor(base, alias)
  const ws = new WebSocket(`${baseWs}?bushitsuId=${bushitsuId}`, { headers: { cookie, origin } })
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve(), { once: true }))
  return ws
}

export type AuthenticatedPeer = {
  ws: WebSocket
  nextMatch(predicate: (message: KousokuMessage) => boolean): Promise<KousokuMessage>
}

// Attach the message listener before awaiting `open`: Elysia may send admission
// snapshots immediately after the handshake, before a plain socket caller gets
// a chance to install its own listener.
export async function openAuthenticatedPeer(
  base: string,
  baseWs: string,
  bushitsuId: string,
  alias: string,
): Promise<AuthenticatedPeer> {
  const cookie = await sessionFor(base, alias)
  const ws = new WebSocket(`${baseWs}?bushitsuId=${bushitsuId}`, { headers: { cookie, origin } })
  const inbox: KousokuMessage[] = []
  const waiters: Array<{
    predicate: (message: KousokuMessage) => boolean
    resolve: (message: KousokuMessage) => void
  }> = []
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data) as KousokuMessage
    const index = waiters.findIndex((waiter) => waiter.predicate(message))
    if (index === -1) {
      inbox.push(message)
      return
    }
    const [waiter] = waiters.splice(index, 1)
    waiter.resolve(message)
  })
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve(), { once: true }))
  return {
    ws,
    nextMatch(predicate) {
      const index = inbox.findIndex(predicate)
      if (index !== -1) return Promise.resolve(inbox.splice(index, 1)[0] as KousokuMessage)
      return new Promise((resolve) => waiters.push({ predicate, resolve }))
    },
  }
}

export async function addAuthenticatedEnmoku(
  base: string,
  bushitsuId: string,
  owner = "host",
): Promise<Enmoku> {
  const cookie = await sessionFor(base, owner)
  const response = await fetch(`${base}/bushitsu/${bushitsuId}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie },
    body: JSON.stringify({ title: "s", type: "hls", url: "https://e/v.m3u8" }),
  })
  expect(response.status).toBe(200)
  return response.json()
}

export { origin }
