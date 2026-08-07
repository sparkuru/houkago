import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"
import {
  addAuthenticatedEnmoku,
  makeAuthenticatedRoom,
  openAuthenticatedPeer,
  origin,
  sessionFor,
} from "./auth-fixture"

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

async function requestAs(alias: string, path: string, init: RequestInit): Promise<Response> {
  const cookie = await sessionFor(base, alias)
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...init.headers, origin, cookie },
  })
}

function bangumiIds(message: KousokuMessage): string[] | null {
  return message.type === "BANGUMI" ? message.payload.enmoku.map((enmoku) => enmoku.id) : null
}

test("only an admitted owner can move, and a successful move broadcasts one full snapshot", async () => {
  const room = await makeAuthenticatedRoom(base, "queue-owner")
  const owner = await openAuthenticatedPeer(base, baseWs, room.id, "queue-owner")
  const first = await addAuthenticatedEnmoku(base, room.id, "queue-owner")
  const second = await addAuthenticatedEnmoku(base, room.id, "queue-owner")
  const third = await addAuthenticatedEnmoku(base, room.id, "queue-owner")

  const notAdmitted = await requestAs(
    "queue-outsider",
    `/bushitsu/${room.id}/bangumi/${second.id}/move`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction: "up" }),
    },
  )
  expect(notAdmitted.status).toBe(403)

  const unauthenticated = await fetch(`${base}/bushitsu/${room.id}/bangumi/${second.id}/move`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ direction: "up" }),
  })
  expect(unauthenticated.status).toBe(401)

  const member = await openAuthenticatedPeer(base, baseWs, room.id, "queue-member")
  const nonOwner = await requestAs(
    "queue-member",
    `/bushitsu/${room.id}/bangumi/${second.id}/move`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction: "up" }),
    },
  )
  expect(nonOwner.status).toBe(403)

  const expectedMove = [second.id, first.id, third.id]
  const ownerSnapshot = owner.nextMatch(
    (message) => bangumiIds(message)?.join(",") === [second.id, first.id, third.id].join(","),
  )
  const memberSnapshot = member.nextMatch(
    (message) => bangumiIds(message)?.join(",") === expectedMove.join(","),
  )
  const response = await requestAs(
    "queue-owner",
    `/bushitsu/${room.id}/bangumi/${second.id}/move`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction: "up" }),
    },
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
  expect(bangumiIds(await ownerSnapshot)).toEqual(expectedMove)
  expect(bangumiIds(await memberSnapshot)).toEqual(expectedMove)

  const ownerBoundarySnapshot = owner.nextMatch(
    (message) => bangumiIds(message)?.join(",") === expectedMove.join(","),
  )
  const memberBoundarySnapshot = member.nextMatch(
    (message) => bangumiIds(message)?.join(",") === expectedMove.join(","),
  )
  const boundaryResponse = await requestAs(
    "queue-owner",
    `/bushitsu/${room.id}/bangumi/${second.id}/move`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction: "up" }),
    },
  )
  expect(boundaryResponse.status).toBe(200)
  expect(bangumiIds(await ownerBoundarySnapshot)).toEqual(expectedMove)
  expect(bangumiIds(await memberBoundarySnapshot)).toEqual(expectedMove)

  owner.ws.close()
  member.ws.close()
})

test("clear pending preserves the authoritative current item and playback state", async () => {
  const room = await makeAuthenticatedRoom(base, "clear-owner")
  const owner = await openAuthenticatedPeer(base, baseWs, room.id, "clear-owner")
  const first = await addAuthenticatedEnmoku(base, room.id, "clear-owner")
  const current = await addAuthenticatedEnmoku(base, room.id, "clear-owner")
  const third = await addAuthenticatedEnmoku(base, room.id, "clear-owner")
  const unauthenticated = await fetch(`${base}/bushitsu/${room.id}/bangumi/pending`, {
    method: "DELETE",
    headers: { origin },
  })
  expect(unauthenticated.status).toBe(401)

  const member = await openAuthenticatedPeer(base, baseWs, room.id, "clear-member")
  const nonOwner = await requestAs("clear-member", `/bushitsu/${room.id}/bangumi/pending`, {
    method: "DELETE",
  })
  expect(nonOwner.status).toBe(403)

  const jouei = owner.nextMatch(
    (message) => message.type === "JOUEI" && message.payload.enmokuId === current.id,
  )
  owner.ws.send(
    JSON.stringify({
      type: "JOUEI",
      ts: Date.now(),
      senderId: "ignored-by-server",
      payload: { enmokuId: current.id },
    } satisfies KousokuMessage),
  )
  await jouei

  const ownerSnapshot = owner.nextMatch((message) => bangumiIds(message)?.join(",") === current.id)
  const memberSnapshot = member.nextMatch(
    (message) => bangumiIds(message)?.join(",") === current.id,
  )
  const response = await requestAs("clear-owner", `/bushitsu/${room.id}/bangumi/pending`, {
    method: "DELETE",
  })
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true, removed: 2 })
  expect(bangumiIds(await ownerSnapshot)).toEqual([current.id])
  expect(bangumiIds(await memberSnapshot)).toEqual([current.id])

  const genjou = owner.nextMatch((message) => message.type === "GENJOU")
  owner.ws.send(
    JSON.stringify({
      type: "OIKAKE",
      ts: Date.now(),
      senderId: "ignored-by-server",
      payload: {},
    } satisfies KousokuMessage),
  )
  const state = await genjou
  expect(state.type).toBe("GENJOU")
  if (state.type === "GENJOU") {
    expect(state.payload.enmokuId).toBe(current.id)
    expect(state.payload.shinkou).toEqual({ isPlaying: false, currentTime: 0, playbackRate: 1 })
  }

  // Keep the test's intent explicit: both non-current records were removed.
  expect([first.id, third.id]).not.toContain(current.id)
  owner.ws.close()
  member.ws.close()
})
