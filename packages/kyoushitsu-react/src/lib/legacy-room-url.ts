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
export function legacyRoomUrl(
  id: string,
  current: string,
  configured?: string,
  development = false,
): string {
  const here = new URL(current)
  const target = configured ?? (development ? `${here.protocol}//${here.hostname}:5173` : undefined)
  if (!target) throw new Error("Legacy frontend origin is missing")
  const url = new URL(target)
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.origin === here.origin ||
    url.protocol !== here.protocol ||
    url.hostname !== here.hostname
  )
    throw new Error("Invalid legacy frontend origin")
  url.pathname = `/bushitsu/${encodeURIComponent(safeRoomId(id))}`
  return url.href
}
export function createRoomHandoff(replace: (target: string) => void) {
  let handedOff = false
  return (target: string) => {
    if (handedOff) return
    handedOff = true
    replace(target)
  }
}

function hasControls(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0
    return code <= 31 || (code >= 127 && code <= 159)
  })
}
