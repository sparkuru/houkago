// 部室 id 净化：users paste the whole room URL or a "bushitsu/<uuid>" path into
// the join field. A dirty id with slashes breaks housou's routing/lookup (500
// instead of a clean 404), so reduce any input to the trailing path segment.
// Pure so it is unit-testable without a router/store.
export function normalizeRoomId(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  // drop query string / hash so they never end up inside the id
  const withoutQuery = trimmed.split(/[?#]/)[0] ?? ""
  const segments = withoutQuery.split("/").filter((s) => s.length > 0)
  return segments[segments.length - 1] ?? ""
}
