import type { KousokuMessage } from "houkago-kousoku"

type PresentMember = Extract<KousokuMessage, { type: "SHUSSEKI" }>["payload"]["members"][number]

export type BuinPresence = PresentMember & {
  joinedAt: number
  lastSeenAt: number
  online: boolean
}

export function projectMemberPresence(
  previous: Readonly<Record<string, BuinPresence>>,
  members: readonly PresentMember[],
  serverTime: number,
): Record<string, BuinPresence> {
  const next = { ...previous }
  const onlineIds = new Set(members.map((member) => member.id))
  for (const member of Object.values(previous)) {
    if (!onlineIds.has(member.id) && member.online) {
      next[member.id] = { ...member, online: false, lastSeenAt: serverTime }
    }
  }
  for (const member of members) {
    const existing = previous[member.id]
    next[member.id] = {
      ...member,
      joinedAt: existing?.online ? existing.joinedAt : serverTime,
      lastSeenAt: serverTime,
      online: true,
    }
  }
  return next
}

export function onlineMembers(presence: Readonly<Record<string, BuinPresence>>): BuinPresence[] {
  return Object.values(presence)
    .filter((member) => member.online)
    .sort((left, right) => left.joinedAt - right.joinedAt)
}

export function historicalMembers(
  presence: Readonly<Record<string, BuinPresence>>,
): BuinPresence[] {
  return Object.values(presence)
    .filter((member) => !member.online)
    .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
}

export type DurationUnitLabels = {
  hour: string
  minute: string
  second: string
}

export function formatOnlineDuration(
  startedAt: number,
  now: number,
  labels: DurationUnitLabels,
): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}${labels.hour}${minutes}${labels.minute}`
  if (minutes > 0) return `${minutes}${labels.minute}${seconds}${labels.second}`
  return `${seconds}${labels.second}`
}

export function formatLastSeen(lastSeenAt: number, locale = "zh-CN"): string {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(lastSeenAt))
}
