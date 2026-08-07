import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Single Database instance per process (database-guidelines). Import this
// everywhere; do not open ad-hoc connections.
const DB_PATH = process.env.HOUSOU_DB ?? "houkago.db"

export const db = new Database(DB_PATH)
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA foreign_keys = ON;")

// Bootstrap: apply idempotent schema (CREATE TABLE IF NOT EXISTS) immediately,
// before any query module prepares its statements at import time. Runs once on
// module load so tables exist regardless of import order.
const here = dirname(fileURLToPath(import.meta.url))
db.exec(readFileSync(join(here, "schema.sql"), "utf8"))

// Authenticated ownership cannot safely interpret UUID-owned legacy rooms.
// Require the operator-approved database reset instead of silently retaining
// records whose host ids are not Houkago accounts.
const legacyRoom = db
  .query<{ id: string }, []>(
    "SELECT b.id FROM bushitsu b LEFT JOIN seito s ON s.id = b.buchou_id WHERE s.id IS NULL LIMIT 1",
  )
  .get()
if (legacyRoom) {
  throw new Error(
    "legacy UUID room data detected; reset HOUSOU_DB before starting authenticated Houkago",
  )
}

db.exec(
  `INSERT OR IGNORE INTO bushitsu_buin (bushitsu_id, seito_id, joined_at)
   SELECT b.id, b.buchou_id, b.created_at
   FROM bushitsu b JOIN seito s ON s.id = b.buchou_id`,
)

const bushitsuColumns = new Set(
  db
    .query<{ name: string }, []>("PRAGMA table_info(bushitsu)")
    .all()
    .map((column) => column.name),
)
if (!bushitsuColumns.has("kengen_json")) {
  db.exec("ALTER TABLE bushitsu ADD COLUMN kengen_json TEXT")
}

const enmokuColumns = new Set(
  db
    .query<{ name: string }, []>("PRAGMA table_info(enmoku)")
    .all()
    .map((column) => column.name),
)
for (const [name, type] of [
  ["headers_json", "TEXT"],
  ["subtitles_json", "TEXT"],
  ["sources_json", "TEXT"],
  ["danmaku_json", "TEXT"],
  ["provider_json", "TEXT"],
  ["live", "INTEGER"],
] as const) {
  if (!enmokuColumns.has(name)) db.exec(`ALTER TABLE enmoku ADD COLUMN ${name} ${type}`)
}

// Additive queue-placement upgrade. Existing rooms used Enmoku creation order;
// preserve that deterministic order while making future moves durable.
db.exec(
  `INSERT OR IGNORE INTO bangumi_entry (enmoku_id, bushitsu_id, sort_key)
   SELECT id, bushitsu_id,
     ROW_NUMBER() OVER (PARTITION BY bushitsu_id ORDER BY created_at ASC, id ASC) - 1
   FROM enmoku`,
)
