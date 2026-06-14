import type { Kengen } from "houkago-kousoku"

// 権限（kengen）: room-level guest-permission state + the pure gate (prd
// role-permissions §2/§4). The 部長 default keeps playback and source control for
// the host; guests may chat. Per-room, in-memory, same lifecycle as the roster
// (cleared when the room empties).

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
  return rooms.get(bushitsuId) ?? { ...DEFAULT_KENGEN }
}

export function setKengen(bushitsuId: string, kengen: Kengen): void {
  rooms.set(bushitsuId, kengen)
}

// Drop a room's permission state when it empties, matching roster lifecycle so a
// stale switch does not leak into a later, reused room id.
export function clearKengen(bushitsuId: string): void {
  rooms.delete(bushitsuId)
}
