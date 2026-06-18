import { expect, test } from "bun:test"
import { visibleFileDanmakuCues } from "../src/lib/file-danmaku"

test("returns cues active at the current playback time", () => {
  const visible = visibleFileDanmakuCues(
    [
      { time: 1, text: "old", mode: "scroll", color: "#fff" },
      { time: 5, text: "now", mode: "scroll", color: "#fff" },
      { time: 12, text: "future", mode: "scroll", color: "#fff" },
    ],
    6,
  )

  expect(visible.map((cue) => cue.text)).toEqual(["old", "now"])
})

test("drops expired and future cues", () => {
  const visible = visibleFileDanmakuCues(
    [
      { time: 1, text: "expired", mode: "scroll", color: "#fff" },
      { time: 8, text: "active", mode: "scroll", color: "#fff" },
      { time: 15, text: "future", mode: "scroll", color: "#fff" },
    ],
    10,
  )

  expect(visible.map((cue) => cue.text)).toEqual(["active"])
})

test("invalid playback time shows no cues", () => {
  expect(visibleFileDanmakuCues([{ time: 1, text: "x", mode: "scroll" }], Number.NaN)).toEqual([])
})
