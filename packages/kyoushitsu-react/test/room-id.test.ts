import { expect, test } from "bun:test"
import { roomIdFromInput, safeRoomId } from "../src/lib/room-id"
test("normalizes invite and validates a decoded room segment", () => {
  const id = roomIdFromInput("https://example.test/bushitsu/%E6%95%99%E5%AE%A4?secret=x#hash")
  expect(id).toBe("教室")
  expect(`/bushitsu/${encodeURIComponent(id)}`).toBe("/bushitsu/%E6%95%99%E5%AE%A4")
  expect(safeRoomId("non-uuid-room")).toBe("non-uuid-room")
})
test("rejects unsafe route segments and malformed decoding", () => {
  for (const id of ["", ".", "..", "%", "%2F", "%252F", "a\\b", "a\u0000b", " a"])
    expect(() => safeRoomId(id)).toThrow()
})
