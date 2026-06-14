import { expect, test } from "bun:test"
import { CONTROLS_HIDDEN_PX, CONTROLS_SHOWN_PX, danmakuTrackBottom } from "../src/lib/danmaku-track"

// 弾幕気泡トラック底辺の純関数テスト（prd #3）：コントロール条の显隐で上下する。
// player/DOM 不要（state-management: pure view ロジックは framework-free）。

test("条が可视のときは条の上に出るよう大きい bottom", () => {
  expect(danmakuTrackBottom(true)).toBe(CONTROLS_SHOWN_PX)
})

test("条が隐れたときは底に寄せる小さい bottom", () => {
  expect(danmakuTrackBottom(false)).toBe(CONTROLS_HIDDEN_PX)
})

test("可视時のほうが隐れ時より上（bottom が大きい）", () => {
  expect(danmakuTrackBottom(true)).toBeGreaterThan(danmakuTrackBottom(false))
})
