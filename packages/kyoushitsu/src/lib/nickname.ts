// Persisted display nickname, kept independent of the stable buinId (identity.ts).
// Persisting it means a reload / direct room link / share link keeps the user's
// name instead of falling back to the raw senderId (uuid) on the server.

const KEY = "houkago.nickname"

export function loadNickname(): string {
  return localStorage.getItem(KEY) ?? ""
}

export function saveNickname(name: string): void {
  localStorage.setItem(KEY, name)
}
