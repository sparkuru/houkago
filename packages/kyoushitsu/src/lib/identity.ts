// Stable per-browser 部員 id, persisted so a reload keeps the same identity.
// This id is the WS `senderId` and, for a room creator, the room's `buchouId` —
// the two MUST be the same value or host-authority never matches (design §5).
// Identity is deliberately independent of the (mutable) nickname.

const KEY = "houkago.buinId"

// crypto.randomUUID は secure context 限定（HTTPS / localhost のみ）。
// 明文 HTTP + LAN IP では undefined なので、どの context でも使える
// crypto.getRandomValues で RFC-4122 v4 UUID を組み立ててフォールバックする。
function uuidv4(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40 // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
}

export function buinId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = uuidv4()
    localStorage.setItem(KEY, id)
  }
  return id
}
