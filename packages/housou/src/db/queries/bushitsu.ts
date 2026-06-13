import type { Bushitsu } from "houkago-kousoku"
import { db } from "../client"

// Raw row shape (snake_case). Mapped to the domain type at this boundary so the
// rest of the app never sees column names (database-guidelines).
type BushitsuRow = {
  id: string
  name: string
  buchou_id: string
  created_at: number
}

function toDomain(row: BushitsuRow): Bushitsu {
  return {
    id: row.id,
    name: row.name,
    buchouId: row.buchou_id,
    createdAt: row.created_at,
  }
}

const insertStmt = db.query(
  `INSERT INTO bushitsu (id, name, buchou_id, created_at)
   VALUES ($id, $name, $buchouId, $createdAt)`,
)

const getStmt = db.query<BushitsuRow, { $id: string }>(
  "SELECT id, name, buchou_id, created_at FROM bushitsu WHERE id = $id",
)

// 部室を作る：persist a new room.
export function insertBushitsu(b: Bushitsu): void {
  insertStmt.run({
    $id: b.id,
    $name: b.name,
    $buchouId: b.buchouId,
    $createdAt: b.createdAt,
  })
}

// 部室を取る：read a room by id, or null if absent.
export function getBushitsu(id: string): Bushitsu | null {
  const row = getStmt.get({ $id: id })
  return row ? toDomain(row) : null
}
