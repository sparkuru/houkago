import type { DanmakuCue } from "houkago-kokuban"

export type VisibleDanmakuCue = DanmakuCue & {
  duration: number
  key: string
  lane: number
}

export const FILE_DANMAKU_SCROLL_SECONDS = 10
export const FILE_DANMAKU_FIXED_SECONDS = 6
export const FILE_DANMAKU_MAX_VISIBLE = 28
export const FILE_DANMAKU_LANES = 8
export type FileDanmakuAnimationState = "running" | "paused"

export function fileDanmakuAnimationState(playing: boolean): FileDanmakuAnimationState {
  return playing ? "running" : "paused"
}

export function fileDanmakuRenderKey(cue: VisibleDanmakuCue, trackVersion: number): string {
  return `${trackVersion}:${cue.key}`
}

export function fileDanmakuDuration(mode: DanmakuCue["mode"]): number {
  return mode === "scroll" || mode === "reverse"
    ? FILE_DANMAKU_SCROLL_SECONDS
    : FILE_DANMAKU_FIXED_SECONDS
}

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
    const age = currentTime - cue.time
    const duration = fileDanmakuDuration(cue.mode)
    if (age >= duration) continue
    visible.push({
      ...cue,
      duration,
      key: `${i}:${cue.time}:${cue.text}`,
      lane: i % FILE_DANMAKU_LANES,
    })
  }

  return visible.slice(-FILE_DANMAKU_MAX_VISIBLE)
}
