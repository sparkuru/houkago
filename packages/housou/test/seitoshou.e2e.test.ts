import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"

const origin = "http://127.0.0.1:5173"
let base: string
let baseWs: string

beforeAll(() => {
  app.listen(0)
  base = `http://127.0.0.1:${app.server?.port}`
  baseWs = `ws://127.0.0.1:${app.server?.port}/ws`
})

afterAll(() => app.server?.stop())

async function register(username: string): Promise<{ id: string; cookie: string }> {
  const response = await fetch(`${base}/seitoshou/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ username, password: "correct-horse-battery" }),
  })
  expect(response.status).toBe(200)
  const account = (await response.json()) as { id: string; password?: string }
  expect(account.password).toBeUndefined()
  const cookie = response.headers.get("set-cookie")?.split(";")[0]
  expect(cookie).toStartWith("houkago_seitoshou=")
  return { id: account.id, cookie: cookie ?? "" }
}

async function enter(roomId: string, cookie: string): Promise<WebSocket> {
  const ws = new WebSocket(`${baseWs}?bushitsuId=${roomId}`, { headers: { cookie, origin } })
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve(), { once: true }))
  await new Promise<KousokuMessage>((resolve) => {
    ws.addEventListener(
      "message",
      (event) => {
        const message = JSON.parse(event.data) as KousokuMessage
        if (message.type === "NYUUSHITSU" && message.payload.status === "entered") resolve(message)
      },
      { once: false },
    )
  })
  return ws
}

test("sessions authenticate room ownership and never disclose a raw token", async () => {
  const owner = await register("seito_owner")
  const roomResponse = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie: owner.cookie },
    body: JSON.stringify({ name: "authenticated room", buchouId: "forged" }),
  })
  const room = (await roomResponse.json()) as { id: string; buchouId: string }
  expect(room.buchouId).toBe(owner.id)

  const unauthenticated = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ name: "no session" }),
  })
  expect(unauthenticated.status).toBe(401)

  const beforeAdmission = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie: owner.cookie },
    body: JSON.stringify({
      title: "blocked",
      type: "direct",
      url: "https://media.example/video.mp4",
    }),
  })
  expect(beforeAdmission.status).toBe(403)

  const ws = await enter(room.id, owner.cookie)
  const added = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie: owner.cookie },
    body: JSON.stringify({
      title: "server actor",
      type: "direct",
      url: "https://media.example/video.mp4",
      addedBy: "forged",
    }),
  })
  const enmoku = (await added.json()) as { addedBy: string }
  expect(enmoku.addedBy).toBe(owner.id)

  const echoed = new Promise<KousokuMessage>((resolve) => {
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as KousokuMessage
      if (message.type === "OSHABERI") resolve(message)
    })
  })
  ws.send(
    JSON.stringify({
      type: "OSHABERI",
      ts: Date.now(),
      senderId: "forged",
      payload: { content: "hello" },
    }),
  )
  const message = await echoed
  expect(message.senderId).toBe(owner.id)
  ws.close()
})

test("registration accepts eight-character letter-only and digit-only passwords", async () => {
  for (const [username, password] of [
    ["letters_only", "abcdefgh"],
    ["digits_only", "12345678"],
  ]) {
    const response = await fetch(`${base}/seitoshou/register`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ username, password }),
    })
    expect(response.status).toBe(200)
  }

  const tooShort = await fetch(`${base}/seitoshou/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ username: "too_short", password: "1234567" }),
  })
  expect(tooShort.status).toBe(422)
})

test("state-changing endpoints reject an untrusted Origin", async () => {
  const response = await fetch(`${base}/seitoshou/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    body: JSON.stringify({ username: "wrong_origin", password: "correct-horse-battery" }),
  })
  expect(response.status).toBe(403)
})
