import {
  type BaiduTokenBundle,
  baiduAuthorizationUrl,
  exchangeBaiduCode,
  fetchBaiduAccount,
  fetchBaiduDlink,
  fetchBaiduFileMetadata,
  isApprovedBaiduDlinkCapability,
  listBaiduDirectory,
  refreshBaiduToken,
} from "houkago-eisha"
import type {
  BaiduConnectionStatus,
  BaiduDirectoryPage,
  BaiduDlinkFailureReason,
  BaiduPlaybackGrant,
  BaiduRetentionMode,
  Enmoku,
} from "houkago-kousoku"
import { db } from "../db/client"
import {
  type BaiduAdaptorSessionRecord,
  type BaiduConnectionRecord,
  type BaiduSourceRecord,
  deleteBaiduConnection,
  findActiveBaiduAdaptorDeviceSession,
  findActiveBaiduAdaptorSession,
  getBaiduAdaptorSession,
  getBaiduConnection,
  getBaiduSource,
  getBaiduSourceByEnmoku,
  insertBaiduAdaptorSession,
  insertBaiduSource,
  markBaiduReconnectRequired,
  revokeBaiduAdaptorDeviceSessions,
  revokeBaiduAdaptorSession,
  revokeBaiduAdaptorSessions,
  rotateBaiduToken,
  saveBaiduConnection,
  touchBaiduAdaptorSession,
} from "../db/queries/baidu"
import { addEnmoku } from "../domain/bushitsu"
import { isPresent } from "../ws/housou"
import { baiduConfig } from "./baidu-config"
import { CredentialCipher } from "./credential-crypto"
import {
  BaiduAdaptorRequired,
  BaiduConnectionRequired,
  BaiduGrantInvalid,
  BaiduSourceNotFound,
  BaiduStateInvalid,
  BaiduUnavailable,
  Forbidden,
  Unauthorized,
} from "./errors"
import { newId } from "./id"

const OAUTH_STATE_MS = 10 * 60_000
const HANDOFF_MS = 5 * 60_000
const PAIRING_MS = 5 * 60_000
const ADAPTOR_SESSION_MS = 30 * 24 * 60 * 60_000
const ADAPTOR_ONLINE_MS = 45_000
const PENDING_DLINK_MS = 90_000
const MAX_GRANT_MS = 5 * 60_000

type OAuthState = {
  seitoId: string
  retentionMode: BaiduRetentionMode
  deviceId?: string
  expiresAt: number
}

type Pairing = { seitoId: string; deviceId: string; expiresAt: number }
type Handoff = { seitoId: string; deviceId: string; token: BaiduTokenBundle; expiresAt: number }
type PendingDlink = {
  requestId: string
  nonce: string
  sourceId: string
  bushitsuId: string
  ownerSeitoId: string
  viewerSeitoId: string
  expiresAt: number
}
type MediaGrant = {
  id: string
  sourceId: string
  bushitsuId: string
  viewerSeitoId: string
  dlink: string
  expiresAt: number
}

const oauthStates = new Map<string, OAuthState>()
const pairings = new Map<string, Pairing>()
const handoffs = new Map<string, Handoff>()
const pendingDlinks = new Map<string, PendingDlink>()
const completedDlinks = new Map<
  string,
  | { state: "ready"; dlink: string; expiresAt: number }
  | { state: "failed"; reason: BaiduDlinkFailureReason }
>()
const mediaGrants = new Map<string, MediaGrant>()

export function baiduConnectionStatus(seitoId: string, now = Date.now()): BaiduConnectionStatus {
  purge(now)
  const config = baiduConfig()
  if (!config.oauth) {
    return {
      enabled: false,
      serverSavedEnabled: false,
      connected: false,
      adaptorOnline: false,
      reason: "config-missing",
    }
  }
  const connection = getBaiduConnection(seitoId)
  const adaptorOnline =
    connection?.retentionMode === "user-held" && connection.adaptorDeviceId
      ? !!activeAdaptorDevice(seitoId, connection.adaptorDeviceId, now)
      : !!activeAdaptor(seitoId, now)
  const base = {
    enabled: true,
    serverSavedEnabled: !!config.credentialKey,
    connected: !!connection,
    adaptorOnline,
  }
  if (!connection) {
    return config.credentialKey ? base : { ...base, reason: "encryption-key-missing" }
  }
  const status: BaiduConnectionStatus = {
    ...base,
    retentionMode: connection.retentionMode,
    accountName: connection.accountName,
  }
  if (connection.needsReconnect) status.reason = "reconnect-required"
  else if (connection.retentionMode === "user-held" && !adaptorOnline) {
    status.reason = "adaptor-offline"
  }
  return status
}

export function startBaiduOAuth(
  seitoId: string,
  retentionMode: BaiduRetentionMode,
  deviceId: string | undefined,
  now = Date.now(),
): { authorizationUrl: string; expiresAt: number } {
  const config = requireOAuthConfig()
  if (retentionMode === "server-saved" && !baiduConfig().credentialKey) {
    throw new BaiduUnavailable("server-saved credentials are not configured")
  }
  if (retentionMode === "user-held") {
    if (!deviceId) throw new BaiduAdaptorRequired("paired desktop adaptor is required")
    if (!activeAdaptorDevice(seitoId, deviceId, now)) {
      throw new BaiduAdaptorRequired("paired desktop adaptor is required")
    }
  }
  const state = randomToken()
  const expiresAt = now + OAUTH_STATE_MS
  oauthStates.set(digest(state), { seitoId, retentionMode, deviceId, expiresAt })
  return { authorizationUrl: baiduAuthorizationUrl(config, state), expiresAt }
}

export async function completeBaiduOAuth(
  code: string,
  state: string,
  now = Date.now(),
): Promise<{ ok: true; retentionMode: BaiduRetentionMode }> {
  purge(now)
  const key = digest(state)
  const pending = oauthStates.get(key)
  oauthStates.delete(key)
  if (!pending || pending.expiresAt <= now) throw new BaiduStateInvalid("OAuth state is invalid")
  const config = requireOAuthConfig()
  const token = await exchangeBaiduCode(config, code, fetch, now)
  const account = await fetchBaiduAccount(token.accessToken, fetch)
  const authorizationId = newId()
  cancelForOwner(pending.seitoId, false)
  if (pending.retentionMode === "server-saved") {
    const cipher = requireCipher()
    saveBaiduConnection({
      seitoId: pending.seitoId,
      authorizationId,
      retentionMode: pending.retentionMode,
      accountName: account.accountName,
      encryptedTokenBundle: cipher.encrypt(
        token,
        connectionCipherContext(pending.seitoId, authorizationId),
      ),
      keyVersion: cipher.keyVersion,
      tokenExpiresAt: token.expiresAt,
      needsReconnect: false,
      createdAt: now,
      updatedAt: now,
    })
  } else {
    const deviceId = pending.deviceId
    if (!deviceId || !activeAdaptorDevice(pending.seitoId, deviceId, now)) {
      throw new BaiduAdaptorRequired("paired desktop adaptor is required")
    }
    saveBaiduConnection({
      seitoId: pending.seitoId,
      authorizationId,
      retentionMode: pending.retentionMode,
      accountName: account.accountName,
      adaptorDeviceId: deviceId,
      needsReconnect: false,
      createdAt: now,
      updatedAt: now,
    })
    handoffs.set(handoffKey(pending.seitoId, deviceId), {
      seitoId: pending.seitoId,
      deviceId,
      token,
      expiresAt: now + HANDOFF_MS,
    })
  }
  return { ok: true, retentionMode: pending.retentionMode }
}

export function createBaiduPairing(
  seitoId: string,
  deviceId: string,
  localPaired: boolean,
  now = Date.now(),
): { state: "paired" } | { state: "pairing-required"; pairingCode: string; expiresAt: number } {
  purge(now)
  if (localPaired && activeAdaptorDevice(seitoId, deviceId, now)) return { state: "paired" }
  const pairingCode = randomToken()
  const expiresAt = now + PAIRING_MS
  pairings.set(digest(pairingCode), { seitoId, deviceId, expiresAt })
  return { state: "pairing-required", pairingCode, expiresAt }
}

export function redeemBaiduPairing(
  pairingCode: string,
  deviceId: string,
  now = Date.now(),
): { adaptorToken: string; expiresAt: number } {
  purge(now)
  const pairingKey = digest(pairingCode)
  const pairing = pairings.get(pairingKey)
  pairings.delete(pairingKey)
  if (!pairing || pairing.expiresAt <= now || pairing.deviceId !== deviceId) {
    throw new Unauthorized("pairing code is invalid")
  }
  const adaptorToken = randomToken()
  const expiresAt = now + ADAPTOR_SESSION_MS
  revokeBaiduAdaptorDeviceSessions(deviceId, now)
  insertBaiduAdaptorSession(
    {
      tokenDigest: digest(adaptorToken),
      seitoId: pairing.seitoId,
      deviceId,
      expiresAt,
      lastSeenAt: now,
    },
    now,
  )
  return { adaptorToken, expiresAt }
}

export function requireBaiduAdaptor(request: Request, now = Date.now()): BaiduAdaptorSessionRecord {
  const token = bearerToken(request)
  if (!token) throw new Unauthorized("adaptor authentication required")
  const tokenDigest = digest(token)
  const session = getBaiduAdaptorSession(tokenDigest)
  if (!session || session.revokedAt !== undefined || session.expiresAt <= now) {
    throw new Unauthorized("adaptor authentication required")
  }
  if (!touchBaiduAdaptorSession(tokenDigest, now)) {
    throw new Unauthorized("adaptor authentication required")
  }
  return { ...session, lastSeenAt: now }
}

export function consumeBaiduHandoff(
  session: BaiduAdaptorSessionRecord,
  now = Date.now(),
): BaiduTokenBundle {
  purge(now)
  const key = handoffKey(session.seitoId, session.deviceId)
  const handoff = handoffs.get(key)
  handoffs.delete(key)
  if (!handoff || handoff.expiresAt <= now) {
    throw new BaiduConnectionRequired("OAuth handoff is unavailable")
  }
  return handoff.token
}

export async function refreshUserHeldBaiduToken(
  session: BaiduAdaptorSessionRecord,
  refreshToken: string,
  now = Date.now(),
): Promise<BaiduTokenBundle> {
  const connection = requireConnection(session.seitoId)
  if (connection.retentionMode !== "user-held" || connection.adaptorDeviceId !== session.deviceId) {
    throw new Forbidden("adaptor device does not own this connection")
  }
  return refreshBaiduToken(requireOAuthConfig(), refreshToken, fetch, now)
}

export function disconnectBaiduAdaptor(session: BaiduAdaptorSessionRecord, now = Date.now()): void {
  revokeBaiduAdaptorSession(session.tokenDigest, now)
  const connection = getBaiduConnection(session.seitoId)
  if (
    connection?.retentionMode === "user-held" &&
    connection.adaptorDeviceId === session.deviceId
  ) {
    cancelForOwner(session.seitoId, true)
  }
}

export function revokeBaiduConnection(seitoId: string, now = Date.now()): void {
  deleteBaiduConnection(seitoId)
  revokeBaiduAdaptorSessions(seitoId, now)
  cancelForOwner(seitoId, false)
  cancelForViewer(seitoId)
  for (const [key, state] of oauthStates) if (state.seitoId === seitoId) oauthStates.delete(key)
  for (const [key, pairing] of pairings) if (pairing.seitoId === seitoId) pairings.delete(key)
  for (const [key, handoff] of handoffs) if (handoff.seitoId === seitoId) handoffs.delete(key)
}

export async function listSavedBaiduFiles(
  seitoId: string,
  path: string,
  cursor?: string,
  now = Date.now(),
): Promise<BaiduDirectoryPage> {
  const connection = requireConnection(seitoId)
  if (connection.retentionMode !== "server-saved") {
    throw new BaiduAdaptorRequired("user-held files are listed by the desktop adaptor")
  }
  const token = await usableSavedToken(connection, now)
  return listBaiduDirectory(token.accessToken, path, cursor, fetch)
}

export async function createBaiduSource(
  seitoId: string,
  input: {
    bushitsuId: string
    fileId: string
    fileName: string
    size?: number
    upstreamHandle?: string
  },
  now = Date.now(),
): Promise<Enmoku> {
  const connection = requireConnection(seitoId)
  const sourceId = newId()
  const cipher = connection.retentionMode === "server-saved" ? requireCipher() : undefined
  if (connection.retentionMode === "user-held" && !input.upstreamHandle) {
    throw new BaiduAdaptorRequired("user-held selection requires an adaptor handle")
  }
  if (connection.retentionMode === "user-held" && !connection.adaptorDeviceId) {
    throw new BaiduAdaptorRequired("user-held adaptor binding is unavailable")
  }
  const verifiedFile =
    connection.retentionMode === "server-saved"
      ? await fetchBaiduFileMetadata(
          (await usableSavedToken(connection, now)).accessToken,
          input.fileId,
          fetch,
        )
      : undefined
  const fileName = verifiedFile?.name ?? input.fileName
  const size = verifiedFile?.size ?? input.size
  const provider = {
    kind: "baidu" as const,
    sourceId,
    ownerName: connection.accountName,
    fileName,
    size,
  }
  return db.transaction(() => {
    const enmoku = addEnmoku(input.bushitsuId, {
      title: fileName,
      type: "direct",
      url: `/baidu/source/${sourceId}`,
      provider,
      addedBy: seitoId,
    })
    insertBaiduSource({
      id: sourceId,
      ownerSeitoId: seitoId,
      authorizationId: connection.authorizationId,
      bushitsuId: input.bushitsuId,
      enmokuId: enmoku.id,
      fileName,
      size,
      retentionMode: connection.retentionMode,
      adaptorDeviceId: connection.adaptorDeviceId,
      encryptedFsid: cipher?.encrypt(input.fileId, sourceCipherContext(sourceId)),
      upstreamHandle: connection.retentionMode === "user-held" ? input.upstreamHandle : undefined,
      createdAt: now,
    })
    return enmoku
  })()
}

export async function requestBaiduPlaybackGrant(
  viewerSeitoId: string,
  sourceId: string,
  bushitsuId: string,
  baseUrl: string,
  now = Date.now(),
): Promise<BaiduPlaybackGrant> {
  purge(now)
  const source = requireSource(sourceId, bushitsuId)
  if (!isPresent(bushitsuId, viewerSeitoId)) throw new Forbidden("room admission is required")
  const sourceConnection = requireSourceConnection(source)
  if (source.retentionMode === "server-saved") {
    const token = await usableSavedToken(sourceConnection, now)
    const fsid = requireCipher().decrypt<string>(
      required(source.encryptedFsid),
      sourceCipherContext(source.id),
    )
    const dlink = await fetchBaiduDlink(token.accessToken, fsid, fetch, now)
    return issueMediaGrant(source, viewerSeitoId, dlink.dlink, dlink.expiresAt, baseUrl, now)
  }
  if (
    !isPresent(bushitsuId, source.ownerSeitoId) ||
    !source.adaptorDeviceId ||
    !activeAdaptorDevice(source.ownerSeitoId, source.adaptorDeviceId, now)
  ) {
    throw new BaiduAdaptorRequired("source owner adaptor is offline")
  }
  const existing = [...pendingDlinks.values()].find(
    (pending) =>
      pending.sourceId === sourceId &&
      pending.viewerSeitoId === viewerSeitoId &&
      pending.expiresAt > now,
  )
  if (existing)
    return { state: "pending", requestId: existing.requestId, expiresAt: existing.expiresAt }
  const requestId = randomToken()
  const pending: PendingDlink = {
    requestId,
    nonce: randomToken(),
    sourceId,
    bushitsuId,
    ownerSeitoId: source.ownerSeitoId,
    viewerSeitoId,
    expiresAt: now + PENDING_DLINK_MS,
  }
  pendingDlinks.set(requestId, pending)
  return { state: "pending", requestId, expiresAt: pending.expiresAt }
}

export function pollBaiduPlaybackGrant(
  viewerSeitoId: string,
  requestId: string,
  baseUrl: string,
  now = Date.now(),
): BaiduPlaybackGrant {
  purge(now)
  const pending = pendingDlinks.get(requestId)
  if (!pending || pending.viewerSeitoId !== viewerSeitoId) {
    throw new BaiduGrantInvalid("playback request is invalid")
  }
  const completed = completedDlinks.get(requestId)
  if (!completed) return { state: "pending", requestId, expiresAt: pending.expiresAt }
  if (!isPresent(pending.bushitsuId, viewerSeitoId)) {
    pendingDlinks.delete(requestId)
    completedDlinks.delete(requestId)
    throw new Forbidden("room admission is required")
  }
  pendingDlinks.delete(requestId)
  completedDlinks.delete(requestId)
  if (completed.state === "failed") return completed
  const source = requireSource(pending.sourceId, pending.bushitsuId)
  requireSourceConnection(source)
  return issueMediaGrant(source, viewerSeitoId, completed.dlink, completed.expiresAt, baseUrl, now)
}

export function listPendingBaiduDlinks(
  session: BaiduAdaptorSessionRecord,
  now = Date.now(),
): Array<{
  requestId: string
  nonce: string
  sourceId: string
  bushitsuId: string
  expiresAt: number
}> {
  purge(now)
  return [...pendingDlinks.values()]
    .filter((pending) => {
      if (pending.ownerSeitoId !== session.seitoId) return false
      if (completedDlinks.has(pending.requestId)) return false
      return getBaiduSource(pending.sourceId)?.adaptorDeviceId === session.deviceId
    })
    .map(({ requestId, nonce, sourceId, bushitsuId, expiresAt }) => ({
      requestId,
      nonce,
      sourceId,
      bushitsuId,
      expiresAt,
    }))
}

export function completePendingBaiduDlink(
  session: BaiduAdaptorSessionRecord,
  response:
    | { requestId: string; nonce: string; dlink: string; expiresAt: number }
    | { requestId: string; nonce: string; failure: BaiduDlinkFailureReason },
  now = Date.now(),
): { ok: true } {
  purge(now)
  const pending = pendingDlinks.get(response.requestId)
  if (
    !pending ||
    pending.ownerSeitoId !== session.seitoId ||
    pending.nonce !== response.nonce ||
    pending.expiresAt <= now ||
    completedDlinks.has(response.requestId)
  ) {
    throw new BaiduGrantInvalid("dlink request is invalid")
  }
  const source = requireSource(pending.sourceId, pending.bushitsuId)
  requireSourceConnection(source)
  if (
    source.ownerSeitoId !== session.seitoId ||
    source.adaptorDeviceId !== session.deviceId ||
    !isPresent(pending.bushitsuId, session.seitoId) ||
    !isPresent(pending.bushitsuId, pending.viewerSeitoId)
  ) {
    throw new BaiduGrantInvalid("dlink request is invalid")
  }
  if ("failure" in response) {
    completedDlinks.set(response.requestId, { state: "failed", reason: response.failure })
    return { ok: true }
  }
  const dlink = approvedDlink(response.dlink)
  const expiresAt = Math.min(response.expiresAt, now + MAX_GRANT_MS, pending.expiresAt)
  if (expiresAt <= now) throw new BaiduGrantInvalid("dlink has expired")
  completedDlinks.set(response.requestId, { state: "ready", dlink, expiresAt })
  return { ok: true }
}

export function claimBaiduMediaGrant(
  session: BaiduAdaptorSessionRecord,
  grantId: string,
  baseUrl: string,
  now = Date.now(),
): {
  id: string
  sourceId: string
  bushitsuId: string
  sentinelUrl: string
  dlink: string
  expiresAt: number
} {
  purge(now)
  const grant = mediaGrants.get(grantId)
  if (
    !grant ||
    grant.expiresAt <= now ||
    grant.viewerSeitoId !== session.seitoId ||
    !isPresent(grant.bushitsuId, session.seitoId)
  ) {
    throw new BaiduGrantInvalid("media grant is invalid")
  }
  requireSourceConnection(requireSource(grant.sourceId, grant.bushitsuId))
  mediaGrants.delete(grantId)
  const sentinelUrl = new URL(`/baidu/media/${grant.id}`, baseUrl).toString()
  return {
    id: grant.id,
    sourceId: grant.sourceId,
    bushitsuId: grant.bushitsuId,
    sentinelUrl,
    dlink: grant.dlink,
    expiresAt: grant.expiresAt,
  }
}

export function cancelBaiduForEnmoku(enmokuId: string, bushitsuId: string): void {
  const source = getBaiduSourceByEnmoku(enmokuId)
  if (source?.bushitsuId === bushitsuId) cancelForSource(source.id)
}

export function cancelBaiduForRoomSeito(bushitsuId: string, seitoId: string): void {
  for (const [id, pending] of pendingDlinks) {
    if (
      pending.bushitsuId === bushitsuId &&
      (pending.viewerSeitoId === seitoId || pending.ownerSeitoId === seitoId)
    ) {
      pendingDlinks.delete(id)
      completedDlinks.delete(id)
    }
  }
  for (const [id, grant] of mediaGrants) {
    if (grant.bushitsuId !== bushitsuId) continue
    const source = getBaiduSource(grant.sourceId)
    if (
      grant.viewerSeitoId === seitoId ||
      (source?.ownerSeitoId === seitoId && source.retentionMode === "user-held")
    ) {
      mediaGrants.delete(id)
    }
  }
}

export function isBaiduAdaptorDeviceOnline(
  seitoId: string,
  deviceId: string | undefined,
  now = Date.now(),
): boolean {
  return !!deviceId && !!activeAdaptorDevice(seitoId, deviceId, now)
}

async function usableSavedToken(
  connection: BaiduConnectionRecord,
  now: number,
): Promise<BaiduTokenBundle> {
  if (connection.needsReconnect || !connection.encryptedTokenBundle) {
    throw new BaiduConnectionRequired("Baidu authorization must be reconnected")
  }
  const cipher = requireCipher()
  let token: BaiduTokenBundle
  try {
    token = cipher.decrypt<BaiduTokenBundle>(
      connection.encryptedTokenBundle,
      connectionCipherContext(connection.seitoId, connection.authorizationId),
    )
  } catch {
    markBaiduReconnectRequired(connection.seitoId, now)
    throw new BaiduConnectionRequired("Baidu authorization must be reconnected")
  }
  if (token.expiresAt > now + 30_000) return token
  try {
    token = await refreshBaiduToken(requireOAuthConfig(), token.refreshToken, fetch, now)
  } catch {
    markBaiduReconnectRequired(connection.seitoId, now)
    throw new BaiduConnectionRequired("Baidu authorization must be reconnected")
  }
  if (
    !rotateBaiduToken(
      connection.seitoId,
      cipher.encrypt(
        token,
        connectionCipherContext(connection.seitoId, connection.authorizationId),
      ),
      cipher.keyVersion,
      token.expiresAt,
      now,
    )
  ) {
    throw new BaiduConnectionRequired("Baidu authorization must be reconnected")
  }
  return token
}

function issueMediaGrant(
  source: BaiduSourceRecord,
  viewerSeitoId: string,
  rawDlink: string,
  providerExpiresAt: number,
  baseUrl: string,
  now: number,
): BaiduPlaybackGrant {
  const dlink = approvedDlink(rawDlink)
  const expiresAt = Math.min(providerExpiresAt, now + MAX_GRANT_MS)
  if (expiresAt <= now) throw new BaiduGrantInvalid("download link has expired")
  const id = randomToken()
  mediaGrants.set(id, {
    id,
    sourceId: source.id,
    bushitsuId: source.bushitsuId,
    viewerSeitoId,
    dlink,
    expiresAt,
  })
  return { state: "ready", grantUrl: new URL(`/baidu/media/${id}`, baseUrl).toString(), expiresAt }
}

function activeAdaptor(seitoId: string, now: number): BaiduAdaptorSessionRecord | null {
  return findActiveBaiduAdaptorSession(seitoId, now - ADAPTOR_ONLINE_MS)
}

function activeAdaptorDevice(
  seitoId: string,
  deviceId: string,
  now: number,
): BaiduAdaptorSessionRecord | null {
  return findActiveBaiduAdaptorDeviceSession(seitoId, deviceId, now - ADAPTOR_ONLINE_MS)
}

function requireConnection(seitoId: string): BaiduConnectionRecord {
  const connection = getBaiduConnection(seitoId)
  if (!connection || connection.needsReconnect) {
    throw new BaiduConnectionRequired("Baidu authorization is not connected")
  }
  return connection
}

function requireSourceConnection(source: BaiduSourceRecord): BaiduConnectionRecord {
  const connection = requireConnection(source.ownerSeitoId)
  if (
    connection.authorizationId !== source.authorizationId ||
    connection.retentionMode !== source.retentionMode ||
    (source.retentionMode === "user-held" && connection.adaptorDeviceId !== source.adaptorDeviceId)
  ) {
    throw new BaiduConnectionRequired("Baidu source authorization is no longer active")
  }
  return connection
}

function requireSource(sourceId: string, bushitsuId: string): BaiduSourceRecord {
  const source = getBaiduSource(sourceId)
  if (!source || source.bushitsuId !== bushitsuId)
    throw new BaiduSourceNotFound("Baidu source not found")
  return source
}

function requireOAuthConfig() {
  const config = baiduConfig().oauth
  if (!config) throw new BaiduUnavailable("Baidu integration is not configured")
  return config
}

function requireCipher(): CredentialCipher {
  const config = baiduConfig()
  if (!config.credentialKey) throw new BaiduUnavailable("credential encryption is not configured")
  return new CredentialCipher(config.credentialKey, config.keyVersion)
}

function approvedDlink(value: string): string {
  if (!isApprovedBaiduDlinkCapability(value)) {
    throw new BaiduGrantInvalid("download host is not approved")
  }
  return new URL(value).toString()
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return undefined
  const token = authorization.slice("Bearer ".length).trim()
  return token || undefined
}

function randomToken(): string {
  return crypto
    .getRandomValues(new Uint8Array(32))
    .toBase64({ alphabet: "base64url", omitPadding: true })
}

function digest(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex")
}

function handoffKey(seitoId: string, deviceId: string): string {
  return `${seitoId}:${deviceId}`
}

function connectionCipherContext(seitoId: string, authorizationId: string): string {
  return `baidu-connection:${seitoId}:${authorizationId}`
}

function sourceCipherContext(sourceId: string): string {
  return `baidu-source:${sourceId}`
}

function required<T>(value: T | undefined): T {
  if (value === undefined)
    throw new BaiduConnectionRequired("Baidu source credential is unavailable")
  return value
}

function cancelForSource(sourceId: string): void {
  for (const [id, pending] of pendingDlinks) {
    if (pending.sourceId === sourceId) {
      pendingDlinks.delete(id)
      completedDlinks.delete(id)
    }
  }
  for (const [id, grant] of mediaGrants) if (grant.sourceId === sourceId) mediaGrants.delete(id)
}

function cancelForOwner(seitoId: string, userHeldOnly: boolean): void {
  for (const [id, pending] of pendingDlinks) {
    if (pending.ownerSeitoId === seitoId) {
      pendingDlinks.delete(id)
      completedDlinks.delete(id)
    }
  }
  for (const [id, grant] of mediaGrants) {
    const source = getBaiduSource(grant.sourceId)
    if (
      source?.ownerSeitoId === seitoId &&
      (!userHeldOnly || source.retentionMode === "user-held")
    ) {
      mediaGrants.delete(id)
    }
  }
}

function cancelForViewer(seitoId: string): void {
  for (const [id, pending] of pendingDlinks) {
    if (pending.viewerSeitoId === seitoId) {
      pendingDlinks.delete(id)
      completedDlinks.delete(id)
    }
  }
  for (const [id, grant] of mediaGrants) if (grant.viewerSeitoId === seitoId) mediaGrants.delete(id)
}

function purge(now: number): void {
  for (const [id, state] of oauthStates) if (state.expiresAt <= now) oauthStates.delete(id)
  for (const [id, pairing] of pairings) if (pairing.expiresAt <= now) pairings.delete(id)
  for (const [id, handoff] of handoffs) if (handoff.expiresAt <= now) handoffs.delete(id)
  for (const [id, pending] of pendingDlinks) {
    if (pending.expiresAt <= now) {
      pendingDlinks.delete(id)
      completedDlinks.delete(id)
    }
  }
  for (const [id, grant] of mediaGrants) if (grant.expiresAt <= now) mediaGrants.delete(id)
}
