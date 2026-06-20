import { beforeEach, expect, test } from "bun:test"
import {
  DEFAULT_NYUUSHITSU_MODE,
  addPendingNyuushitsu,
  clearNyuushitsu,
  getNyuushitsuMode,
  getNyuushitsuPassword,
  pendingNyuushitsuCount,
  pendingNyuushitsuRequests,
  removePendingNyuushitsuConnection,
  setNyuushitsuMode,
  takePendingNyuushitsu,
} from "../src/lib/nyuushitsu"

const room = "rNyuushitsu"

beforeEach(() => {
  clearNyuushitsu(room)
})

test("default mode is open; set and clear reset the room mode", () => {
  expect(DEFAULT_NYUUSHITSU_MODE).toBe("open")
  expect(getNyuushitsuMode(room)).toBe("open")
  setNyuushitsuMode(room, "approval")
  expect(getNyuushitsuMode(room)).toBe("approval")
  clearNyuushitsu(room)
  expect(getNyuushitsuMode(room)).toBe("open")
})

test("password mode stores a room password and clear removes it", () => {
  setNyuushitsuMode(room, "password", "tea-time")
  expect(getNyuushitsuMode(room)).toBe("password")
  expect(getNyuushitsuPassword(room)).toBe("tea-time")
  setNyuushitsuMode(room, "open")
  expect(getNyuushitsuPassword(room)).toBe("")
})

test("pending requests are grouped by senderId and expose public request shape", () => {
  addPendingNyuushitsu(room, "conn-a", "guest", "Mio", 100)
  addPendingNyuushitsu(room, "conn-b", "guest", "Mio2", 200)

  expect(pendingNyuushitsuCount(room)).toBe(1)
  expect(pendingNyuushitsuRequests(room)).toEqual([
    { senderId: "guest", nickname: "Mio2", requestedAt: 100 },
  ])
  expect(takePendingNyuushitsu(room, "guest")).toEqual(["conn-a", "conn-b"])
  expect(pendingNyuushitsuCount(room)).toBe(0)
})

test("removing the last pending connection prunes the pending request", () => {
  addPendingNyuushitsu(room, "conn-a", "guest", "Mio", 100)
  addPendingNyuushitsu(room, "conn-b", "guest", "Mio", 100)

  removePendingNyuushitsuConnection(room, "guest", "conn-a")
  expect(pendingNyuushitsuCount(room)).toBe(1)
  removePendingNyuushitsuConnection(room, "guest", "conn-b")
  expect(pendingNyuushitsuCount(room)).toBe(0)
  expect(pendingNyuushitsuRequests(room)).toEqual([])
})
