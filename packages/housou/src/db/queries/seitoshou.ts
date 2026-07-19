import { db } from "../client"

const insert = db.query(`INSERT INTO seitoshou (token_digest, seito_id, created_at, expires_at)
  VALUES ($tokenDigest, $seitoId, $createdAt, $expiresAt)`)
const find = db.query<{ seito_id: string; expires_at: number }, { $tokenDigest: string }>(
  "SELECT seito_id, expires_at FROM seitoshou WHERE token_digest = $tokenDigest",
)
const remove = db.query("DELETE FROM seitoshou WHERE token_digest = $tokenDigest")
const purge = db.query("DELETE FROM seitoshou WHERE expires_at <= $now")

export function insertSeitoshou(session: {
  tokenDigest: string
  seitoId: string
  createdAt: number
  expiresAt: number
}): void {
  insert.run({
    $tokenDigest: session.tokenDigest,
    $seitoId: session.seitoId,
    $createdAt: session.createdAt,
    $expiresAt: session.expiresAt,
  })
}
export function findSeitoshou(tokenDigest: string): { seitoId: string; expiresAt: number } | null {
  const row = find.get({ $tokenDigest: tokenDigest })
  return row ? { seitoId: row.seito_id, expiresAt: row.expires_at } : null
}
export function removeSeitoshou(tokenDigest: string): void {
  remove.run({ $tokenDigest: tokenDigest })
}
export function purgeExpiredSeitoshou(now: number): void {
  purge.run({ $now: now })
}
