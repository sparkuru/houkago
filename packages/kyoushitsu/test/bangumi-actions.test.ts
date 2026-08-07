import { expect, test } from "bun:test"
import {
  canCancelBangumiItem,
  canClearPendingBangumi,
  canDeleteBangumiItem,
  canMoveBangumiItem,
  canPlayBangumiItem,
  isCurrentEnmoku,
} from "../src/lib/bangumi-actions"

test("current enmoku is identified by id", () => {
  expect(isCurrentEnmoku("e1", "e1")).toBe(true)
  expect(isCurrentEnmoku("e1", "e2")).toBe(false)
  expect(isCurrentEnmoku("e1", null)).toBe(false)
})

test("only the room owner can move items and boundary directions are disabled", () => {
  expect(canMoveBangumiItem(true, 1, 3, "up")).toBe(true)
  expect(canMoveBangumiItem(true, 1, 3, "down")).toBe(true)
  expect(canMoveBangumiItem(true, 0, 3, "up")).toBe(false)
  expect(canMoveBangumiItem(true, 2, 3, "down")).toBe(false)
  expect(canMoveBangumiItem(false, 1, 3, "up")).toBe(false)
})

test("only an owner with pending entries can clear the queue", () => {
  expect(canClearPendingBangumi(true, 1)).toBe(true)
  expect(canClearPendingBangumi(true, 0)).toBe(false)
  expect(canClearPendingBangumi(false, 2)).toBe(false)
})

test("playlist permission gates bangumi playback", () => {
  expect(canPlayBangumiItem(true)).toBe(true)
  expect(canPlayBangumiItem(false)).toBe(false)
})

test("playlist permission gates delete and current enmoku cannot be deleted", () => {
  expect(canDeleteBangumiItem(true, "e1", "e2")).toBe(true)
  expect(canDeleteBangumiItem(false, "e1", "e2")).toBe(false)
  expect(canDeleteBangumiItem(true, "e1", "e1")).toBe(false)
})

test("playlist permission gates cancellation and only current enmoku can be cancelled", () => {
  expect(canCancelBangumiItem(true, "e1", "e1")).toBe(true)
  expect(canCancelBangumiItem(false, "e1", "e1")).toBe(false)
  expect(canCancelBangumiItem(true, "e1", "e2")).toBe(false)
  expect(canCancelBangumiItem(true, "e1", null)).toBe(false)
})
