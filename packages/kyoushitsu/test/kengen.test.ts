import { expect, test } from "bun:test"
import { canDo } from "../src/lib/kengen"

// 権限 pure-function test (client side, prd §3): mirrors the server gate so the
// store's derived canControl/canChat/canPlaylist match enforcement exactly.

test("host may do any action", () => {
  const off = { playback: false, chat: false, playlist: false }
  expect(canDo(true, off, "playback")).toBe(true)
  expect(canDo(true, off, "chat")).toBe(true)
  expect(canDo(true, off, "playlist")).toBe(true)
})

test("guest follows the per-action switch", () => {
  const k = { playback: false, chat: true, playlist: false }
  expect(canDo(false, k, "playback")).toBe(false)
  expect(canDo(false, k, "chat")).toBe(true)
  expect(canDo(false, k, "playlist")).toBe(false)
})
