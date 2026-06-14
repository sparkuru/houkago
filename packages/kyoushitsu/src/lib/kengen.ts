import type { Kengen } from "houkago-kousoku"

// 権限（kengen）gate, client side (prd role-permissions §3). Mirror of housou's
// canDo so the store's derived canControl/canChat/canPlaylist match the server's
// enforcement exactly — UI gating and server gate use the same pure rule.

export type KengenAction = "playback" | "chat" | "playlist"

// The host (部長) may do anything; a guest may do an action only when the room
// switch for it is on. Pure (input → bool), unit-testable without a store.
export function canDo(isHost: boolean, kengen: Kengen, action: KengenAction): boolean {
  return isHost || kengen[action]
}
