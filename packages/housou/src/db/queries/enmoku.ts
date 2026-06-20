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
  if (headers) enmoku.headers = headers
  if (subtitles) enmoku.subtitles = subtitles
  if (sources) enmoku.sources = sources
  if (danmaku) enmoku.danmaku = danmaku
  if (row.live !== null) enmoku.live = row.live === 1
  return enmoku
}

const insertStmt = db.query(
  `INSERT INTO enmoku (
     id, bushitsu_id, title, type, url, headers_json, subtitles_json,
     sources_json, danmaku_json, live, added_by, created_at
   )
   VALUES (
     $id, $bushitsuId, $title, $type, $url, $headersJson, $subtitlesJson,
     $sourcesJson, $danmakuJson, $live, $addedBy, $createdAt
   )`,
)

const listStmt = db.query<EnmokuRow, { $bushitsuId: string }>(
  `SELECT
     id, bushitsu_id, title, type, url, headers_json, subtitles_json,
     sources_json, danmaku_json, live, added_by, created_at
   FROM enmoku WHERE bushitsu_id = $bushitsuId ORDER BY created_at ASC`,
)

const deleteStmt = db.query("DELETE FROM enmoku WHERE id = $id AND bushitsu_id = $bushitsuId")

// 演目を投稿する：add an Enmoku to a 部室.
export function insertEnmoku(e: Enmoku, createdAt: number): void {
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
    $live: e.live === undefined ? null : e.live ? 1 : 0,
    $addedBy: e.addedBy,
    $createdAt: createdAt,
  })
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

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return Object.values(value).every((item) => typeof item === "string")
}
