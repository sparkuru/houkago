import { type DanmakuCue, parseBilibiliXml } from "houkago-kokuban"
import type { DanmakuCandidate, Enmoku } from "houkago-kousoku"
import { stableReleaseIdentity } from "./danmaku-selection"

const DEFAULT_EMPTY_LABEL = "Empty local danmaku"

/**
 * Build the viewer-only candidate for one selected XML file. The parser is
 * deliberately kept behind this adapter so the timeline composable owns
 * selection/state while kokuban remains the sole XML parser.
 */
export function createLocalDanmakuCandidate(
  enmoku: Enmoku,
  fileName: string,
  input: string,
  emptyLabel = DEFAULT_EMPTY_LABEL,
): DanmakuCandidate {
  const id = `local:${stableReleaseIdentity(enmoku)}`
  const normalizedFileName = normalizeLabel(fileName, emptyLabel)
  const normalizedEmptyLabel = normalizeLabel(emptyLabel, DEFAULT_EMPTY_LABEL)
  let cues: DanmakuCue[]
  try {
    cues = parseBilibiliXml(input)
  } catch {
    return {
      id,
      sourceClass: "local",
      name: normalizedEmptyLabel,
      availability: "unavailable",
      reason: normalizedEmptyLabel,
    }
  }

  if (cues.length === 0) {
    return {
      id,
      sourceClass: "local",
      name: normalizedEmptyLabel,
      availability: "unavailable",
      reason: normalizedEmptyLabel,
    }
  }

  return {
    id,
    sourceClass: "local",
    name: normalizedFileName,
    availability: "available",
    evidence: [{ kind: "filename" }],
    cues,
  }
}

export const parseLocalDanmakuCandidate = createLocalDanmakuCandidate

function normalizeLabel(value: string, fallback: string): string {
  const normalized = value.trim().slice(0, 256)
  return normalized || fallback.trim().slice(0, 256) || DEFAULT_EMPTY_LABEL
}
