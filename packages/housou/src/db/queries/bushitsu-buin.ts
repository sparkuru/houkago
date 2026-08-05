import type { MeiboBuin } from "houkago-kousoku"
import { db } from "../client"

type MeiboRow = { id: string; username: string; joined_at: number; buchou_id: string }

const ensureStmt = db.query(
  `INSERT OR IGNORE INTO bushitsu_buin (bushitsu_id, seito_id, joined_at)
   VALUES ($bushitsuId, $seitoId, $joinedAt)`,
)
const hasStmt = db.query<{ found: number }, { $bushitsuId: string; $seitoId: string }>(
  "SELECT 1 AS found FROM bushitsu_buin WHERE bushitsu_id = $bushitsuId AND seito_id = $seitoId",
)
const listStmt = db.query<MeiboRow, { $bushitsuId: string }>(
  `SELECT s.id, s.username, bb.joined_at, b.buchou_id
   FROM bushitsu_buin bb
   JOIN seito s ON s.id = bb.seito_id
   JOIN bushitsu b ON b.id = bb.bushitsu_id
   WHERE bb.bushitsu_id = $bushitsuId
   ORDER BY bb.joined_at ASC, s.username ASC`,
)
const deleteStmt = db.query(
  "DELETE FROM bushitsu_buin WHERE bushitsu_id = $bushitsuId AND seito_id = $seitoId",
)

export function ensureBuin(bushitsuId: string, seitoId: string, joinedAt = Date.now()): void {
  ensureStmt.run({ $bushitsuId: bushitsuId, $seitoId: seitoId, $joinedAt: joinedAt })
}

export function hasBuin(bushitsuId: string, seitoId: string): boolean {
  return Boolean(hasStmt.get({ $bushitsuId: bushitsuId, $seitoId: seitoId }))
}

export function listMeibo(bushitsuId: string): MeiboBuin[] {
  return listStmt.all({ $bushitsuId: bushitsuId }).map((row) => ({
    id: row.id,
    username: row.username,
    joinedAt: row.joined_at,
    yakuwari: row.id === row.buchou_id ? "buchou" : "buin",
  }))
}

export function deleteBuin(bushitsuId: string, seitoId: string): boolean {
  return deleteStmt.run({ $bushitsuId: bushitsuId, $seitoId: seitoId }).changes > 0
}
