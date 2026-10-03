import type { DanmakuCandidate, DanmakuDefault, DanmakuSourcePolicy, Enmoku } from "houkago-kousoku"

/**
 * The storage format is versioned so a future candidate identity migration can
 * invalidate only this presentation preference. It is intentionally scoped to
 * one stable media release, not to a room or to another viewer.
 */
export const DANMAKU_OVERRIDE_VERSION = 1 as const
export const DANMAKU_OVERRIDE_STORAGE_PREFIX = "houkago:danmaku-override:v1:"

export type DanmakuViewerOverride = {
  version: typeof DANMAKU_OVERRIDE_VERSION
  releaseIdentity: string
  candidateId: string
  trackId?: string
}

export type DanmakuSelectionOrigin =
  | "viewer-override"
  | "room-default"
  | "strategy"
  | "none"
  | "fallback"

export type DanmakuSelection = {
  candidate: DanmakuCandidate | null
  origin: DanmakuSelectionOrigin
}

/**
 * Derive a stable, provider-safe identity from an Enmoku. The room item id is
 * the final fallback because it remains stable for the lifetime of that item;
 * provider metadata takes precedence so recreated queue entries can retain a
 * viewer's choice for the same release.
 */
export function stableReleaseIdentity(enmoku: Enmoku): string {
  const provider = enmoku.provider
  if (provider?.kind === "bilibili" && provider.url.trim()) {
    return `bilibili:${normalizeIdentityPart(provider.url)}`
  }
  if (provider?.kind === "baidu" && provider.sourceId.trim()) {
    return `baidu:${normalizeIdentityPart(provider.sourceId)}`
  }
  if (enmoku.danmaku?.type === "fetch" && enmoku.danmaku.ref.trim()) {
    return `danmaku:${normalizeIdentityPart(enmoku.danmaku.ref)}`
  }
  if (enmoku.url.trim()) return `media:${normalizeIdentityPart(enmoku.url)}`
  return `enmoku:${enmoku.id}`
}

export const releaseIdentityForEnmoku = stableReleaseIdentity
export const makeStableReleaseIdentity = stableReleaseIdentity

export function danmakuOverrideStorageKey(releaseIdentity: string): string {
  return `${DANMAKU_OVERRIDE_STORAGE_PREFIX}${encodeURIComponent(releaseIdentity)}`
}

export const viewerDanmakuOverrideKey = danmakuOverrideStorageKey

export function loadDanmakuOverride(enmoku: Enmoku): DanmakuViewerOverride | null {
  const releaseIdentity = stableReleaseIdentity(enmoku)
  const raw = safeStorageGet(danmakuOverrideStorageKey(releaseIdentity))
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isDanmakuViewerOverride(parsed) || parsed.releaseIdentity !== releaseIdentity) return null
    return parsed
  } catch {
    // A malformed preference is treated as unavailable. It is left in place
    // so a transient/corrupt preference never causes an unexpected write.
    return null
  }
}

export const readDanmakuOverride = loadDanmakuOverride

export function saveDanmakuOverride(
  enmoku: Enmoku,
  candidateId: string,
  trackId?: string,
): DanmakuViewerOverride {
  const override: DanmakuViewerOverride = {
    version: DANMAKU_OVERRIDE_VERSION,
    releaseIdentity: stableReleaseIdentity(enmoku),
    candidateId,
    ...(trackId ? { trackId } : {}),
  }
  safeStorageSet(danmakuOverrideStorageKey(override.releaseIdentity), JSON.stringify(override))
  return override
}

export const writeDanmakuOverride = saveDanmakuOverride

export function clearDanmakuOverride(enmoku: Enmoku): void {
  safeStorageRemove(danmakuOverrideStorageKey(stableReleaseIdentity(enmoku)))
}

export const removeDanmakuOverride = clearDanmakuOverride

export function isDanmakuCandidateUsable(candidate: DanmakuCandidate | null | undefined): boolean {
  return candidate?.availability === "available"
}

export function orderDanmakuCandidates(
  candidates: readonly DanmakuCandidate[],
  policy: DanmakuSourcePolicy,
): DanmakuCandidate[] {
  const order = new Map(policy.order.map((sourceClass, index) => [sourceClass, index]))
  return [...candidates].sort((left, right) => {
    const leftRank = order.get(left.sourceClass) ?? policy.order.length
    const rightRank = order.get(right.sourceClass) ?? policy.order.length
    return (
      leftRank - rightRank ||
      left.sourceClass.localeCompare(right.sourceClass) ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id)
    )
  })
}

export const rankDanmakuCandidates = orderDanmakuCandidates

export function resolveDanmakuSelection(
  candidates: readonly DanmakuCandidate[],
  override: DanmakuViewerOverride | null | undefined,
  roomDefault: DanmakuDefault | null | undefined,
  policy: DanmakuSourcePolicy,
): DanmakuSelection {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const byTrackId = new Map(
    candidates
      .filter((candidate) => candidate.trackId)
      .map((candidate) => [candidate.trackId as string, candidate]),
  )

  if (override) {
    const personal =
      byId.get(override.candidateId) ??
      (override.trackId ? byTrackId.get(override.trackId) : undefined)
    if (personal?.availability === "available") {
      return { candidate: personal, origin: "viewer-override" }
    }
  }

  const room = roomDefault
    ? (byTrackId.get(roomDefault.trackId) ?? byId.get(roomDefault.trackId))
    : undefined
  if (roomDefault?.availability === "available" && room?.availability === "available") {
    return { candidate: room, origin: "room-default" }
  }

  const strategy = orderDanmakuCandidates(candidates, policy).find(
    (candidate) => candidate.availability === "available",
  )
  return strategy
    ? { candidate: strategy, origin: override || roomDefault ? "fallback" : "strategy" }
    : { candidate: null, origin: "none" }
}

export const selectDanmakuCandidate = resolveDanmakuSelection

function isDanmakuViewerOverride(value: unknown): value is DanmakuViewerOverride {
  if (!value || typeof value !== "object") return false
  const record = value as Record<string, unknown>
  return (
    record.version === DANMAKU_OVERRIDE_VERSION &&
    typeof record.releaseIdentity === "string" &&
    record.releaseIdentity.length > 0 &&
    typeof record.candidateId === "string" &&
    record.candidateId.length > 0 &&
    (record.trackId === undefined ||
      (typeof record.trackId === "string" && record.trackId.length > 0))
  )
}

function normalizeIdentityPart(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

function safeStorageGet(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    storage()?.setItem(key, value)
  } catch {
    // Viewer-local preference storage is best effort and must never block play.
  }
}

function safeStorageRemove(key: string): void {
  try {
    storage()?.removeItem(key)
  } catch {
    // See safeStorageSet: an unavailable storage backend is not a playback error.
  }
}
