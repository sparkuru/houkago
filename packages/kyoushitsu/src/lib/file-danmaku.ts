import type { DanmakuCue } from "houkago-kokuban"

export type VisibleDanmakuCue = DanmakuCue & {
  key: string
  lane: number
}

export const FILE_DANMAKU_VISIBLE_SECONDS = 6
export const FILE_DANMAKU_MAX_VISIBLE = 28
export const FILE_DANMAKU_LANES = 8

export function visibleFileDanmakuCues(
  cues: readonly DanmakuCue[],
  currentTime: number,
): VisibleDanmakuCue[] {
  if (!Number.isFinite(currentTime) || currentTime < 0) return []

  const visible: VisibleDanmakuCue[] = []
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]
    if (!cue) continue
    if (cue.time > currentTime) break
    if (currentTime - cue.time >= FILE_DANMAKU_VISIBLE_SECONDS) continue
    visible.push({
      ...cue,
      key: `${i}:${cue.time}:${cue.text}`,
      lane: i % FILE_DANMAKU_LANES,
    })
  }

  return visible.slice(-FILE_DANMAKU_MAX_VISIBLE)
}
