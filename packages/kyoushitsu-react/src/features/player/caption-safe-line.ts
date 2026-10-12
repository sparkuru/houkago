/** Native percentage cue lines use the video element's box, including letterboxing. */
export function captionLineAboveControls(height: number, inset: number): number | null {
  if (![height, inset].every(Number.isFinite) || Math.min(height, inset) <= 0) return null
  return Math.max(0, 100 - (inset / height) * 100)
}
