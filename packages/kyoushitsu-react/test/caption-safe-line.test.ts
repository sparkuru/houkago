import { expect, test } from "bun:test"
import { captionLineAboveControls } from "../src/features/player/caption-safe-line"

test("automatic captions clear controls in desktop and portrait video boxes", () => {
  const line = captionLineAboveControls(900, 128)
  expect(line).not.toBeNull()
  expect(900 * ((line ?? 0) / 100)).toBeCloseTo(900 - 128)
  expect(812 * ((captionLineAboveControls(812, 128) ?? 0) / 100)).toBeCloseTo(812 - 128)
})

test("hidden controls and unknown dimensions retain the authored caption layout", () => {
  expect(captionLineAboveControls(900, 0)).toBeNull()
  expect(captionLineAboveControls(0, 128)).toBeNull()
  expect(captionLineAboveControls(Number.NaN, 128)).toBeNull()
  expect(captionLineAboveControls(180, 300)).toBe(0)
})
