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

const baiduConnectionColumns = new Set(
  db
    .query<{ name: string }, []>("PRAGMA table_info(baidu_connection)")
    .all()
    .map((column) => column.name),
)
if (!baiduConnectionColumns.has("adaptor_device_id")) {
  db.exec("ALTER TABLE baidu_connection ADD COLUMN adaptor_device_id TEXT")
}
if (!baiduConnectionColumns.has("authorization_id")) {
  db.exec("ALTER TABLE baidu_connection ADD COLUMN authorization_id TEXT")
}

const baiduSourceColumns = new Set(
  db
    .query<{ name: string }, []>("PRAGMA table_info(baidu_source)")
    .all()
    .map((column) => column.name),
)
if (!baiduSourceColumns.has("adaptor_device_id")) {
  db.exec("ALTER TABLE baidu_source ADD COLUMN adaptor_device_id TEXT")
}
if (!baiduSourceColumns.has("authorization_id")) {
  db.exec("ALTER TABLE baidu_source ADD COLUMN authorization_id TEXT")
}

// Additive queue-placement upgrade. Existing rooms used Enmoku creation order;
// preserve that deterministic order while making future moves durable.
db.exec(
  `INSERT OR IGNORE INTO bangumi_entry (enmoku_id, bushitsu_id, sort_key)
   SELECT id, bushitsu_id,
     ROW_NUMBER() OVER (PARTITION BY bushitsu_id ORDER BY created_at ASC, id ASC) - 1
   FROM enmoku`,
)

bootstrapKomon()

function bootstrapKomon(): void {
  const configured = [
    ...new Set(
      (process.env.HOUKAGO_KOMON_USERNAMES ?? "")
        .split(",")
        .map((username) => username.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
  if (configured.length === 0) return

  const findSeito = db.query<{ id: string }, { $usernameNorm: string }>(
    "SELECT id FROM seito WHERE username_norm = $usernameNorm",
  )
  const accounts = configured.map((usernameNorm) => {
    const rows = findSeito.all({ $usernameNorm: usernameNorm })
    if (rows.length !== 1) {
      throw new Error(
        `HOUKAGO_KOMON_USERNAMES account is missing or ambiguous: ${usernameNorm}; register it before startup`,
      )
    }
    const account = rows[0]
    if (!account) {
      throw new Error(
        `HOUKAGO_KOMON_USERNAMES account is missing or ambiguous: ${usernameNorm}; register it before startup`,
      )
    }
    return { usernameNorm, seitoId: account.id }
  })

  const findGrant = db.query<{ id: string; revoked_at: number | null }, { $seitoId: string }>(
    "SELECT id, revoked_at FROM komon WHERE seito_id = $seitoId",
  )
  const insertGrant = db.query(
    `INSERT INTO komon (id, seito_id, granted_at, granted_by, revoked_at)
     VALUES ($id, $seitoId, $grantedAt, NULL, NULL)`,
  )
  const restoreGrant = db.query("UPDATE komon SET revoked_at = NULL WHERE seito_id = $seitoId")
  const insertAudit = db.query(
    `INSERT OR IGNORE INTO danmaku_audit
       (id, action, actor_seito_id, subject_type, subject_id, details_json, dedupe_key, created_at)
     VALUES ($id, $action, NULL, 'komon', $subjectId, $detailsJson, $dedupeKey, $createdAt)`,
  )
  const now = Date.now()

  db.transaction(() => {
    for (const account of accounts) {
      const existing = findGrant.get({ $seitoId: account.seitoId })
      if (!existing) {
        insertGrant.run({
          $id: crypto.randomUUID(),
          $seitoId: account.seitoId,
          $grantedAt: now,
        })
        insertAudit.run({
          $id: crypto.randomUUID(),
          $action: "komon_granted",
          $subjectId: account.seitoId,
          $detailsJson: JSON.stringify({ source: "HOUKAGO_KOMON_USERNAMES" }),
          $dedupeKey: `komon-bootstrap:${account.seitoId}`,
          $createdAt: now,
        })
      } else if (existing.revoked_at !== null) {
        restoreGrant.run({ $seitoId: account.seitoId })
        insertAudit.run({
          $id: crypto.randomUUID(),
          $action: "komon_restored",
          $subjectId: account.seitoId,
          $detailsJson: JSON.stringify({ source: "HOUKAGO_KOMON_USERNAMES" }),
          $dedupeKey: `komon-restore:${account.seitoId}:${now}`,
          $createdAt: now,
        })
      }
    }
  })()
}
