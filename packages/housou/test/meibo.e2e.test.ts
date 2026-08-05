import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"
import { makeAuthenticatedRoom, openAuthenticatedSocket, origin, sessionFor } from "./auth-fixture"

let base: string
let baseWs: string

beforeAll(() => {
  app.listen(0)
  base = `http://localhost:${app.server?.port}`
  baseWs = `ws://localhost:${app.server?.port}/ws`
})

afterAll(() => {
  void app.server?.stop(true)
})

function nextMatch(
  ws: WebSocket,
  pred: (message: KousokuMessage) => boolean,
): Promise<KousokuMessage> {
  return new Promise((resolve) => {
    ws.addEventListener(
      "message",
      (event) => {
        const message = JSON.parse(event.data) as KousokuMessage
        if (pred(message)) resolve(message)
      },
      { once: false },
    )
  })
}

function closed(ws: WebSocket): Promise<CloseEvent> {
  return new Promise((resolve) => ws.addEventListener("close", resolve, { once: true }))
}

test("durable roster stays owner-only and owner revocation refreshes every snapshot", async () => {
  const room = await makeAuthenticatedRoom(base, "meibo-owner")
  const owner = await openAuthenticatedSocket(base, baseWs, room.id, "meibo-owner")
  const initial = await nextMatch(owner, (message) => message.type === "MEIBO")
  expect(initial.type).toBe("MEIBO")
  if (initial.type !== "MEIBO") throw new Error("missing initial roster")
  const ownerId = initial.payload.members.find((member) => member.yakuwari === "buchou")?.id
  expect(ownerId).toBeDefined()

  const roster = nextMatch(
    owner,
    (message) => message.type === "MEIBO" && message.payload.members.length === 2,
  )
  const guest = await openAuthenticatedSocket(base, baseWs, room.id, "meibo-guest")
  const memberSnapshot = await roster
  if (memberSnapshot.type !== "MEIBO") throw new Error("missing roster")
  const guestId = memberSnapshot.payload.members.find((member) =>
    member.username.endsWith("meibo_guest"),
  )?.id
  expect(guestId).toBeDefined()
  if (!guestId || !ownerId) throw new Error("missing member id")

  let guestSawMeibo = false
  guest.addEventListener("message", (event) => {
    if ((JSON.parse(event.data) as KousokuMessage).type === "MEIBO") guestSawMeibo = true
  })
  const otherGuest = await openAuthenticatedSocket(base, baseWs, room.id, "meibo-other")

  const guestCookie = await sessionFor(base, "meibo-guest")
  const rejected = await fetch(`${base}/bushitsu/${room.id}/meibo/${ownerId}`, {
    method: "DELETE",
    headers: { origin, cookie: guestCookie },
  })
  expect(rejected.status).toBe(403)
  expect(guestSawMeibo).toBeFalse()

  const revoked = nextMatch(
    guest,
    (message) => message.type === "NYUUSHITSU" && message.payload.status === "revoked",
  )
  const guestClosed = closed(guest)
  const refreshedPresence = nextMatch(
    owner,
    (message) => message.type === "SHUSSEKI" && message.payload.n === 2,
  )
  const refreshedRoster = nextMatch(
    owner,
    (message) => message.type === "MEIBO" && message.payload.members.length === 2,
  )
  const cookie = await sessionFor(base, "meibo-owner")
  const response = await fetch(`${base}/bushitsu/${room.id}/meibo/${guestId}`, {
    method: "DELETE",
    headers: { origin, cookie },
  })
  expect(response.status).toBe(200)
  expect((await revoked).type).toBe("NYUUSHITSU")
  expect((await guestClosed).code).toBe(1008)
  expect(guestSawMeibo).toBeFalse()
  const presence = await refreshedPresence
  const finalRoster = await refreshedRoster
  if (presence.type !== "SHUSSEKI" || finalRoster.type !== "MEIBO") {
    throw new Error("missing refreshed snapshots")
  }
  expect(presence.payload.members.some((member) => member.id === guestId)).toBeFalse()
  expect(finalRoster.payload.members.some((member) => member.id === guestId)).toBeFalse()
  const ownerClosed = closed(owner)
  const otherGuestClosed = closed(otherGuest)
  owner.close()
  otherGuest.close()
  await ownerClosed
  await otherGuestClosed
})
