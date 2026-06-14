import { expect, test } from "bun:test"
import { CONTROLS_HIDDEN, CONTROLS_SHOWN, danmakuTrackBottom } from "../src/lib/danmaku-track"

// 弾幕気泡トラック底辺の純関数テスト（prd #3 / Bug1）：コントロール条の显隐で上下する。
// player/DOM 不要（state-management: pure view ロジックは framework-free）。

test("条が可视のときは条の上に出るよう抬げる値（clamp で大屏対応）", () => {
  expect(danmakuTrackBottom(true)).toBe(CONTROLS_SHOWN)
})

test("条が隐れたときは底に寄せる小さい値", () => {
  expect(danmakuTrackBottom(false)).toBe(CONTROLS_HIDDEN)
})

test("可视時と隐れ時で異なる位置を返す", () => {
  expect(danmakuTrackBottom(true)).not.toBe(danmakuTrackBottom(false))
})
