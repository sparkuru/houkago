import { expect, test } from "bun:test"
import {
  canDeleteBangumiItem,
  canPlayBangumiItem,
  isCurrentEnmoku,
} from "../src/lib/bangumi-actions"

test("current enmoku is identified by id", () => {
  expect(isCurrentEnmoku("e1", "e1")).toBe(true)
  expect(isCurrentEnmoku("e1", "e2")).toBe(false)
  expect(isCurrentEnmoku("e1", null)).toBe(false)
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
