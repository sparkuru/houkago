import type { Kengen } from "houkago-kousoku"

export type KengenPresetId = "chat" | "playback" | "playlist"

export type KengenPreset = {
  id: KengenPresetId
  kengen: Kengen
}

// The room policy is a three-boolean protocol snapshot. Keep the preset values
// in one pure helper so rendering and selection cannot drift apart.
export const KENGEN_PRESETS: readonly KengenPreset[] = [
  { id: "chat", kengen: { chat: true, playback: false, playlist: false } },
  { id: "playback", kengen: { chat: true, playback: true, playlist: false } },
  { id: "playlist", kengen: { chat: true, playback: true, playlist: true } },
]

export function kengenEquals(left: Kengen, right: Kengen): boolean {
  return (
    left.chat === right.chat && left.playback === right.playback && left.playlist === right.playlist
  )
}

export function kengenPresetId(kengen: Kengen): KengenPresetId | null {
  return KENGEN_PRESETS.find((preset) => kengenEquals(preset.kengen, kengen))?.id ?? null
}
