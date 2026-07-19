import type { Seito } from "houkago-kousoku"
import { db } from "../client"

type SeitoRow = {
  id: string
  username: string
  username_norm: string
  password_hash: string
  created_at: number
}

function publicSeito(row: SeitoRow): Seito {
  return { id: row.id, username: row.username, createdAt: row.created_at }
}

const insert = db.query(`INSERT INTO seito (id, username, username_norm, password_hash, created_at)
  VALUES ($id, $username, $usernameNorm, $passwordHash, $createdAt)`)
const byName = db.query<SeitoRow, { $usernameNorm: string }>(
  "SELECT id, username, username_norm, password_hash, created_at FROM seito WHERE username_norm = $usernameNorm",
)
const byId = db.query<SeitoRow, { $id: string }>(
  "SELECT id, username, username_norm, password_hash, created_at FROM seito WHERE id = $id",
)

export function insertSeito(row: {
  id: string
  username: string
  usernameNorm: string
  passwordHash: string
  createdAt: number
}): Seito {
  insert.run({
    $id: row.id,
    $username: row.username,
    $usernameNorm: row.usernameNorm,
    $passwordHash: row.passwordHash,
    $createdAt: row.createdAt,
  })
  return { id: row.id, username: row.username, createdAt: row.createdAt }
}

export function findSeitoByUsername(
  usernameNorm: string,
): (Seito & { passwordHash: string }) | null {
  const row = byName.get({ $usernameNorm: usernameNorm })
  return row ? { ...publicSeito(row), passwordHash: row.password_hash } : null
}

export function findSeitoById(id: string): Seito | null {
  const row = byId.get({ $id: id })
  return row ? publicSeito(row) : null
}
