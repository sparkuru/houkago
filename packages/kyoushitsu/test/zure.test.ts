import { expect, test } from "bun:test"
import { zureHosei } from "../src/lib/zure"

// design §5 三档決策の境界テスト。zureHosei は純関数なので DOM/player 不要。

test("zure ≤ 0.3 は無視（境界 0.3 を含む）", () => {
  expect(zureHosei(0, false, true, 1)).toEqual({ kind: "ignore" })
  expect(zureHosei(0.3, true, true, 1)).toEqual({ kind: "ignore" })
  expect(zureHosei(0.3, false, false, 2)).toEqual({ kind: "ignore" })
})

test("zure > 1.5 は硬 seek（境界 1.5 は中档なので seek にならない）", () => {
  expect(zureHosei(1.6, true, true, 1)).toEqual({ kind: "seek" })
  expect(zureHosei(100, false, false, 1)).toEqual({ kind: "seek" })
})

test("中档 0.3 < zure ≤ 1.5 かつ再生中：behind → ×1.05 nudge", () => {
  expect(zureHosei(0.31, true, true, 1)).toEqual({ kind: "nudge", rate: 1.05 })
  expect(zureHosei(1.5, true, true, 2)).toEqual({ kind: "nudge", rate: 2.1 })
})

test("中档 0.3 < zure ≤ 1.5 かつ再生中：ahead → ×0.95 nudge", () => {
  expect(zureHosei(0.5, false, true, 1)).toEqual({ kind: "nudge", rate: 0.95 })
  expect(zureHosei(1.5, false, true, 2)).toEqual({ kind: "nudge", rate: 1.9 })
})

test("中档だが停止中：速率を変えられないので seek へ退化", () => {
  expect(zureHosei(0.31, true, false, 1)).toEqual({ kind: "seek" })
  expect(zureHosei(1.5, false, false, 2)).toEqual({ kind: "seek" })
})
