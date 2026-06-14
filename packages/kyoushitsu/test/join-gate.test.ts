import { expect, test } from "bun:test"
import { showJoinGate } from "../src/lib/join-gate"

// 参加ゲートの可視判定の純関数テスト：follower × joined の組合せ。
// store/DOM/player 不要（state-management: pure view ロジックは framework-free）。

test("部長は常に遮罩なし（自分の操作で起動するため）", () => {
  expect(showJoinGate(true, false)).toBe(false)
  expect(showJoinGate(true, true)).toBe(false)
})

test("部員かつ未参加のときだけ遮罩を出す", () => {
  expect(showJoinGate(false, false)).toBe(true)
})

test("部員でも参加済みなら遮罩なし", () => {
  expect(showJoinGate(false, true)).toBe(false)
})
