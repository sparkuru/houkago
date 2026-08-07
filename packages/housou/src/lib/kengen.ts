import type { Kengen } from "houkago-kousoku"
import { getStoredKengen, setStoredKengen } from "../db/queries/kengen"

// 権限（kengen）: room-level guest-permission state + the pure gate. The 部長
// default keeps playback and source control for the host; guests may chat.

export const DEFAULT_KENGEN: Kengen = { playback: false, chat: true, playlist: false }

export type KengenAction = "playback" | "chat" | "playlist"

// Pure authority gate: the host (部長) may do anything; a guest may do an action
// only when the room switch for it is on. Pure (input → bool) so it is unit-
// testable without a socket and shared by every WS enforcement point.
export function canDo(isHost: boolean, kengen: Kengen, action: KengenAction): boolean {
  return isHost || kengen[action]
}

const rooms = new Map<string, Kengen>()

export function getKengen(bushitsuId: string): Kengen {
  const cached = rooms.get(bushitsuId)
  if (cached) return { ...cached }
  const stored = getStoredKengen(bushitsuId) ?? DEFAULT_KENGEN
  rooms.set(bushitsuId, { ...stored })
  return { ...stored }
}

export function setKengen(bushitsuId: string, kengen: Kengen): void {
  if (!setStoredKengen(bushitsuId, kengen)) {
    throw new Error(`cannot persist Kengen for missing room ${bushitsuId}`)
  }
  rooms.set(bushitsuId, { ...kengen })
}

// Drop only the process cache. The durable room policy intentionally survives
// empty rooms and gives a restarted service the same authoritative snapshot.
export function clearKengen(bushitsuId: string): void {
  rooms.delete(bushitsuId)
}
