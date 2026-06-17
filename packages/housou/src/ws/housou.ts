import type { KousokuMessage, KousokuMessageType, Yakuwari } from "houkago-kousoku"

// 放送（housou）: broadcast helpers over room:<bushitsuId> Bun pub/sub topics
// (quality-guidelines). Centralises topic naming and server-stamped envelope
// construction so handlers stay thin.

export function roomTopic(bushitsuId: string): string {
  return `room:${bushitsuId}`
}

// Build a server-originated envelope (ts stamped, senderId "server").
export function serverMsg<T extends KousokuMessage>(
  type: T["type"] & KousokuMessageType,
  payload: T["payload"],
): T {
  return { type, ts: Date.now(), senderId: "server", payload } as T
}

// 出席（shusseki）: per-room presence, maintained on WS open/close. The roster
// (名簿) maps senderId→nickname so SHUSSEKI can carry a full member snapshot; the
// count is the roster size. Both share the WS open/close lifecycle (in-memory).
const roster = new Map<string, Map<string, string>>()

export type Member = { id: string; nickname: string; yakuwari: Yakuwari }

export function join(bushitsuId: string, senderId: string, nickname: string): void {
  let room = roster.get(bushitsuId)
  if (!room) {
    room = new Map<string, string>()
    roster.set(bushitsuId, room)
  }
  room.set(senderId, nickname)
}

export function leave(bushitsuId: string, senderId: string): void {
  const room = roster.get(bushitsuId)
  if (!room) return
  room.delete(senderId)
  if (room.size === 0) {
    roster.delete(bushitsuId)
  }
}

// Roster snapshot with each member's yakuwari. Role is two-tier (prd Decision):
// the member whose id is the room's buchouId is 部長; everyone else is ゲスト
// (kengaku). The caller passes buchouId (known from fetchBushitsu) so this stays
// pure over the in-memory roster without a DB dependency here.
export function members(bushitsuId: string, buchouId: string): Member[] {
  const room = roster.get(bushitsuId)
  if (!room) return []
  return [...room].map(([id, nickname]) => ({
    id,
    nickname,
    yakuwari: id === buchouId ? "buchou" : "kengaku",
  }))
}

export function shusseki(bushitsuId: string): number {
  return roster.get(bushitsuId)?.size ?? 0
}

// 活動中の部室: rooms with at least one connected 部員, for the periodic heartbeat
// to iterate (tenko). roster is pruned to non-empty rooms, so map keys suffice.
export function activeRooms(): string[] {
  return [...roster.keys()]
}
