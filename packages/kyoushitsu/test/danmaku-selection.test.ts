import { beforeEach, expect, test } from "bun:test"
import type { DanmakuCandidate, DanmakuDefault, DanmakuSourcePolicy, Enmoku } from "houkago-kousoku"
import {
  clearDanmakuOverride,
  danmakuOverrideStorageKey,
  loadDanmakuOverride,
  resolveDanmakuSelection,
  saveDanmakuOverride,
  stableReleaseIdentity,
} from "../src/lib/danmaku-selection"

const storageValues = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (key: string) => storageValues.get(key) ?? null,
  setItem: (key: string, value: string) => void storageValues.set(key, value),
  removeItem: (key: string) => void storageValues.delete(key),
  clear: () => void storageValues.clear(),
  key: () => null,
  length: 0,
} as Storage

const enmoku: Enmoku = {
  id: "enmoku-1",
  bushitsuId: "room-1",
  title: "fixture",
  type: "direct",
  url: "https://media.example.test/fixture.mp4",
  addedBy: "viewer-1",
}

const policy: DanmakuSourcePolicy = {
  allowedClasses: ["server-stored", "provider-official", "local", "third-party"],
  order: ["server-stored", "provider-official", "local", "third-party"],
  updatedAt: 1,
}

function candidate(id: string, sourceClass: DanmakuCandidate["sourceClass"]): DanmakuCandidate {
  return { id, sourceClass, name: id, trackId: id, availability: "available" }
}

function roomDefault(
  trackId: string,
  availability: DanmakuDefault["availability"] = "available",
): DanmakuDefault {
  return {
    enmokuId: enmoku.id,
    trackId,
    revisionId: `revision:${trackId}`,
    availability,
    updatedAt: 1,
  }
}

beforeEach(() => {
  storageValues.clear()
})

test("viewer override is versioned, release-scoped, and removable", () => {
  expect(stableReleaseIdentity(enmoku)).toBe("media:https://media.example.test/fixture.mp4")
  const saved = saveDanmakuOverride(enmoku, "track-personal", "track-personal")
  expect(saved.version).toBe(1)
  expect(loadDanmakuOverride(enmoku)).toEqual(saved)
  expect(storageValues.has(danmakuOverrideStorageKey(saved.releaseIdentity))).toBe(true)

  clearDanmakuOverride(enmoku)
  expect(loadDanmakuOverride(enmoku)).toBeNull()
})

test("selection precedence is viewer override, room default, then deployment order", () => {
  const candidates = [candidate("server", "server-stored"), candidate("personal", "third-party")]
  const saved = saveDanmakuOverride(enmoku, "personal", "personal")
  expect(resolveDanmakuSelection(candidates, saved, roomDefault("server"), policy)).toMatchObject({
    candidate: { id: "personal" },
    origin: "viewer-override",
  })

  clearDanmakuOverride(enmoku)
  expect(resolveDanmakuSelection(candidates, null, roomDefault("server"), policy)).toMatchObject({
    candidate: { id: "server" },
    origin: "room-default",
  })
  expect(resolveDanmakuSelection(candidates, null, null, policy)).toMatchObject({
    candidate: { id: "server" },
    origin: "strategy",
  })
})

test("invalid stored choices fall through without deleting the preference", () => {
  const saved = saveDanmakuOverride(enmoku, "missing", "missing")
  const selected = resolveDanmakuSelection(
    [candidate("fallback", "provider-official")],
    saved,
    roomDefault("missing", "failed"),
    policy,
  )
  expect(selected).toMatchObject({ candidate: { id: "fallback" }, origin: "fallback" })
  expect(loadDanmakuOverride(enmoku)).toEqual(saved)
})
