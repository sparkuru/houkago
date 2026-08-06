import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage, NyuushitsuMode } from "houkago-kousoku"
import { app } from "../src/index"
import { clearKengen } from "../src/lib/kengen"
import { clearNyuushitsu } from "../src/lib/nyuushitsu"
import {
  type AuthenticatedPeer,
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
  void app.server?.stop(true)
})

function closed(ws: WebSocket): Promise<CloseEvent> {
  return new Promise((resolve) => ws.addEventListener("close", resolve, { once: true }))
}

function setMode(peer: AuthenticatedPeer, mode: NyuushitsuMode): void {
  peer.ws.send(
    JSON.stringify({
      type: "NYUUSHITSU_SETTEI",
      ts: Date.now(),
      senderId: "ignored-by-server",
      payload: { mode },
    } satisfies KousokuMessage),
  )
}

async function remove(roomId: string, targetId: string, actor?: string): Promise<Response> {
  const headers: Record<string, string> = { origin }
  if (actor) headers.cookie = await sessionFor(base, actor)
  return fetch(`${base}/bushitsu/${roomId}/meibo/${targetId}`, { method: "DELETE", headers })
}

function durableMemberId(message: KousokuMessage, suffix: string): string {
  if (message.type !== "MEIBO") throw new Error("missing durable roster")
  const id = message.payload.members.find((member) => member.username.endsWith(suffix))?.id
  if (!id) throw new Error(`missing durable member ${suffix}`)
  return id
}

async function closePeers(...peers: AuthenticatedPeer[]): Promise<void> {
  const closedPeers = peers.map((peer) => closed(peer.ws))
  for (const peer of peers) peer.ws.close()
  await Promise.all(closedPeers)
}

test("rejection cases leave memberships and sockets unchanged", async () => {
  const room = await makeAuthenticatedRoom(base, "hardening-owner")
  const owner = await openAuthenticatedPeer(base, baseWs, room.id, "hardening-owner")
  const ownerRoster = await owner.nextMatch((message) => message.type === "MEIBO")
  const ownerId = durableMemberId(ownerRoster, "hardening_owner")
  const guest = await openAuthenticatedPeer(base, baseWs, room.id, "hardening-guest")
  const rosterWithGuest = await owner.nextMatch(
    (message) => message.type === "MEIBO" && message.payload.members.length === 2,
  )
  const guestId = durableMemberId(rosterWithGuest, "hardening_guest")
  const otherRoom = await makeAuthenticatedRoom(base, "hardening-other-owner")
  const otherOwner = await openAuthenticatedPeer(
    base,
    baseWs,
    otherRoom.id,
    "hardening-other-owner",
  )
  await otherOwner.nextMatch((message) => message.type === "MEIBO")
  const otherGuest = await openAuthenticatedPeer(
    base,
    baseWs,
    otherRoom.id,
    "hardening-other-guest",
  )
  const otherRoster = await otherOwner.nextMatch(
    (message) => message.type === "MEIBO" && message.payload.members.length === 2,
  )
  const otherGuestId = durableMemberId(otherRoster, "hardening_other_guest")

  expect((await remove(room.id, guestId)).status).toBe(401)
  expect((await remove(room.id, ownerId, "hardening-owner")).status).toBe(403)
  expect((await remove(room.id, guestId, "hardening-guest")).status).toBe(403)
  expect((await remove(room.id, guestId, "hardening-other-owner")).status).toBe(403)
  expect((await remove(room.id, otherGuestId, "hardening-owner")).status).toBe(404)
  expect((await remove(room.id, "missing-member", "hardening-owner")).status).toBe(404)

  expect(guest.ws.readyState).toBe(WebSocket.OPEN)
  expect(otherGuest.ws.readyState).toBe(WebSocket.OPEN)
  const ownerAgain = await openAuthenticatedPeer(base, baseWs, room.id, "hardening-owner")
  const unchanged = await ownerAgain.nextMatch((message) => message.type === "MEIBO")
  if (unchanged.type !== "MEIBO") throw new Error("missing unchanged roster")
  expect(unchanged.payload.members.map((member) => member.id).sort()).toEqual(
    [ownerId, guestId].sort(),
  )

  await closePeers(owner, ownerAgain, guest, otherOwner, otherGuest)
})

test("revocation closes every target tab while preserving other rooms", async () => {
  const room = await makeAuthenticatedRoom(base, "tabs-owner")
  const owner = await openAuthenticatedPeer(base, baseWs, room.id, "tabs-owner")
  await owner.nextMatch((message) => message.type === "MEIBO")
  const targetFirst = await openAuthenticatedPeer(base, baseWs, room.id, "tabs-member")
  const roster = await owner.nextMatch(
    (message) => message.type === "MEIBO" && message.payload.members.length === 2,
  )
  const targetId = durableMemberId(roster, "tabs_member")
  const targetSecond = await openAuthenticatedPeer(base, baseWs, room.id, "tabs-member")
  const otherRoom = await makeAuthenticatedRoom(base, "tabs-other-owner")
  const otherOwner = await openAuthenticatedPeer(base, baseWs, otherRoom.id, "tabs-other-owner")
  await otherOwner.nextMatch((message) => message.type === "MEIBO")
  const otherRoomTab = await openAuthenticatedPeer(base, baseWs, otherRoom.id, "tabs-member")

  const revokedFirst = targetFirst.nextMatch(
    (message) => message.type === "NYUUSHITSU" && message.payload.status === "revoked",
  )
  const revokedSecond = targetSecond.nextMatch(
    (message) => message.type === "NYUUSHITSU" && message.payload.status === "revoked",
  )
  const closedFirst = closed(targetFirst.ws)
  const closedSecond = closed(targetSecond.ws)
  const presence = owner.nextMatch(
    (message) => message.type === "SHUSSEKI" && message.payload.n === 1,
  )
  const reducedRoster = owner.nextMatch(
    (message) => message.type === "MEIBO" && message.payload.members.length === 1,
  )

  expect((await remove(room.id, targetId, "tabs-owner")).status).toBe(200)
  expect((await revokedFirst).type).toBe("NYUUSHITSU")
  expect((await revokedSecond).type).toBe("NYUUSHITSU")
  expect((await closedFirst).code).toBe(1008)
  expect((await closedSecond).code).toBe(1008)
  expect(otherRoomTab.ws.readyState).toBe(WebSocket.OPEN)
  const refreshedPresence = await presence
  const refreshedRoster = await reducedRoster
  if (refreshedPresence.type !== "SHUSSEKI" || refreshedRoster.type !== "MEIBO") {
    throw new Error("missing refreshed snapshots")
  }
  expect(refreshedPresence.payload.members).toHaveLength(1)
  expect(refreshedRoster.payload.members).toHaveLength(1)

  await closePeers(owner, otherOwner, otherRoomTab)
})

test("removed members re-enter only through the current admission mode and survive transient reset", async () => {
  const room = await makeAuthenticatedRoom(base, "reentry-owner")
  const owner = await openAuthenticatedPeer(base, baseWs, room.id, "reentry-owner")
  await owner.nextMatch((message) => message.type === "MEIBO")
  const member = await openAuthenticatedPeer(base, baseWs, room.id, "reentry-member")
  const roster = await owner.nextMatch(
    (message) => message.type === "MEIBO" && message.payload.members.length === 2,
  )
  const reentryMemberId = durableMemberId(roster, "reentry_member")

  setMode(owner, "closed")
  await owner.nextMatch(
    (message) => message.type === "NYUUSHITSU" && message.payload.mode === "closed",
  )
  const revoked = member.nextMatch(
    (message) => message.type === "NYUUSHITSU" && message.payload.status === "revoked",
  )
  const memberClosed = closed(member.ws)
  expect((await remove(room.id, reentryMemberId, "reentry-owner")).status).toBe(200)
  await revoked
  expect((await memberClosed).code).toBe(1008)

  const denied = await openAuthenticatedPeer(base, baseWs, room.id, "reentry-member")
  const deniedStatus = await denied.nextMatch((message) => message.type === "NYUUSHITSU")
  if (deniedStatus.type !== "NYUUSHITSU") throw new Error("missing denied admission")
  expect(deniedStatus.payload.status).toBe("closed")
  denied.ws.close()

  setMode(owner, "open")
  await owner.nextMatch(
    (message) => message.type === "NYUUSHITSU" && message.payload.mode === "open",
  )
  const reentered = await openAuthenticatedPeer(base, baseWs, room.id, "reentry-member")
  const entered = await reentered.nextMatch(
    (message) => message.type === "NYUUSHITSU" && message.payload.status === "entered",
  )
  expect(entered.type).toBe("NYUUSHITSU")
  await closePeers(owner, reentered)

  clearNyuushitsu(room.id)
  clearKengen(room.id)
  const recovered = await openAuthenticatedPeer(base, baseWs, room.id, "reentry-member")
  const recoveredAdmission = await recovered.nextMatch(
    (message) => message.type === "NYUUSHITSU" && message.payload.status === "entered",
  )
  expect(recoveredAdmission.type).toBe("NYUUSHITSU")
  const ownerAgain = await openAuthenticatedPeer(base, baseWs, room.id, "reentry-owner")
  const recoveredRoster = await ownerAgain.nextMatch((message) => message.type === "MEIBO")
  if (recoveredRoster.type !== "MEIBO") throw new Error("missing recovered roster")
  expect(recoveredRoster.payload.members).toHaveLength(2)
  await closePeers(recovered, ownerAgain)
})
