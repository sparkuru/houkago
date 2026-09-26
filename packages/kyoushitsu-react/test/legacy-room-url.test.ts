import { expect, test } from "bun:test"
import {
  createRoomHandoff,
  legacyRoomUrl,
  roomIdFromInput,
  safeRoomId,
} from "../src/lib/legacy-room-url"
test("normalizes invite, encodes safe segment once, drops search/hash", () => {
  const id = roomIdFromInput("https://example.test/bushitsu/%E6%95%99%E5%AE%A4?secret=x#hash")
  expect(legacyRoomUrl(id, "http://127.0.0.1:5174/", undefined, true)).toBe(
    "http://127.0.0.1:5173/bushitsu/%E6%95%99%E5%AE%A4",
  )
  expect(safeRoomId("non-uuid-room")).toBe("non-uuid-room")
})
test("rejects unsafe route segments and malformed decoding", () => {
  for (const id of ["", ".", "..", "%", "%2F", "%252F", "a\\b", "a\u0000b", " a"])
    expect(() => safeRoomId(id)).toThrow()
})
test("rejects missing/self/arbitrary/mismatched legacy targets", () => {
  for (const target of [
    undefined,
    "http://127.0.0.1:5174",
    "https://127.0.0.1:5173",
    "http://localhost:5173",
    "http://u:p@127.0.0.1:5173",
    "http://127.0.0.1:5173/path",
    "http://127.0.0.1:5173/?x=1",
    "javascript:alert(1)",
  ])
    expect(() => legacyRoomUrl("r", "http://127.0.0.1:5174", target)).toThrow()
})
test("import/preload is inert; handoff is idempotent", () => {
  const targets: string[] = []
  const handoff = createRoomHandoff((target) => targets.push(target))
  expect(targets).toEqual([])
  handoff("one")
  handoff("one")
  expect(targets).toEqual(["one"])
})
