import { expect, test } from "bun:test"
import {
  FILE_DANMAKU_FIXED_SECONDS,
  FILE_DANMAKU_SCROLL_SECONDS,
  fileDanmakuAnimationState,
  fileDanmakuDuration,
  fileDanmakuRenderKey,
  visibleFileDanmakuCues,
} from "../src/lib/file-danmaku"

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
      { time: 0, text: "expired", mode: "scroll", color: "#fff" },
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

test("file danmaku animation follows playback state", () => {
  expect(fileDanmakuAnimationState(true)).toBe("running")
  expect(fileDanmakuAnimationState(false)).toBe("paused")
})

test("visible cues carry mode duration", () => {
  const [scroll] = visibleFileDanmakuCues([{ time: 8, text: "x", mode: "scroll" }], 10)
  const [fixed] = visibleFileDanmakuCues([{ time: 8, text: "x", mode: "top" }], 10)

  expect(scroll?.duration).toBe(FILE_DANMAKU_SCROLL_SECONDS)
  expect(fixed?.duration).toBe(FILE_DANMAKU_FIXED_SECONDS)
  expect(fileDanmakuDuration("reverse")).toBe(FILE_DANMAKU_SCROLL_SECONDS)
})

test("file danmaku render key changes when the selected track changes", () => {
  const [cue] = visibleFileDanmakuCues([{ time: 1, text: "x", mode: "scroll" }], 1)

  expect(cue).toBeDefined()
  if (!cue) return
  expect(fileDanmakuRenderKey(cue, 1)).not.toBe(fileDanmakuRenderKey(cue, 2))
})
