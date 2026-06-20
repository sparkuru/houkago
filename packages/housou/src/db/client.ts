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
