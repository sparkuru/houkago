import { expect, test } from "bun:test"
import {
  DEFAULT_ROOM_FLOATING_POSITION,
  ROOM_FLOATING_POSITION_STORAGE_KEY,
  clampRoomFloatingPosition,
  findClearRoomFloatingPosition,
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

test("populated desktop queue moves the launcher to the nearest clear point", () => {
  const desktop = {
    ...bounds,
    viewportWidth: 1280,
    viewportHeight: 900,
    safeArea: { right: 355.1875 },
  }
  const queueButton = { left: 843.8125, top: 857.03125, width: 64, height: 44 }
  const resolved = findClearRoomFloatingPosition(DEFAULT_ROOM_FLOATING_POSITION, desktop, [
    queueButton,
  ])
  expect(resolved).toEqual({ left: 872.8125, top: 797.03125 })
  expect((resolved?.top ?? 0) + desktop.elementHeight + 8).toBe(queueButton.top)
  expect(
    findClearRoomFloatingPosition(DEFAULT_ROOM_FLOATING_POSITION, desktop, [queueButton]),
  ).toEqual(resolved)
})

test("phone cinema protects the full composer after a message grows its layout", () => {
  const phone = { ...bounds, viewportWidth: 375, viewportHeight: 812 }
  const preferred = { x: 1, y: 1 }
  const player = { left: 16, top: 80, width: 343, height: 300 }
  const composer = { left: 25, top: 675.15625, width: 325, height: 96 }
  const resolved = findClearRoomFloatingPosition(preferred, phone, [player, composer])
  expect(resolved).toEqual({ left: 307, top: 615.15625 })
  expect((resolved?.top ?? 0) + phone.elementHeight + 8).toBe(composer.top)
  expect(preferred).toEqual({ x: 1, y: 1 })
  expect(findClearRoomFloatingPosition(preferred, phone, [player])).toEqual({
    left: 307,
    top: 744,
  })
})

test("clearing several obstacles can require movement on both axes", () => {
  const obstacles = [
    { left: 16, top: 220, width: 368, height: 80 },
    { left: 260, top: 16, width: 124, height: 204 },
  ]
  expect(findClearRoomFloatingPosition(DEFAULT_ROOM_FLOATING_POSITION, bounds, obstacles)).toEqual({
    left: 200,
    top: 160,
  })
})

test("a fully occupied safe viewport has no clear candidate", () => {
  expect(
    findClearRoomFloatingPosition(DEFAULT_ROOM_FLOATING_POSITION, bounds, [
      { left: 0, top: 0, width: 400, height: 300 },
    ]),
  ).toBeNull()
})

test("clear dragged preferences and offscreen or hidden obstacles leave placement unchanged", () => {
  const preferred = { x: 0.25, y: 0.1 }
  expect(
    findClearRoomFloatingPosition(preferred, bounds, [
      { left: 0, top: -200, width: 400, height: 100 },
      { left: 0, top: 0, width: 0, height: 0 },
    ]),
  ).toEqual(roomFloatingPositionToPixels(preferred, bounds))
})
