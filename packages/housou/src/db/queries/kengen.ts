import type { Kengen } from "houkago-kousoku"
import { db } from "../client"

type KengenRow = {
  kengen_json: string | null
}

const getStmt = db.query<KengenRow, { $bushitsuId: string }>(
  "SELECT kengen_json FROM bushitsu WHERE id = $bushitsuId",
)

const setStmt = db.query<{ changes: number }, { $bushitsuId: string; $kengenJson: string }>(
  "UPDATE bushitsu SET kengen_json = $kengenJson WHERE id = $bushitsuId",
)

export function getStoredKengen(bushitsuId: string): Kengen | null {
  const row = getStmt.get({ $bushitsuId: bushitsuId })
  return row ? parseKengen(row.kengen_json) : null
}

export function setStoredKengen(bushitsuId: string, kengen: Kengen): boolean {
  return (
    setStmt.run({
      $bushitsuId: bushitsuId,
      $kengenJson: JSON.stringify(kengen),
    }).changes > 0
  )
}

function parseKengen(value: string | null): Kengen | null {
  if (value === null) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return isKengen(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isKengen(value: unknown): value is Kengen {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const expectedKeys = ["playback", "chat", "playlist"]
  return (
    Object.keys(candidate).length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(candidate, key)) &&
    typeof candidate.playback === "boolean" &&
    typeof candidate.chat === "boolean" &&
    typeof candidate.playlist === "boolean"
  )
}
