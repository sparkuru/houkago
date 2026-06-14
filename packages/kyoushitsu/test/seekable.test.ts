import { expect, test } from "bun:test"
import { canSeekTo } from "../src/lib/seekable"

// 追平 seek 可否判定（prd Bug2）の純ロジック。中途加入時、hls.js のメディア未読込
// (readyState 0 / duration NaN) では seek が落ちるため不可とし、メディア準備後に
// flush する。これにより A の手動 toggle に依存せず自動追平できる。

test("メディア未読込（readyState 0）は seek 不可 → 控える", () => {
  expect(canSeekTo(15, 0, Number.NaN)).toBe(false)
})

test("duration 未確定（NaN）は seek 不可", () => {
  expect(canSeekTo(15, 1, Number.NaN)).toBe(false)
})

test("duration 0 は seek 不可", () => {
  expect(canSeekTo(15, 1, 0)).toBe(false)
})

test("metadata 揃い duration 範囲内なら seek 可", () => {
  expect(canSeekTo(15, 1, 120)).toBe(true)
})

test("target が duration 超過は seek 不可（誤った権威位置で末尾に飛ばない）", () => {
  expect(canSeekTo(200, 1, 120)).toBe(false)
})

test("末尾わずか超過は slack 内で許容", () => {
  expect(canSeekTo(120.4, 1, 120)).toBe(true)
})

test("0 への seek もメディア準備後なら可", () => {
  expect(canSeekTo(0, 1, 120)).toBe(true)
})
