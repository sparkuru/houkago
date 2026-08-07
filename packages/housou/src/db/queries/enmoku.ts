import type { Enmoku } from "houkago-kousoku"
import { db } from "../client"

type EnmokuRow = {
  id: string
  bushitsu_id: string
  title: string
  type: Enmoku["type"]
  url: string
  headers_json: string | null
  subtitles_json: string | null
  sources_json: string | null
  danmaku_json: string | null
  provider_json: string | null
  live: number | null
  added_by: string
  created_at: number
}

function toDomain(row: EnmokuRow): Enmoku {
  const enmoku: Enmoku = {
    id: row.id,
    bushitsuId: row.bushitsu_id,
    title: row.title,
    type: row.type,
    url: row.url,
    addedBy: row.added_by,
  }
  const headers = parseJson(row.headers_json, isHeaderRecord)
  const subtitles = parseJson(row.subtitles_json, isSubtitleRecord)
  const sources = parseJson(row.sources_json, isSources)
  const danmaku = parseJson(row.danmaku_json, isDanmakuRef)
  const provider = parseJson(row.provider_json, isProvider)
  if (headers) enmoku.headers = headers
  if (subtitles) enmoku.subtitles = subtitles
  if (sources) enmoku.sources = sources
  if (danmaku) enmoku.danmaku = danmaku
  if (provider) enmoku.provider = provider
  if (row.live !== null) enmoku.live = row.live === 1
  return enmoku
}

const insertStmt = db.query(
  `INSERT INTO enmoku (
     id, bushitsu_id, title, type, url, headers_json, subtitles_json,
     sources_json, danmaku_json, provider_json, live, added_by, created_at
   )
   VALUES (
     $id, $bushitsuId, $title, $type, $url, $headersJson, $subtitlesJson,
     $sourcesJson, $danmakuJson, $providerJson, $live, $addedBy, $createdAt
   )`,
)

const listStmt = db.query<EnmokuRow, { $bushitsuId: string }>(
  `SELECT
     e.id, e.bushitsu_id, e.title, e.type, e.url, e.headers_json, e.subtitles_json,
     e.sources_json, e.danmaku_json, e.provider_json, e.live, e.added_by, e.created_at
   FROM bangumi_entry be
   JOIN enmoku e ON e.id = be.enmoku_id
   WHERE be.bushitsu_id = $bushitsuId
   ORDER BY be.sort_key ASC, be.enmoku_id ASC`,
)

const deleteStmt = db.query("DELETE FROM enmoku WHERE id = $id AND bushitsu_id = $bushitsuId")

const insertEntryStmt = db.query(
  `INSERT INTO bangumi_entry (enmoku_id, bushitsu_id, sort_key)
   VALUES ($enmokuId, $bushitsuId, $sortKey)`,
)

const nextSortKeyStmt = db.query<{ sort_key: number }, { $bushitsuId: string }>(
  `SELECT COALESCE(MAX(sort_key), -1) + 1 AS sort_key
   FROM bangumi_entry WHERE bushitsu_id = $bushitsuId`,
)

type BangumiEntryRow = { enmoku_id: string; sort_key: number }

const entryStmt = db.query<BangumiEntryRow, { $bushitsuId: string; $enmokuId: string }>(
  `SELECT enmoku_id, sort_key FROM bangumi_entry
   WHERE bushitsu_id = $bushitsuId AND enmoku_id = $enmokuId`,
)

const neighbourStmt = db.query<BangumiEntryRow, { $bushitsuId: string; $sortKey: number }>(
  `SELECT enmoku_id, sort_key FROM bangumi_entry
   WHERE bushitsu_id = $bushitsuId AND sort_key < $sortKey
   ORDER BY sort_key DESC, enmoku_id DESC LIMIT 1`,
)

const neighbourDownStmt = db.query<BangumiEntryRow, { $bushitsuId: string; $sortKey: number }>(
  `SELECT enmoku_id, sort_key FROM bangumi_entry
   WHERE bushitsu_id = $bushitsuId AND sort_key > $sortKey
   ORDER BY sort_key ASC, enmoku_id ASC LIMIT 1`,
)

const updateSortKeyStmt = db.query(
  `UPDATE bangumi_entry SET sort_key = $sortKey
   WHERE bushitsu_id = $bushitsuId AND enmoku_id = $enmokuId`,
)

const clearPendingStmt = db.query(
  `DELETE FROM enmoku
   WHERE bushitsu_id = $bushitsuId
     AND ($currentEnmokuId IS NULL OR id != $currentEnmokuId)`,
)

const pendingCountStmt = db.query<
  { count: number },
  { $bushitsuId: string; $currentEnmokuId: string | null }
>(
  `SELECT COUNT(*) AS count FROM enmoku
   WHERE bushitsu_id = $bushitsuId
     AND ($currentEnmokuId IS NULL OR id != $currentEnmokuId)`,
)

// 演目を投稿する：add an Enmoku to a 部室.
export function insertEnmoku(e: Enmoku, createdAt: number): void {
  db.transaction(() => {
    insertStmt.run({
      $id: e.id,
      $bushitsuId: e.bushitsuId,
      $title: e.title,
      $type: e.type,
      $url: e.url,
      $headersJson: toJson(e.headers),
      $subtitlesJson: toJson(e.subtitles),
      $sourcesJson: toJson(e.sources),
      $danmakuJson: toJson(e.danmaku),
      $providerJson: toJson(e.provider),
      $live: e.live === undefined ? null : e.live ? 1 : 0,
      $addedBy: e.addedBy,
      $createdAt: createdAt,
    })
    const next = nextSortKeyStmt.get({ $bushitsuId: e.bushitsuId })
    insertEntryStmt.run({
      $enmokuId: e.id,
      $bushitsuId: e.bushitsuId,
      $sortKey: next?.sort_key ?? 0,
    })
  })()
}

// 番組表：list a room's enmoku in submission order.
export function listEnmoku(bushitsuId: string): Enmoku[] {
  return listStmt.all({ $bushitsuId: bushitsuId }).map(toDomain)
}

// 演目を消す：remove a room-owned Enmoku. Returns whether a row was deleted.
export function deleteEnmoku(bushitsuId: string, id: string): boolean {
  const result = deleteStmt.run({ $id: id, $bushitsuId: bushitsuId })
  return result.changes > 0
}

export type MoveDirection = "up" | "down"

// Swap a source with its immediate visible neighbour. The whole read/swap runs
// in one SQLite transaction, so concurrent moves serialize to a durable order.
export function moveEnmoku(bushitsuId: string, id: string, direction: MoveDirection): boolean {
  return db.transaction(() => {
    const entry = entryStmt.get({ $bushitsuId: bushitsuId, $enmokuId: id })
    if (!entry) return false
    const neighbour = (direction === "up" ? neighbourStmt : neighbourDownStmt).get({
      $bushitsuId: bushitsuId,
      $sortKey: entry.sort_key,
    })
    if (!neighbour) return true
    updateSortKeyStmt.run({
      $bushitsuId: bushitsuId,
      $enmokuId: entry.enmoku_id,
      $sortKey: neighbour.sort_key,
    })
    updateSortKeyStmt.run({
      $bushitsuId: bushitsuId,
      $enmokuId: neighbour.enmoku_id,
      $sortKey: entry.sort_key,
    })
    return true
  })()
}

// Clear every queue source except the server-authoritative current item. When
// no item is selected, all entries are pending and are removed.
export function clearPendingEnmoku(bushitsuId: string, currentEnmokuId: string | null): number {
  return db.transaction(() => {
    const params = { $bushitsuId: bushitsuId, $currentEnmokuId: currentEnmokuId }
    const count = pendingCountStmt.get(params)?.count ?? 0
    clearPendingStmt.run(params)
    return count
  })()
}

function toJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value)
}

function parseJson<T>(
  value: string | null,
  guard: (parsed: unknown) => parsed is T,
): T | undefined {
  if (value === null) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    return guard(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function isHeaderRecord(value: unknown): value is NonNullable<Enmoku["headers"]> {
  return isStringRecord(value)
}

function isSubtitleRecord(value: unknown): value is NonNullable<Enmoku["subtitles"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.values(value).every(
    (item) =>
      !!item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as { url?: unknown }).url === "string" &&
      typeof (item as { type?: unknown }).type === "string",
  )
}

function isSources(value: unknown): value is NonNullable<Enmoku["sources"]> {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof (item as { name?: unknown }).name === "string" &&
        typeof (item as { url?: unknown }).url === "string",
    )
  )
}

function isDanmakuRef(value: unknown): value is NonNullable<Enmoku["danmaku"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const ref = value as { type?: unknown; ref?: unknown }
  return (ref.type === "file" || ref.type === "fetch") && typeof ref.ref === "string"
}

function isProvider(value: unknown): value is NonNullable<Enmoku["provider"]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const provider = value as {
    kind?: unknown
    url?: unknown
    coverUrl?: unknown
    ownerName?: unknown
    stats?: unknown
  }
  if (provider.kind !== "bilibili" || typeof provider.url !== "string") return false
  if (provider.coverUrl !== undefined && typeof provider.coverUrl !== "string") return false
  if (provider.ownerName !== undefined && typeof provider.ownerName !== "string") return false
  if (provider.stats !== undefined && !isNumberRecord(provider.stats)) return false
  return true
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.values(value).every((item) => typeof item === "string")
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.values(value).every((item) => typeof item === "number")
}
