import { beforeEach, expect, test } from "bun:test"
import { activeRooms, join, leave, members, shusseki } from "../src/ws/housou"

// 名簿（roster）unit tests: join/leave/members stay consistent with the count and
// the room is pruned (no leak) when the last member leaves. Pure in-memory state,
// no socket needed (quality-guidelines: keep domain logic socket-free).

const room = "rRoster"
// u1 is the 部長 in these cases so members() can label yakuwari (id===buchouId).
const buchou = "u1"

beforeEach(() => {
  // drain any residue from prior tests
  for (const m of members(room, buchou)) leave(room, m.id)
})

test("join adds members; count and roster agree; yakuwari labels host vs guest", () => {
  join(room, "u1", "Yui")
  join(room, "u2", "Mio")
  expect(shusseki(room)).toBe(2)
  expect(members(room, buchou)).toEqual([
    { id: "u1", nickname: "Yui", yakuwari: "buchou" },
    { id: "u2", nickname: "Mio", yakuwari: "kengaku" },
  ])
})

test("leave removes the member; count and roster stay consistent", () => {
  join(room, "u1", "Yui")
  join(room, "u2", "Mio")
  leave(room, "u1")
  expect(shusseki(room)).toBe(1)
  expect(members(room, buchou)).toEqual([{ id: "u2", nickname: "Mio", yakuwari: "kengaku" }])
})

test("last leave prunes the room (no leak)", () => {
  join(room, "u1", "Yui")
  leave(room, "u1")
  expect(shusseki(room)).toBe(0)
  expect(members(room, buchou)).toEqual([])
  expect(activeRooms()).not.toContain(room)
})

test("leave on absent member is a no-op", () => {
  join(room, "u1", "Yui")
  leave(room, "ghost")
  expect(shusseki(room)).toBe(1)
})
