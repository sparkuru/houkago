import { expect, test } from "bun:test"
import { normalizeRoomId } from "../src/lib/room-id"

// 部室 id 净化の純テスト：纯uuid/带前缀路径/全URL/带空白/查询串を末段 id へ。
// 带斜杠の脏 id が housou のルーティングを 500 で壊す回帰の防止。

const UUID = "11111111-2222-4333-8444-555555555555"

test("纯 uuid はそのまま", () => {
  expect(normalizeRoomId(UUID)).toBe(UUID)
})

test("bushitsu/<uuid> パスは末段 uuid に", () => {
  expect(normalizeRoomId(`bushitsu/${UUID}`)).toBe(UUID)
})

test("全 URL は末段 uuid に", () => {
  expect(normalizeRoomId(`http://192.168.1.2:5173/bushitsu/${UUID}`)).toBe(UUID)
})

test("前後の空白を除く", () => {
  expect(normalizeRoomId(`  ${UUID}  `)).toBe(UUID)
})

test("查询串・井号を落とす", () => {
  expect(normalizeRoomId(`http://x/bushitsu/${UUID}?foo=1#bar`)).toBe(UUID)
})

test("末尾スラッシュでも末段を取る", () => {
  expect(normalizeRoomId(`/bushitsu/${UUID}/`)).toBe(UUID)
})

test("空文字は空文字", () => {
  expect(normalizeRoomId("")).toBe("")
  expect(normalizeRoomId("   ")).toBe("")
})
