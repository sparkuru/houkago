import type { KousokuMessage, KousokuMessageType } from "houkago-kousoku"

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

// 出席（shusseki）: per-room presence count, maintained on WS open/close.
const presence = new Map<string, number>()

export function nyuubu(bushitsuId: string): number {
  const n = (presence.get(bushitsuId) ?? 0) + 1
  presence.set(bushitsuId, n)
  return n
}

export function taibu(bushitsuId: string): number {
  const n = Math.max(0, (presence.get(bushitsuId) ?? 0) - 1)
  if (n === 0) presence.delete(bushitsuId)
  else presence.set(bushitsuId, n)
  return n
}

export function shusseki(bushitsuId: string): number {
  return presence.get(bushitsuId) ?? 0
}

// 活動中の部室: rooms with at least one connected 部員, for the periodic heartbeat
// to iterate (tenko). presence is pruned to >0 entries, so map keys suffice.
export function activeRooms(): string[] {
  return [...presence.keys()]
}
