import type { DanmakuCue } from "houkago-kokuban"

export type VisibleDanmakuCue = DanmakuCue & {
  age: number
  duration: number
  key: string
  lane: number
  opacity: number
  progress: number
}

export type FileDanmakuViewport = {
  left: number
  top: number
  width: number
  height: number
}

export const FILE_DANMAKU_SCROLL_SECONDS = 10
export const FILE_DANMAKU_FIXED_SECONDS = 6
export const FILE_DANMAKU_MAX_VISIBLE = 240
export const FILE_DANMAKU_LANES = 8
export const FILE_DANMAKU_DEFAULT_SPEED = 1
export const FILE_DANMAKU_MIN_SPEED = 0.5
export const FILE_DANMAKU_MAX_SPEED = 2

export function fileDanmakuRenderKey(cue: VisibleDanmakuCue, trackVersion: number): string {
  return `${trackVersion}:${cue.key}`
}

export function fileDanmakuViewport(
  containerWidth: number,
  containerHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): FileDanmakuViewport {
  if (
    !Number.isFinite(containerWidth) ||
    !Number.isFinite(containerHeight) ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  if (
    !Number.isFinite(mediaWidth) ||
    !Number.isFinite(mediaHeight) ||
    mediaWidth <= 0 ||
    mediaHeight <= 0
  ) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight }
  }

  const containerRatio = containerWidth / containerHeight
  const mediaRatio = mediaWidth / mediaHeight
  if (containerRatio > mediaRatio) {
    const width = containerHeight * mediaRatio
    return { left: (containerWidth - width) / 2, top: 0, width, height: containerHeight }
  }

  const height = containerWidth / mediaRatio
  return { left: 0, top: (containerHeight - height) / 2, width: containerWidth, height }
}

export function normalizeFileDanmakuSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return FILE_DANMAKU_DEFAULT_SPEED
  return Math.min(FILE_DANMAKU_MAX_SPEED, Math.max(FILE_DANMAKU_MIN_SPEED, speed))
}

export function fileDanmakuDuration(
  mode: DanmakuCue["mode"],
  speed = FILE_DANMAKU_DEFAULT_SPEED,
): number {
  const base =
    mode === "scroll" || mode === "reverse"
      ? FILE_DANMAKU_SCROLL_SECONDS
      : FILE_DANMAKU_FIXED_SECONDS
  return base / normalizeFileDanmakuSpeed(speed)
}

function fixedCueOpacity(progress: number): number {
  if (progress < 0.08) return progress / 0.08
  if (progress > 0.88) return Math.max(0, (1 - progress) / 0.12)
  return 1
}

export function visibleFileDanmakuCues(
  cues: readonly DanmakuCue[],
  currentTime: number,
  speed = FILE_DANMAKU_DEFAULT_SPEED,
): VisibleDanmakuCue[] {
  if (!Number.isFinite(currentTime) || currentTime < 0) return []

  const visible: VisibleDanmakuCue[] = []
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]
    if (!cue) continue
    if (cue.time > currentTime) break
    const age = currentTime - cue.time
    const duration = fileDanmakuDuration(cue.mode, speed)
    if (age >= duration) continue
    const progress = age / duration
    const isFixed = cue.mode === "top" || cue.mode === "bottom" || cue.mode === "special"
    visible.push({
      ...cue,
      age,
      duration,
      key: `${i}:${cue.time}:${cue.text}`,
      lane: i % FILE_DANMAKU_LANES,
      opacity: isFixed ? fixedCueOpacity(progress) : 1,
      progress,
    })
  }

  return visible.slice(0, FILE_DANMAKU_MAX_VISIBLE)
}
