import type { NyuushitsuMode, NyuushitsuRequest } from "houkago-kousoku"

// 入室制御: per-room, in-memory admission mode + pending approval queue.
// Mirrors kengen's room-level state, but pending sockets can keep this state alive
// while the 部長 is offline so approval requests survive until the 部長 returns.

export const DEFAULT_NYUUSHITSU_MODE: NyuushitsuMode = "open"

type PendingRequest = NyuushitsuRequest & { connIds: Set<string> }

const modes = new Map<string, NyuushitsuMode>()
const passwords = new Map<string, string>()
const pending = new Map<string, Map<string, PendingRequest>>()

export function getNyuushitsuMode(bushitsuId: string): NyuushitsuMode {
  return modes.get(bushitsuId) ?? DEFAULT_NYUUSHITSU_MODE
}

export function getNyuushitsuPassword(bushitsuId: string): string {
  return passwords.get(bushitsuId) ?? ""
}

export function setNyuushitsuMode(
  bushitsuId: string,
  mode: NyuushitsuMode,
  password?: string,
): void {
  modes.set(bushitsuId, mode)
  if (mode !== "password") {
    passwords.delete(bushitsuId)
  } else if (password !== undefined) {
    passwords.set(bushitsuId, password)
  }
}

export function addPendingNyuushitsu(
  bushitsuId: string,
  connId: string,
  senderId: string,
  nickname: string,
  requestedAt = Date.now(),
): NyuushitsuRequest {
  let room = pending.get(bushitsuId)
  if (!room) {
    room = new Map<string, PendingRequest>()
    pending.set(bushitsuId, room)
  }
  const existing = room.get(senderId)
  if (existing) {
    existing.connIds.add(connId)
    existing.nickname = nickname
    return toRequest(existing)
  }
  const request = { senderId, nickname, requestedAt, connIds: new Set([connId]) }
  room.set(senderId, request)
  return toRequest(request)
}

export function pendingNyuushitsuRequests(bushitsuId: string): NyuushitsuRequest[] {
  return [...(pending.get(bushitsuId)?.values() ?? [])].map(toRequest)
}

export function pendingNyuushitsuCount(bushitsuId: string): number {
  return pending.get(bushitsuId)?.size ?? 0
}

export function takePendingNyuushitsu(bushitsuId: string, senderId: string): string[] {
  const room = pending.get(bushitsuId)
  const request = room?.get(senderId)
  if (!room || !request) return []
  room.delete(senderId)
  if (room.size === 0) pending.delete(bushitsuId)
  return [...request.connIds]
}

export function removePendingNyuushitsuConnection(
  bushitsuId: string,
  senderId: string,
  connId: string,
): void {
  const room = pending.get(bushitsuId)
  const request = room?.get(senderId)
  if (!room || !request) return
  request.connIds.delete(connId)
  if (request.connIds.size > 0) return
  room.delete(senderId)
  if (room.size === 0) pending.delete(bushitsuId)
}

export function clearNyuushitsu(bushitsuId: string): void {
  modes.delete(bushitsuId)
  passwords.delete(bushitsuId)
  pending.delete(bushitsuId)
}

function toRequest(request: PendingRequest): NyuushitsuRequest {
  return {
    senderId: request.senderId,
    nickname: request.nickname,
    requestedAt: request.requestedAt,
  }
}
