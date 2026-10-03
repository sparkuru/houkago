import { expect, test } from "bun:test"
import {
  DEFAULT_ROOM_FLOATING_POSITION,
  ROOM_FLOATING_POSITION_STORAGE_KEY,
  clampRoomFloatingPosition,
  loadRoomFloatingPosition,
  roomFloatingPositionFromPixels,
  roomFloatingPositionToPixels,
  saveRoomFloatingPosition,
} from "../src/features/room/room-floating-position"

const bounds = {
  viewportWidth: 400,
  viewportHeight: 300,
  elementWidth: 52,
  elementHeight: 52,
  safeArea: { top: 16, right: 16, bottom: 16, left: 16 },
}

test("uses a safe lower-right default and converts it to bounded pixels", () => {
  expect(DEFAULT_ROOM_FLOATING_POSITION).toEqual({ x: 1, y: 1 })
  expect(roomFloatingPositionToPixels(DEFAULT_ROOM_FLOATING_POSITION, bounds)).toEqual({
    left: 332,
    top: 232,
  })
})

test("clamps normalized and pixel positions to the safe viewport rectangle", () => {
  expect(clampRoomFloatingPosition({ x: -1, y: 2 }, bounds)).toEqual({ x: 0, y: 1 })
  expect(roomFloatingPositionFromPixels({ left: -100, top: 999 }, bounds)).toEqual({ x: 0, y: 1 })
  expect(roomFloatingPositionFromPixels({ left: 174, top: 124 }, bounds)).toEqual({
    x: 0.5,
    y: 0.5,
  })
})

test("invalid storage is ignored and valid coordinates round-trip", () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }

  values.set(ROOM_FLOATING_POSITION_STORAGE_KEY, "not-json")
  expect(loadRoomFloatingPosition(storage)).toEqual(DEFAULT_ROOM_FLOATING_POSITION)

  saveRoomFloatingPosition({ x: 1.5, y: -1 }, storage)
  expect(values.get(ROOM_FLOATING_POSITION_STORAGE_KEY)).toBe(
    JSON.stringify({ version: 1, x: 1, y: 0 }),
  )
  expect(loadRoomFloatingPosition(storage)).toEqual({ x: 1, y: 0 })
})

test("normalized coordinates remain reachable after a viewport resize", () => {
  const position = { x: 0.75, y: 0.25 }
  const pixels = roomFloatingPositionToPixels(position, bounds)
  const resized = { ...bounds, viewportWidth: 240, viewportHeight: 180 }
  const restored = roomFloatingPositionToPixels(position, resized)
  expect(roomFloatingPositionFromPixels(pixels, bounds)).toEqual(position)
  expect(restored).toEqual({ left: 133, top: 40 })
  expect(restored.left + resized.elementWidth).toBeLessThanOrEqual(resized.viewportWidth - 16)
  expect(restored.top + resized.elementHeight).toBeLessThanOrEqual(resized.viewportHeight - 16)
})

test("keeps larger device safe-area insets around the launcher", () => {
  expect(
    roomFloatingPositionToPixels(DEFAULT_ROOM_FLOATING_POSITION, {
      ...bounds,
      safeArea: { top: 44, right: 32, bottom: 34, left: 20 },
    }),
  ).toEqual({ left: 316, top: 214 })
})
