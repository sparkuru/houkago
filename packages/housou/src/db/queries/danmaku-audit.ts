import { db } from "../client"

export type DanmakuAuditRecord = {
  id: string
  action: string
  actorSeitoId?: string
  subjectType: string
  subjectId: string
  details?: Record<string, unknown>
  dedupeKey?: string
  createdAt: number
}

type AuditRow = {
  id: string
  action: string
  actor_seito_id: string | null
  subject_type: string
  subject_id: string
  details_json: string | null
  dedupe_key: string | null
  created_at: number
}

const insertStmt = db.query(
  `INSERT INTO danmaku_audit
     (id, action, actor_seito_id, subject_type, subject_id, details_json, dedupe_key, created_at)
   VALUES ($id, $action, $actorSeitoId, $subjectType, $subjectId, $detailsJson, $dedupeKey, $createdAt)`,
)
const insertIgnoreStmt = db.query(
  `INSERT OR IGNORE INTO danmaku_audit
     (id, action, actor_seito_id, subject_type, subject_id, details_json, dedupe_key, created_at)
   VALUES ($id, $action, $actorSeitoId, $subjectType, $subjectId, $detailsJson, $dedupeKey, $createdAt)`,
)
const bySubjectStmt = db.query<AuditRow, { $subjectType: string; $subjectId: string }>(
  `SELECT id, action, actor_seito_id, subject_type, subject_id, details_json, dedupe_key, created_at
   FROM danmaku_audit
   WHERE subject_type = $subjectType AND subject_id = $subjectId
   ORDER BY created_at ASC, id ASC`,
)
const byIdStmt = db.query<AuditRow, { $id: string }>(
  `SELECT id, action, actor_seito_id, subject_type, subject_id, details_json, dedupe_key, created_at
   FROM danmaku_audit WHERE id = $id`,
)

export function insertDanmakuAudit(record: DanmakuAuditRecord): boolean {
  return insertStmt.run(auditParams(record)).changes > 0
}

export function insertDanmakuAuditIfAbsent(record: DanmakuAuditRecord): boolean {
  return insertIgnoreStmt.run(auditParams(record)).changes > 0
}

export function listDanmakuAudit(subjectType: string, subjectId: string): DanmakuAuditRecord[] {
  return bySubjectStmt.all({ $subjectType: subjectType, $subjectId: subjectId }).map(toDomain)
}

export function findDanmakuAudit(id: string): DanmakuAuditRecord | null {
  const row = byIdStmt.get({ $id: id })
  return row ? toDomain(row) : null
}

function auditParams(record: DanmakuAuditRecord) {
  return {
    $id: record.id,
    $action: record.action,
    $actorSeitoId: record.actorSeitoId ?? null,
    $subjectType: record.subjectType,
    $subjectId: record.subjectId,
    $detailsJson: record.details === undefined ? null : JSON.stringify(record.details),
    $dedupeKey: record.dedupeKey ?? null,
    $createdAt: record.createdAt,
  }
}

function toDomain(row: AuditRow): DanmakuAuditRecord {
  const details = parseDetails(row.details_json)
  return {
    id: row.id,
    action: row.action,
    ...(row.actor_seito_id === null ? {} : { actorSeitoId: row.actor_seito_id }),
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    ...(details === undefined ? {} : { details }),
    ...(row.dedupe_key === null ? {} : { dedupeKey: row.dedupe_key }),
    createdAt: row.created_at,
  }
}

function parseDetails(value: string | null): Record<string, unknown> | undefined {
  if (value === null) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
    return Object.fromEntries(Object.entries(parsed))
  } catch {
    return undefined
  }
}
