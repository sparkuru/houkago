import type { Seito } from "houkago-kousoku"
import { findSeitoById, findSeitoByUsername, insertSeito } from "../db/queries/seito"
import {
  findSeitoshou,
  insertSeitoshou,
  purgeExpiredSeitoshou,
  removeSeitoshou,
} from "../db/queries/seitoshou"
import { Unauthorized } from "./errors"
import { newId } from "./id"

const SESSION_MS = 1000 * 60 * 60 * 24 * 14
const USERNAME = /^[a-zA-Z0-9_]{3,32}$/
export const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128

export class SeitoConflict extends Error {
  code = "SEITO_CONFLICT" as const
}
export class SeitoInvalid extends Error {
  code = "SEITO_INVALID" as const
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export async function registerSeito(username: string, password: string): Promise<Seito> {
  const clean = username.trim()
  const norm = normalizeUsername(clean)
  if (
    !USERNAME.test(clean) ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new SeitoInvalid("username or password is invalid")
  }
  if (findSeitoByUsername(norm)) throw new SeitoConflict("username is unavailable")
  const passwordHash = await Bun.password.hash(password, { algorithm: "argon2id" })
  return insertSeito({
    id: newId(),
    username: clean,
    usernameNorm: norm,
    passwordHash,
    createdAt: Date.now(),
  })
}

export async function signInSeito(username: string, password: string): Promise<Seito> {
  const seito = findSeitoByUsername(normalizeUsername(username))
  if (!seito || !(await Bun.password.verify(password, seito.passwordHash))) {
    throw new Unauthorized("invalid username or password")
  }
  return { id: seito.id, username: seito.username, createdAt: seito.createdAt }
}

export function issueSeitoshou(
  seito: Seito,
  now = Date.now(),
): { token: string; expiresAt: number } {
  const token = crypto
    .getRandomValues(new Uint8Array(32))
    .toBase64({ alphabet: "base64url", omitPadding: true })
  const expiresAt = now + SESSION_MS
  insertSeitoshou({ tokenDigest: digest(token), seitoId: seito.id, createdAt: now, expiresAt })
  return { token, expiresAt }
}

export function resolveSeitoshou(token: string | undefined, now = Date.now()): Seito {
  if (!token) throw new Unauthorized("sign in required")
  purgeExpiredSeitoshou(now)
  const session = findSeitoshou(digest(token))
  if (!session || session.expiresAt <= now) throw new Unauthorized("sign in required")
  const seito = findSeitoById(session.seitoId)
  if (!seito) throw new Unauthorized("sign in required")
  return seito
}

export function revokeSeitoshou(token: string | undefined): void {
  if (token) removeSeitoshou(digest(token))
}

export function seitoFromRequest(request: Request): Seito {
  return seitoFromCookie(request.headers.get("cookie") ?? undefined)
}

export function seitoFromCookie(cookie: string | undefined): Seito {
  const part = cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("houkago_seitoshou="))
  return resolveSeitoshou(part?.slice("houkago_seitoshou=".length))
}

function digest(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex")
}
