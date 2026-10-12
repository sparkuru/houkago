import { expect, test } from "bun:test"
import { formatPlayerTime } from "../src/features/player/player-time"

test("player time stays readable across minute and hour boundaries", () => {
  expect(formatPlayerTime(59.9)).toBe("00:59")
  expect(formatPlayerTime(60)).toBe("01:00")
  expect(formatPlayerTime(3599)).toBe("59:59")
  expect(formatPlayerTime(3600)).toBe("1:00:00")
  expect(formatPlayerTime(7325)).toBe("2:02:05")
})

test("unknown and negative media times display a safe start time", () => {
  for (const seconds of [Number.NaN, Number.POSITIVE_INFINITY, -1])
    expect(formatPlayerTime(seconds)).toBe("00:00")
})
