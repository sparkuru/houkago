import type { Enmoku } from "houkago-kousoku"
import { db } from "../client"

// scaffold stores only the minimal direct-link fields. headers / subtitles /
// sources / danmaku are produced by eisha in later phases (design §6) and are
// not persisted here yet.
type EnmokuRow = {
  id: string
  bushitsu_id: string
  title: string
  type: Enmoku["type"]
  url: string
  added_by: string
  created_at: number
}

function toDomain(row: EnmokuRow): Enmoku {
  return {
    id: row.id,
    bushitsuId: row.bushitsu_id,
    title: row.title,
    type: row.type,
    url: row.url,
    addedBy: row.added_by,
  }
}

const insertStmt = db.query(
  `INSERT INTO enmoku (id, bushitsu_id, title, type, url, added_by, created_at)
   VALUES ($id, $bushitsuId, $title, $type, $url, $addedBy, $createdAt)`,
)

const listStmt = db.query<EnmokuRow, { $bushitsuId: string }>(
  `SELECT id, bushitsu_id, title, type, url, added_by, created_at
   FROM enmoku WHERE bushitsu_id = $bushitsuId ORDER BY created_at ASC`,
)

// 演目を投稿する：add an Enmoku to a 部室.
export function insertEnmoku(e: Enmoku, createdAt: number): void {
  insertStmt.run({
    $id: e.id,
    $bushitsuId: e.bushitsuId,
    $title: e.title,
    $type: e.type,
    $url: e.url,
    $addedBy: e.addedBy,
    $createdAt: createdAt,
  })
}

// 番組表：list a room's enmoku in submission order.
export function listEnmoku(bushitsuId: string): Enmoku[] {
  return listStmt.all({ $bushitsuId: bushitsuId }).map(toDomain)
}
