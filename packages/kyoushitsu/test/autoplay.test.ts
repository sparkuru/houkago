import { expect, test } from "bun:test"
import { shouldRetryMuted, showUnmuteOverlay } from "../src/lib/autoplay"

// autoplay ADR の純ロジック境界テスト。DOM/player 不要。

test("非ミュートで play 拒否 → ミュート再試行する", () => {
  expect(shouldRetryMuted(false)).toBe(true)
})

test("既にミュート済みなら再試行しない（ミュート以外の真因）", () => {
  expect(shouldRetryMuted(true)).toBe(false)
})

test("遮罩は follower かつ art がミュート中のときだけ出す", () => {
  expect(showUnmuteOverlay(true, true)).toBe(true)
})

test("房主(非 follower)では遮罩を出さない", () => {
  expect(showUnmuteOverlay(false, true)).toBe(false)
})

test("解除済み(art 非ミュート)なら遮罩を出さない", () => {
  expect(showUnmuteOverlay(true, false)).toBe(false)
})
