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
