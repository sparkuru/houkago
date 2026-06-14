import { expect, test } from "bun:test"
import { DEFAULT_KENGEN, canDo, clearKengen, getKengen, setKengen } from "../src/lib/kengen"

// 権限 pure-function + state tests (prd role-permissions §2/§4): the host may do
// anything; a guest follows the room switch. State is per-room, in-memory, and
// cleared on empty — no socket needed.

test("host may do any action regardless of the switch", () => {
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

test("default is guest-chat-only (playback/playlist off)", () => {
  expect(DEFAULT_KENGEN).toEqual({ playback: false, chat: true, playlist: false })
})

test("getKengen returns default for an unknown room; setKengen stores; clear resets", () => {
  const room = "rKengen"
  clearKengen(room)
  expect(getKengen(room)).toEqual(DEFAULT_KENGEN)
  setKengen(room, { playback: true, chat: false, playlist: true })
  expect(getKengen(room)).toEqual({ playback: true, chat: false, playlist: true })
  clearKengen(room)
  expect(getKengen(room)).toEqual(DEFAULT_KENGEN)
})

test("getKengen returns a fresh default object (no shared mutation)", () => {
  const room = "rKengenFresh"
  clearKengen(room)
  const a = getKengen(room)
  a.chat = false
  expect(getKengen(room).chat).toBe(true)
})
