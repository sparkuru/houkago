export const ROOM_FLOATING_POSITION_STORAGE_KEY = "houkago.kyoushitsu.room-floating-position.v1"

const ROOM_FLOATING_POSITION_VERSION = 1
export const ROOM_FLOATING_POSITION_INSET = 16

export type RoomFloatingPosition = {
  x: number
  y: number
}

export type RoomFloatingBounds = {
  viewportWidth: number
  viewportHeight: number
  elementWidth: number
  elementHeight: number
  safeArea?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

export type RoomFloatingPixels = {
  left: number
  top: number
}

type PositionStorage = Pick<Storage, "getItem" | "setItem">

export const DEFAULT_ROOM_FLOATING_POSITION: RoomFloatingPosition = Object.freeze({
  x: 1,
  y: 1,
})

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, finiteOr(value, 0)))
}

function safeInset(value: number | undefined): number {
  return Math.max(ROOM_FLOATING_POSITION_INSET, finiteOr(value, 0))
}

function availableLength(viewport: number, element: number, start: number, end: number): number {
  return Math.max(0, finiteOr(viewport, 0) - Math.max(0, finiteOr(element, 0)) - start - end)
}

function boundsFor(bounds: RoomFloatingBounds) {
  const safeArea = bounds.safeArea ?? {}
  const left = safeInset(safeArea.left)
  const right = safeInset(safeArea.right)
  const top = safeInset(safeArea.top)
  const bottom = safeInset(safeArea.bottom)
  return {
    left,
    right,
    top,
    bottom,
    horizontal: availableLength(bounds.viewportWidth, bounds.elementWidth, left, right),
    vertical: availableLength(bounds.viewportHeight, bounds.elementHeight, top, bottom),
  }
}

export function clampRoomFloatingPosition(
  position: RoomFloatingPosition,
  bounds: RoomFloatingBounds,
): RoomFloatingPosition {
  const resolved = boundsFor(bounds)
  const pixels = {
    left: resolved.left + clampUnit(position.x) * resolved.horizontal,
    top: resolved.top + clampUnit(position.y) * resolved.vertical,
  }
  return roomFloatingPositionFromPixels(pixels, bounds)
}

export function roomFloatingPositionToPixels(
  position: RoomFloatingPosition,
  bounds: RoomFloatingBounds,
): RoomFloatingPixels {
  const resolved = boundsFor(bounds)
  const clamped = clampRoomFloatingPosition(position, bounds)
  return {
    left: resolved.left + clamped.x * resolved.horizontal,
    top: resolved.top + clamped.y * resolved.vertical,
  }
}

export function roomFloatingPositionFromPixels(
  pixels: RoomFloatingPixels,
  bounds: RoomFloatingBounds,
): RoomFloatingPosition {
  const resolved = boundsFor(bounds)
  return {
    x:
      resolved.horizontal === 0
        ? 0
        : clampUnit((finiteOr(pixels.left, resolved.left) - resolved.left) / resolved.horizontal),
    y:
      resolved.vertical === 0
        ? 0
        : clampUnit((finiteOr(pixels.top, resolved.top) - resolved.top) / resolved.vertical),
  }
}

function browserStorage(): PositionStorage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isStoredPosition(value: unknown): value is RoomFloatingPosition {
  if (!value || typeof value !== "object") return false
  const candidate = value as { version?: unknown; x?: unknown; y?: unknown }
  return (
    candidate.version === ROOM_FLOATING_POSITION_VERSION &&
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y)
  )
}

export function loadRoomFloatingPosition(
  storage: PositionStorage | null = browserStorage(),
): RoomFloatingPosition {
  if (!storage) return { ...DEFAULT_ROOM_FLOATING_POSITION }
  try {
    const raw = storage.getItem(ROOM_FLOATING_POSITION_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_ROOM_FLOATING_POSITION }
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredPosition(parsed)) return { ...DEFAULT_ROOM_FLOATING_POSITION }
    return { x: clampUnit(parsed.x), y: clampUnit(parsed.y) }
  } catch {
    return { ...DEFAULT_ROOM_FLOATING_POSITION }
  }
}

export function saveRoomFloatingPosition(
  position: RoomFloatingPosition,
  storage: PositionStorage | null = browserStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(
      ROOM_FLOATING_POSITION_STORAGE_KEY,
      JSON.stringify({
        version: ROOM_FLOATING_POSITION_VERSION,
        x: clampUnit(position.x),
        y: clampUnit(position.y),
      }),
    )
  } catch {
    // Storage can be disabled or unavailable in privacy modes. The launcher remains usable.
  }
}
