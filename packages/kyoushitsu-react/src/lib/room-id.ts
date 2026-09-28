import { normalizeRoomId } from "houkago-kyoushitsu/room-id"
export function roomIdFromInput(raw: string): string {
  if (hasControls(raw)) throw new Error("Invalid room ID")
  return safeRoomId(normalizeRoomId(raw))
}
export function safeRoomId(id: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(id)
  } catch {
    throw new Error("Invalid room ID")
  }
  if (
    !decoded ||
    decoded !== decoded.trim() ||
    decoded === "." ||
    decoded === ".." ||
    /[/%?#\\]/u.test(decoded) ||
    hasControls(decoded)
  )
    throw new Error("Invalid room ID")
  return decoded
}
function hasControls(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code <= 31 || (code >= 127 && code <= 159)
  })
}
