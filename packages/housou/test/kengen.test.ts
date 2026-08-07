import { expect, test } from "bun:test"
import { db } from "../src/db/client"
import { insertBushitsuWithBuchou } from "../src/db/queries/bushitsu"
import { insertSeito } from "../src/db/queries/seito"
import { DEFAULT_KENGEN, canDo, clearKengen, getKengen, setKengen } from "../src/lib/kengen"

function createRoom(): string {
  const id = crypto.randomUUID()
  const ownerId = `owner-${id}`
  insertSeito({
    id: ownerId,
    username: ownerId,
    usernameNorm: ownerId,
    passwordHash: "hash",
    createdAt: Date.now(),
  })
  insertBushitsuWithBuchou({
    id,
    name: "Kengen test room",
    buchouId: ownerId,
    createdAt: Date.now(),
  })
  return id
}

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

test("getKengen reads its persisted policy after a cache clear", () => {
  const room = createRoom()
  clearKengen(room)
  expect(getKengen(room)).toEqual(DEFAULT_KENGEN)
  setKengen(room, { playback: true, chat: false, playlist: true })
  expect(getKengen(room)).toEqual({ playback: true, chat: false, playlist: true })
  clearKengen(room)
  expect(getKengen(room)).toEqual({ playback: true, chat: false, playlist: true })
})

test("missing rooms safely use fresh defaults", () => {
  expect(getKengen("missing-room")).toEqual(DEFAULT_KENGEN)
})

test("malformed stored policies safely use fresh defaults", () => {
  const room = createRoom()
  for (const kengenJson of ["{", '{"playback":false,"chat":true,"playlist":false,"queue":true}']) {
    db.query("UPDATE bushitsu SET kengen_json = $kengenJson WHERE id = $id").run({
      $id: room,
      $kengenJson: kengenJson,
    })
    clearKengen(room)
    expect(getKengen(room)).toEqual(DEFAULT_KENGEN)
  }
})

test("getKengen returns a fresh snapshot rather than a mutable cache reference", () => {
  const room = createRoom()
  clearKengen(room)
  const a = getKengen(room)
  a.chat = false
  expect(getKengen(room).chat).toBe(true)
})
