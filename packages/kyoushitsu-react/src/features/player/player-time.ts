export function formatPlayerTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const minutes = Math.floor(total / 60)
  const tail = String(total % 60).padStart(2, "0")
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${tail}`
    : `${String(minutes).padStart(2, "0")}:${tail}`
}
