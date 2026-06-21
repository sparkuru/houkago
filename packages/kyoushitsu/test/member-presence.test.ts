import { expect, test } from "bun:test"
import { formatOnlineDuration } from "../src/lib/member-presence"

const labels = { hour: "时", minute: "分", second: "秒" }

test("formatOnlineDuration clamps future join time to zero seconds", () => {
  expect(formatOnlineDuration(2_000, 1_000, labels)).toBe("0秒")
})

test("formatOnlineDuration renders seconds, minutes, and hours compactly", () => {
  expect(formatOnlineDuration(1_000, 46_000, labels)).toBe("45秒")
  expect(formatOnlineDuration(1_000, 126_000, labels)).toBe("2分5秒")
  expect(formatOnlineDuration(1_000, 3_721_000, labels)).toBe("1时2分")
})
