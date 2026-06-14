import { beforeEach, expect, test } from "bun:test"
import { activeRooms, join, leave, members, shusseki } from "../src/ws/housou"

// 名簿（roster）unit tests: join/leave/members stay consistent with the count and
// the room is pruned (no leak) when the last member leaves. Pure in-memory state,
// no socket needed (quality-guidelines: keep domain logic socket-free).

const room = "rRoster"

beforeEach(() => {
  // drain any residue from prior tests
  for (const m of members(room)) leave(room, m.id)
})

test("join adds members; count and roster agree", () => {
  join(room, "u1", "Yui")
  join(room, "u2", "Mio")
  expect(shusseki(room)).toBe(2)
  expect(members(room)).toEqual([
    { id: "u1", nickname: "Yui" },
    { id: "u2", nickname: "Mio" },
  ])
})

test("leave removes the member; count and roster stay consistent", () => {
  join(room, "u1", "Yui")
  join(room, "u2", "Mio")
  leave(room, "u1")
  expect(shusseki(room)).toBe(1)
  expect(members(room)).toEqual([{ id: "u2", nickname: "Mio" }])
})

test("last leave prunes the room (no leak)", () => {
  join(room, "u1", "Yui")
  leave(room, "u1")
  expect(shusseki(room)).toBe(0)
  expect(members(room)).toEqual([])
  expect(activeRooms()).not.toContain(room)
})

test("leave on absent member is a no-op", () => {
  join(room, "u1", "Yui")
  leave(room, "ghost")
  expect(shusseki(room)).toBe(1)
})
