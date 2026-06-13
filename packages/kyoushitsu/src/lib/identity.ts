// Stable per-browser 部員 id, persisted so a reload keeps the same identity.
// This id is the WS `senderId` and, for a room creator, the room's `buchouId` —
// the two MUST be the same value or host-authority never matches (design §5).
// Identity is deliberately independent of the (mutable) nickname.

const KEY = "houkago.buinId"

export function buinId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}
