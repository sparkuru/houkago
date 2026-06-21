import { expect, test } from "bun:test"
import {
  FILE_DANMAKU_FIXED_SECONDS,
  FILE_DANMAKU_MAX_SPEED,
  FILE_DANMAKU_MAX_VISIBLE,
  FILE_DANMAKU_MIN_SPEED,
  FILE_DANMAKU_SCROLL_SECONDS,
  fileDanmakuDuration,
  fileDanmakuRenderKey,
  fileDanmakuViewport,
  normalizeFileDanmakuSpeed,
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

test("visible cues carry mode duration", () => {
  const [scroll] = visibleFileDanmakuCues([{ time: 8, text: "x", mode: "scroll" }], 10)
  const [fixed] = visibleFileDanmakuCues([{ time: 8, text: "x", mode: "top" }], 10)

  expect(scroll?.duration).toBe(FILE_DANMAKU_SCROLL_SECONDS)
  expect(fixed?.duration).toBe(FILE_DANMAKU_FIXED_SECONDS)
  expect(fileDanmakuDuration("reverse")).toBe(FILE_DANMAKU_SCROLL_SECONDS)
})

test("danmaku speed scales effective cue duration", () => {
  expect(fileDanmakuDuration("scroll", 2)).toBe(FILE_DANMAKU_SCROLL_SECONDS / 2)
  expect(fileDanmakuDuration("top", 0.5)).toBe(FILE_DANMAKU_FIXED_SECONDS * 2)
  expect(normalizeFileDanmakuSpeed(0.1)).toBe(FILE_DANMAKU_MIN_SPEED)
  expect(normalizeFileDanmakuSpeed(9)).toBe(FILE_DANMAKU_MAX_SPEED)
  expect(normalizeFileDanmakuSpeed(Number.NaN)).toBe(1)
})

test("visible cues expose media-clock progress instead of DOM insertion state", () => {
  const [cue] = visibleFileDanmakuCues([{ time: 5, text: "x", mode: "scroll" }], 7.5, 2)

  expect(cue?.age).toBe(2.5)
  expect(cue?.duration).toBe(FILE_DANMAKU_SCROLL_SECONDS / 2)
  expect(cue?.progress).toBe(0.5)
})

test("file danmaku render key changes when the selected track changes", () => {
  const [cue] = visibleFileDanmakuCues([{ time: 1, text: "x", mode: "scroll" }], 1)

  expect(cue).toBeDefined()
  if (!cue) return
  expect(fileDanmakuRenderKey(cue, 1)).not.toBe(fileDanmakuRenderKey(cue, 2))
})

test("visible cue cap keeps already-active cues so they can finish crossing", () => {
  const cues = Array.from({ length: FILE_DANMAKU_MAX_VISIBLE + 3 }, (_, i) => ({
    time: i * 0.01,
    text: `cue-${i}`,
    mode: "scroll" as const,
  }))
  const visible = visibleFileDanmakuCues(cues, 3)

  expect(visible).toHaveLength(FILE_DANMAKU_MAX_VISIBLE)
  expect(visible[0]?.text).toBe("cue-0")
  expect(visible.at(-1)?.text).toBe(`cue-${FILE_DANMAKU_MAX_VISIBLE - 1}`)
})

test("file danmaku viewport follows contained video width for side letterbox", () => {
  const viewport = fileDanmakuViewport(1600, 900, 4, 3)

  expect(viewport.left).toBe(200)
  expect(viewport.top).toBe(0)
  expect(viewport.width).toBe(1200)
  expect(viewport.height).toBe(900)
})

test("file danmaku viewport follows contained video height for top letterbox", () => {
  const viewport = fileDanmakuViewport(1200, 900, 16, 9)

  expect(viewport.left).toBe(0)
  expect(viewport.top).toBe(112.5)
  expect(viewport.width).toBe(1200)
  expect(viewport.height).toBe(675)
})
