import type { KomonGrant } from "houkago-kousoku"
import { db } from "../client"

type KomonRow = {
  id: string
  seito_id: string
  granted_at: number
  granted_by: string | null
  revoked_at: number | null
}

const columns = "id, seito_id, granted_at, granted_by, revoked_at"
const bySeitoStmt = db.query<KomonRow, { $seitoId: string }>(
  `SELECT ${columns} FROM komon WHERE seito_id = $seitoId`,
)
const activeBySeitoStmt = db.query<KomonRow, { $seitoId: string }>(
  `SELECT ${columns} FROM komon WHERE seito_id = $seitoId AND revoked_at IS NULL`,
)
const listStmt = db.query<KomonRow, []>(
  `SELECT ${columns} FROM komon ORDER BY granted_at ASC, id ASC`,
)
const insertStmt = db.query(
  `INSERT INTO komon (id, seito_id, granted_at, granted_by, revoked_at)
   VALUES ($id, $seitoId, $grantedAt, $grantedBy, NULL)`,
)
const revokeStmt = db.query(
  `UPDATE komon SET revoked_at = $revokedAt
   WHERE seito_id = $seitoId AND revoked_at IS NULL`,
)
const restoreStmt = db.query("UPDATE komon SET revoked_at = NULL WHERE seito_id = $seitoId")

export function insertKomonGrant(grant: {
  id: string
  seitoId: string
  grantedAt: number
  grantedBy?: string
}): void {
  insertStmt.run({
    $id: grant.id,
    $seitoId: grant.seitoId,
    $grantedAt: grant.grantedAt,
    $grantedBy: grant.grantedBy ?? null,
  })
}

export function findKomonBySeitoId(seitoId: string): KomonGrant | null {
  const row = bySeitoStmt.get({ $seitoId: seitoId })
  return row ? toDomain(row) : null
}

export function findActiveKomonBySeitoId(seitoId: string): KomonGrant | null {
  const row = activeBySeitoStmt.get({ $seitoId: seitoId })
  return row ? toDomain(row) : null
}

export function listKomonGrants(): KomonGrant[] {
  return listStmt.all().map(toDomain)
}

export function revokeKomonGrant(seitoId: string, revokedAt = Date.now()): boolean {
  return revokeStmt.run({ $seitoId: seitoId, $revokedAt: revokedAt }).changes > 0
}

export function restoreKomonGrant(seitoId: string): boolean {
  return restoreStmt.run({ $seitoId: seitoId }).changes > 0
}

function toDomain(row: KomonRow): KomonGrant {
  return {
    id: row.id,
    seitoId: row.seito_id,
    grantedAt: row.granted_at,
    ...(row.granted_by === null ? {} : { grantedBy: row.granted_by }),
    ...(row.revoked_at === null ? {} : { revokedAt: row.revoked_at }),
  }
}
