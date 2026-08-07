import { expect, test } from "bun:test"
import { KENGEN_PRESETS, kengenEquals, kengenPresetId } from "../src/lib/kengen-policy"

test("the three control-policy presets use the approved permission snapshots", () => {
  expect(KENGEN_PRESETS).toEqual([
    { id: "chat", kengen: { chat: true, playback: false, playlist: false } },
    { id: "playback", kengen: { chat: true, playback: true, playlist: false } },
    { id: "playlist", kengen: { chat: true, playback: true, playlist: true } },
  ])
})

test("a non-preset three-boolean snapshot is custom", () => {
  expect(kengenPresetId({ chat: false, playback: true, playlist: true })).toBeNull()
  expect(kengenPresetId({ chat: true, playback: true, playlist: false })).toBe("playback")
  expect(
    kengenEquals({ chat: true, playback: false, playlist: false }, KENGEN_PRESETS[0].kengen),
  ).toBe(true)
})
