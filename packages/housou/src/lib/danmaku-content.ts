import { Value } from "@sinclair/typebox/value"
import { type DanmakuCue, DanmakuCueSchema, type Digest } from "houkago-kousoku"

// Canonical JSON is deliberately produced here, at the storage boundary. A
// provider can emit cues in a different order or with an omitted optional
// color, but equal normalized timelines receive the same content identity.
export function canonicalizeDanmakuCues(cues: readonly DanmakuCue[]): DanmakuCue[] {
  return cues
    .map((cue) => {
      if (!Number.isFinite(cue.time) || cue.time < 0) {
        throw new Error("danmaku cue time must be a finite non-negative number")
      }
      const text = cue.text.trim()
      if (!text) throw new Error("danmaku cue text must not be empty")
      const normalized = {
        time: cue.time,
        text,
        ...(cue.color === undefined ? {} : { color: cue.color }),
        mode: cue.mode,
      }
      if (!Value.Check(DanmakuCueSchema, normalized)) {
        throw new Error("danmaku cue is invalid")
      }
      return normalized
    })
    .sort((left, right) => {
      if (left.time !== right.time) return left.time - right.time
      if (left.text !== right.text) return compareCodePoints(left.text, right.text)
      if (left.mode !== right.mode) return compareCodePoints(left.mode, right.mode)
      return compareCodePoints(left.color ?? "", right.color ?? "")
    })
}

export function serializeCanonicalDanmakuCues(cues: readonly DanmakuCue[]): string {
  return JSON.stringify(canonicalizeDanmakuCues(cues))
}

// Alias kept intentionally small and provider-neutral for adapters that call
// the operation "serialize" rather than "canonicalize".
export const canonicalizeCues = canonicalizeDanmakuCues
export const serializeCanonicalCues = serializeCanonicalDanmakuCues

export function hashCanonicalDanmakuCues(cues: readonly DanmakuCue[]): {
  digest: Digest
  canonicalJson: string
  byteLength: number
} {
  const canonicalJson = serializeCanonicalDanmakuCues(cues)
  const bytes = new TextEncoder().encode(canonicalJson)
  const value = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  return {
    digest: { algorithm: "sha256", scope: "canonical-json/v1", value, bytes: bytes.byteLength },
    canonicalJson,
    byteLength: bytes.byteLength,
  }
}

export const contentHashForCues = hashCanonicalDanmakuCues

export function digestsEqual(left: Digest, right: Digest): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.scope === right.scope &&
    left.value === right.value &&
    left.bytes === right.bytes
  )
}

export const digestEqual = digestsEqual

function compareCodePoints(left: string, right: string): number {
  if (left === right) return 0
  const leftPoints = Array.from(left)
  const rightPoints = Array.from(right)
  const length = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < length; index += 1) {
    const leftPoint = leftPoints[index]
    const rightPoint = rightPoints[index]
    if (leftPoint === rightPoint) continue
    if (leftPoint === undefined || rightPoint === undefined) continue
    return leftPoint < rightPoint ? -1 : 1
  }
  return leftPoints.length < rightPoints.length ? -1 : 1
}
