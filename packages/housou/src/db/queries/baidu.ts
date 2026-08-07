import type { BaiduRetentionMode } from "houkago-kousoku"
import { db } from "../client"

export type BaiduConnectionRecord = {
  seitoId: string
  authorizationId: string
  retentionMode: BaiduRetentionMode
  accountName: string
  adaptorDeviceId?: string
  encryptedTokenBundle?: string
  keyVersion?: number
  tokenExpiresAt?: number
  needsReconnect: boolean
  createdAt: number
  updatedAt: number
}

export type BaiduSourceRecord = {
  id: string
  ownerSeitoId: string
  authorizationId: string
  bushitsuId: string
  enmokuId: string
  fileName: string
  size?: number
  retentionMode: BaiduRetentionMode
  adaptorDeviceId?: string
  encryptedFsid?: string
  upstreamHandle?: string
  createdAt: number
}

export type BaiduAdaptorSessionRecord = {
  tokenDigest: string
  seitoId: string
  deviceId: string
  expiresAt: number
  lastSeenAt: number
  revokedAt?: number
}

type ConnectionRow = {
  seito_id: string
  authorization_id: string | null
  retention_mode: BaiduRetentionMode
  account_name: string
  adaptor_device_id: string | null
  encrypted_token_bundle: string | null
  key_version: number | null
  token_expires_at: number | null
  needs_reconnect: number
  created_at: number
  updated_at: number
}

type SourceRow = {
  id: string
  owner_seito_id: string
  authorization_id: string | null
  bushitsu_id: string
  enmoku_id: string
  file_name: string
  size: number | null
  retention_mode: BaiduRetentionMode
  adaptor_device_id: string | null
  encrypted_fsid: string | null
  upstream_handle: string | null
  created_at: number
}

type AdaptorSessionRow = {
  token_digest: string
  seito_id: string
  device_id: string
  expires_at: number
  last_seen_at: number
  revoked_at: number | null
}

const connectionColumns = `seito_id, authorization_id, retention_mode, account_name, adaptor_device_id, encrypted_token_bundle,
  key_version, token_expires_at, needs_reconnect, created_at, updated_at`
const sourceColumns = `id, owner_seito_id, authorization_id, bushitsu_id, enmoku_id, file_name, size,
  retention_mode, adaptor_device_id, encrypted_fsid, upstream_handle, created_at`

const upsertConnection = db.query(
  `INSERT INTO baidu_connection (${connectionColumns})
   VALUES ($seitoId, $authorizationId, $retentionMode, $accountName, $adaptorDeviceId, $encryptedTokenBundle,
     $keyVersion, $tokenExpiresAt, $needsReconnect, $createdAt, $updatedAt)
   ON CONFLICT(seito_id) DO UPDATE SET
     authorization_id = excluded.authorization_id,
     retention_mode = excluded.retention_mode,
     account_name = excluded.account_name,
     adaptor_device_id = excluded.adaptor_device_id,
     encrypted_token_bundle = excluded.encrypted_token_bundle,
     key_version = excluded.key_version,
     token_expires_at = excluded.token_expires_at,
     needs_reconnect = excluded.needs_reconnect,
     updated_at = excluded.updated_at`,
)
const connectionBySeito = db.query<ConnectionRow, { $seitoId: string }>(
  `SELECT ${connectionColumns} FROM baidu_connection WHERE seito_id = $seitoId`,
)
const deleteConnectionStmt = db.query("DELETE FROM baidu_connection WHERE seito_id = $seitoId")
const markReconnectStmt = db.query(
  "UPDATE baidu_connection SET needs_reconnect = 1, updated_at = $updatedAt WHERE seito_id = $seitoId",
)
const rotateTokenStmt = db.query(
  `UPDATE baidu_connection
   SET encrypted_token_bundle = $encryptedTokenBundle, key_version = $keyVersion,
       token_expires_at = $tokenExpiresAt, needs_reconnect = 0, updated_at = $updatedAt
   WHERE seito_id = $seitoId AND retention_mode = 'server-saved'`,
)

const insertSourceStmt = db.query(
  `INSERT INTO baidu_source (${sourceColumns})
   VALUES ($id, $ownerSeitoId, $authorizationId, $bushitsuId, $enmokuId, $fileName, $size,
     $retentionMode, $adaptorDeviceId, $encryptedFsid, $upstreamHandle, $createdAt)`,
)
const sourceById = db.query<SourceRow, { $id: string }>(
  `SELECT ${sourceColumns} FROM baidu_source WHERE id = $id`,
)
const sourceByEnmoku = db.query<SourceRow, { $enmokuId: string }>(
  `SELECT ${sourceColumns} FROM baidu_source WHERE enmoku_id = $enmokuId`,
)

const insertAdaptorSessionStmt = db.query(
  `INSERT INTO baidu_adaptor_session
     (token_digest, seito_id, device_id, created_at, expires_at, last_seen_at, revoked_at)
   VALUES ($tokenDigest, $seitoId, $deviceId, $createdAt, $expiresAt, $lastSeenAt, NULL)`,
)
const adaptorSessionByDigest = db.query<AdaptorSessionRow, { $tokenDigest: string }>(
  `SELECT token_digest, seito_id, device_id, expires_at, last_seen_at, revoked_at
   FROM baidu_adaptor_session WHERE token_digest = $tokenDigest`,
)
const touchAdaptorSessionStmt = db.query(
  `UPDATE baidu_adaptor_session SET last_seen_at = $lastSeenAt
   WHERE token_digest = $tokenDigest AND revoked_at IS NULL AND expires_at > $lastSeenAt`,
)
const revokeAdaptorSessionStmt = db.query(
  `UPDATE baidu_adaptor_session SET revoked_at = $revokedAt
   WHERE token_digest = $tokenDigest AND revoked_at IS NULL`,
)
const revokeOwnerAdaptorSessionsStmt = db.query(
  `UPDATE baidu_adaptor_session SET revoked_at = $revokedAt
   WHERE seito_id = $seitoId AND revoked_at IS NULL`,
)
const revokeDeviceAdaptorSessionsStmt = db.query(
  `UPDATE baidu_adaptor_session SET revoked_at = $revokedAt
   WHERE device_id = $deviceId AND revoked_at IS NULL`,
)
const activeOwnerSession = db.query<AdaptorSessionRow, { $seitoId: string; $threshold: number }>(
  `SELECT token_digest, seito_id, device_id, expires_at, last_seen_at, revoked_at
   FROM baidu_adaptor_session
   WHERE seito_id = $seitoId AND revoked_at IS NULL
     AND expires_at > $threshold AND last_seen_at > $threshold
   ORDER BY last_seen_at DESC LIMIT 1`,
)
const activeOwnerDeviceSession = db.query<
  AdaptorSessionRow,
  { $seitoId: string; $deviceId: string; $threshold: number }
>(
  `SELECT token_digest, seito_id, device_id, expires_at, last_seen_at, revoked_at
   FROM baidu_adaptor_session
   WHERE seito_id = $seitoId AND device_id = $deviceId AND revoked_at IS NULL
     AND expires_at > $threshold AND last_seen_at > $threshold
   ORDER BY last_seen_at DESC LIMIT 1`,
)

export function saveBaiduConnection(record: BaiduConnectionRecord): void {
  upsertConnection.run(connectionParams(record))
}

export function getBaiduConnection(seitoId: string): BaiduConnectionRecord | null {
  const row = connectionBySeito.get({ $seitoId: seitoId })
  return row ? connectionDomain(row) : null
}

export function deleteBaiduConnection(seitoId: string): void {
  deleteConnectionStmt.run({ $seitoId: seitoId })
}

export function markBaiduReconnectRequired(seitoId: string, updatedAt: number): void {
  markReconnectStmt.run({ $seitoId: seitoId, $updatedAt: updatedAt })
}

export function rotateBaiduToken(
  seitoId: string,
  encryptedTokenBundle: string,
  keyVersion: number,
  tokenExpiresAt: number,
  updatedAt: number,
): boolean {
  return (
    rotateTokenStmt.run({
      $seitoId: seitoId,
      $encryptedTokenBundle: encryptedTokenBundle,
      $keyVersion: keyVersion,
      $tokenExpiresAt: tokenExpiresAt,
      $updatedAt: updatedAt,
    }).changes > 0
  )
}

export function insertBaiduSource(record: BaiduSourceRecord): void {
  insertSourceStmt.run(sourceParams(record))
}

export function getBaiduSource(id: string): BaiduSourceRecord | null {
  const row = sourceById.get({ $id: id })
  return row ? sourceDomain(row) : null
}

export function getBaiduSourceByEnmoku(enmokuId: string): BaiduSourceRecord | null {
  const row = sourceByEnmoku.get({ $enmokuId: enmokuId })
  return row ? sourceDomain(row) : null
}

export function insertBaiduAdaptorSession(
  record: BaiduAdaptorSessionRecord,
  createdAt: number,
): void {
  insertAdaptorSessionStmt.run({
    $tokenDigest: record.tokenDigest,
    $seitoId: record.seitoId,
    $deviceId: record.deviceId,
    $createdAt: createdAt,
    $expiresAt: record.expiresAt,
    $lastSeenAt: record.lastSeenAt,
  })
}

export function getBaiduAdaptorSession(tokenDigest: string): BaiduAdaptorSessionRecord | null {
  const row = adaptorSessionByDigest.get({ $tokenDigest: tokenDigest })
  return row ? adaptorDomain(row) : null
}

export function touchBaiduAdaptorSession(tokenDigest: string, lastSeenAt: number): boolean {
  return (
    touchAdaptorSessionStmt.run({ $tokenDigest: tokenDigest, $lastSeenAt: lastSeenAt }).changes > 0
  )
}

export function revokeBaiduAdaptorSession(tokenDigest: string, revokedAt: number): void {
  revokeAdaptorSessionStmt.run({ $tokenDigest: tokenDigest, $revokedAt: revokedAt })
}

export function revokeBaiduAdaptorSessions(seitoId: string, revokedAt: number): void {
  revokeOwnerAdaptorSessionsStmt.run({ $seitoId: seitoId, $revokedAt: revokedAt })
}

export function revokeBaiduAdaptorDeviceSessions(deviceId: string, revokedAt: number): void {
  revokeDeviceAdaptorSessionsStmt.run({ $deviceId: deviceId, $revokedAt: revokedAt })
}

export function findActiveBaiduAdaptorSession(
  seitoId: string,
  threshold: number,
): BaiduAdaptorSessionRecord | null {
  const row = activeOwnerSession.get({ $seitoId: seitoId, $threshold: threshold })
  return row ? adaptorDomain(row) : null
}

export function findActiveBaiduAdaptorDeviceSession(
  seitoId: string,
  deviceId: string,
  threshold: number,
): BaiduAdaptorSessionRecord | null {
  const row = activeOwnerDeviceSession.get({
    $seitoId: seitoId,
    $deviceId: deviceId,
    $threshold: threshold,
  })
  return row ? adaptorDomain(row) : null
}

function connectionParams(record: BaiduConnectionRecord) {
  return {
    $seitoId: record.seitoId,
    $authorizationId: record.authorizationId,
    $retentionMode: record.retentionMode,
    $accountName: record.accountName,
    $adaptorDeviceId: record.adaptorDeviceId ?? null,
    $encryptedTokenBundle: record.encryptedTokenBundle ?? null,
    $keyVersion: record.keyVersion ?? null,
    $tokenExpiresAt: record.tokenExpiresAt ?? null,
    $needsReconnect: record.needsReconnect ? 1 : 0,
    $createdAt: record.createdAt,
    $updatedAt: record.updatedAt,
  }
}

function sourceParams(record: BaiduSourceRecord) {
  return {
    $id: record.id,
    $ownerSeitoId: record.ownerSeitoId,
    $authorizationId: record.authorizationId,
    $bushitsuId: record.bushitsuId,
    $enmokuId: record.enmokuId,
    $fileName: record.fileName,
    $size: record.size ?? null,
    $retentionMode: record.retentionMode,
    $adaptorDeviceId: record.adaptorDeviceId ?? null,
    $encryptedFsid: record.encryptedFsid ?? null,
    $upstreamHandle: record.upstreamHandle ?? null,
    $createdAt: record.createdAt,
  }
}

function connectionDomain(row: ConnectionRow): BaiduConnectionRecord {
  return {
    seitoId: row.seito_id,
    authorizationId: row.authorization_id ?? "",
    retentionMode: row.retention_mode,
    accountName: row.account_name,
    adaptorDeviceId: row.adaptor_device_id ?? undefined,
    encryptedTokenBundle: row.encrypted_token_bundle ?? undefined,
    keyVersion: row.key_version ?? undefined,
    tokenExpiresAt: row.token_expires_at ?? undefined,
    needsReconnect: row.needs_reconnect === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sourceDomain(row: SourceRow): BaiduSourceRecord {
  return {
    id: row.id,
    ownerSeitoId: row.owner_seito_id,
    authorizationId: row.authorization_id ?? "",
    bushitsuId: row.bushitsu_id,
    enmokuId: row.enmoku_id,
    fileName: row.file_name,
    size: row.size ?? undefined,
    retentionMode: row.retention_mode,
    adaptorDeviceId: row.adaptor_device_id ?? undefined,
    encryptedFsid: row.encrypted_fsid ?? undefined,
    upstreamHandle: row.upstream_handle ?? undefined,
    createdAt: row.created_at,
  }
}

function adaptorDomain(row: AdaptorSessionRow): BaiduAdaptorSessionRecord {
  return {
    tokenDigest: row.token_digest,
    seitoId: row.seito_id,
    deviceId: row.device_id,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at ?? undefined,
  }
}
