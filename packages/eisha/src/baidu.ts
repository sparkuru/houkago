import type { BaiduDirectoryPage, BaiduFileEntry } from "houkago-kousoku"
import { EishaUpstreamError } from "./errors"

const BAIDU_AUTHORIZE_URL = "https://openapi.baidu.com/oauth/2.0/authorize"
const BAIDU_TOKEN_URL = "https://openapi.baidu.com/oauth/2.0/token"
const BAIDU_FILE_URL = "https://pan.baidu.com/rest/2.0/xpan/file"
const BAIDU_MULTIMEDIA_URL = "https://pan.baidu.com/rest/2.0/xpan/multimedia"
const BAIDU_USER_URL = "https://pan.baidu.com/rest/2.0/xpan/nas"
const EXACT_BAIDU_DOWNLOAD_HOSTS = new Set(["d.pcs.baidu.com", "pcs.baidu.com"])
const BAIDU_DOWNLOAD_SUFFIX = ".baidupcs.com"
const MAX_INT64 = "9223372036854775807"
const FS_ID_INTEGER_FIELD = /("fs_id"\s*:\s*)(-?\d+)(?=\s*[,}])/g

type BaiduOperation = "account" | "directory" | "download link" | "file metadata" | "token"
type BaiduFailureKind = "http" | "invalid request" | "invalid response" | "provider" | "transport"

type BaiduFailureDiagnostic = Readonly<{
  provider: "baidu"
  operation: BaiduOperation
  kind: BaiduFailureKind
  status?: number
  upstreamCode?: number
}>

class BaiduUpstreamError extends EishaUpstreamError {
  readonly diagnostic: BaiduFailureDiagnostic

  constructor(
    operation: BaiduOperation,
    kind: BaiduFailureKind,
    detail?: Pick<BaiduFailureDiagnostic, "status" | "upstreamCode">,
  ) {
    super(`Baidu ${operation} request failed`)
    this.diagnostic = Object.freeze({ provider: "baidu", operation, kind, ...detail })
  }
}

export type BaiduFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type BaiduOAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export type BaiduTokenBundle = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string[]
}

export type BaiduAccount = {
  accountName: string
}

export type BaiduDlink = {
  dlink: string
  expiresAt: number
}

export function baiduAuthorizationUrl(
  config: Pick<BaiduOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(BAIDU_AUTHORIZE_URL)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("scope", "basic,netdisk")
  url.searchParams.set("state", state)
  return url.toString()
}

export async function exchangeBaiduCode(
  config: BaiduOAuthConfig,
  code: string,
  fetcher: BaiduFetcher = fetch,
  now = Date.now(),
): Promise<BaiduTokenBundle> {
  return requestToken(
    {
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    },
    fetcher,
    now,
  )
}

export async function refreshBaiduToken(
  config: BaiduOAuthConfig,
  refreshToken: string,
  fetcher: BaiduFetcher = fetch,
  now = Date.now(),
): Promise<BaiduTokenBundle> {
  return requestToken(
    {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    },
    fetcher,
    now,
  )
}

export async function fetchBaiduAccount(
  accessToken: string,
  fetcher: BaiduFetcher = fetch,
): Promise<BaiduAccount> {
  const url = new URL(BAIDU_USER_URL)
  url.searchParams.set("method", "uinfo")
  url.searchParams.set("access_token", accessToken)
  const body = await baiduJson(url, fetcher)
  if (!isRecord(body) || baiduErrno(body) !== 0) throw baiduFailure("account")
  const accountName = stringValue(body, "baidu_name") ?? stringValue(body, "netdisk_name")
  if (!accountName) throw baiduFailure("account")
  return { accountName }
}

export async function listBaiduDirectory(
  accessToken: string,
  path: string,
  cursor?: string,
  fetcher: BaiduFetcher = fetch,
): Promise<BaiduDirectoryPage> {
  const start = parseCursor(cursor)
  const url = new URL(BAIDU_FILE_URL)
  url.searchParams.set("method", "list")
  url.searchParams.set("access_token", accessToken)
  url.searchParams.set("dir", path || "/")
  url.searchParams.set("order", "name")
  url.searchParams.set("desc", "0")
  url.searchParams.set("start", String(start))
  url.searchParams.set("limit", "1000")
  url.searchParams.set("web", "1")

  const body = await baiduJson(url, fetcher)
  if (!isRecord(body) || baiduErrno(body) !== 0 || !Array.isArray(body.list)) {
    throw baiduFailure("directory")
  }
  const rawEntryCount = body.list.length
  const entries = body.list.flatMap((value) => {
    const entry = parseFileEntry(value)
    return entry ? [entry] : []
  })
  const nextCursor = rawEntryCount === 1000 ? String(start + rawEntryCount) : undefined
  return nextCursor
    ? { path: path || "/", entries, cursor: nextCursor }
    : { path: path || "/", entries }
}

export async function fetchBaiduDlink(
  accessToken: string,
  fsid: string,
  fetcher: BaiduFetcher = fetch,
  now = Date.now(),
): Promise<BaiduDlink> {
  const url = baiduFileMetadataUrl(accessToken, fsid)
  const body = requireBaiduResponse(await baiduJson(url, fetcher, "file metadata"), "file metadata")
  if (!Array.isArray(body.list)) throw new BaiduUpstreamError("file metadata", "invalid response")
  const first = body.list[0]
  if (
    body.list.length !== 1 ||
    !isRecord(first) ||
    fsidValue(first.fs_id) !== fsid ||
    typeof first.dlink !== "string"
  ) {
    throw baiduFailure("file metadata")
  }
  if (!isApprovedBaiduRawDlink(first.dlink)) throw baiduFailure("download link")

  const privateDlink = new URL(first.dlink)
  privateDlink.searchParams.set("access_token", accessToken)
  let redirect: Response
  try {
    redirect = await fetcher(privateDlink, {
      method: "HEAD",
      headers: { "user-agent": "pan.baidu.com" },
      redirect: "manual",
    })
  } catch {
    throw baiduFailure("download link")
  }
  if (redirect.status < 300 || redirect.status >= 400) throw baiduFailure("download link")
  const location = redirect.headers.get("location")
  if (!location || !isApprovedBaiduDlinkCapability(location)) {
    throw baiduFailure("download link")
  }
  const finalUrl = new URL(location)
  if (containsCredential(finalUrl.toString(), accessToken)) {
    throw baiduFailure("download link")
  }
  return { dlink: finalUrl.toString(), expiresAt: now + 5 * 60_000 }
}

export async function fetchBaiduFileMetadata(
  accessToken: string,
  fsid: string,
  fetcher: BaiduFetcher = fetch,
): Promise<BaiduFileEntry> {
  const url = baiduFileMetadataUrl(accessToken, fsid)
  const body = requireBaiduResponse(await baiduJson(url, fetcher, "file metadata"), "file metadata")
  if (!Array.isArray(body.list)) throw new BaiduUpstreamError("file metadata", "invalid response")
  const entry = parseFileEntry(body.list[0])
  if (
    body.list.length !== 1 ||
    !entry ||
    entry.id !== fsid ||
    entry.isDirectory ||
    entry.mediaType !== "video"
  ) {
    throw baiduFailure("file metadata")
  }
  return entry
}

async function requestToken(
  values: Record<string, string>,
  fetcher: BaiduFetcher,
  now: number,
): Promise<BaiduTokenBundle> {
  const url = new URL(BAIDU_TOKEN_URL)
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value)
  let response: Response
  try {
    response = await fetcher(url, { method: "GET", redirect: "error" })
  } catch {
    throw baiduFailure("token")
  }
  if (!response.ok) throw baiduFailure("token")
  const body = await safeJson(response)
  if (!isRecord(body)) throw baiduFailure("token")
  const accessToken = stringValue(body, "access_token")
  const refreshToken = stringValue(body, "refresh_token")
  const expiresIn = numberValue(body, "expires_in")
  if (!accessToken || !refreshToken || !expiresIn || expiresIn <= 0) throw baiduFailure("token")
  const scope = typeof body.scope === "string" ? body.scope.split(/[ ,]+/).filter(Boolean) : []
  return { accessToken, refreshToken, expiresAt: now + expiresIn * 1000, scope }
}

async function baiduJson(
  url: URL,
  fetcher: BaiduFetcher,
  operation?: BaiduOperation,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetcher(url, { redirect: "error" })
  } catch {
    throw operation ? new BaiduUpstreamError(operation, "transport") : baiduFailure("API")
  }
  if (!response.ok) {
    if (operation) throw await baiduHttpFailure(operation, response)
    throw baiduFailure("API")
  }
  return safeJson(response, operation)
}

async function safeJson(response: Response, operation?: BaiduOperation): Promise<unknown> {
  try {
    const text = await response.text()
    return JSON.parse(text.replace(FS_ID_INTEGER_FIELD, '$1"$2"')) as unknown
  } catch {
    throw operation
      ? new BaiduUpstreamError(operation, "invalid response")
      : baiduFailure("response")
  }
}

function requireBaiduResponse(body: unknown, operation: BaiduOperation): Record<string, unknown> {
  if (!isRecord(body)) throw new BaiduUpstreamError(operation, "invalid response")
  const upstreamCode = baiduErrno(body)
  if (upstreamCode !== 0) {
    throw new BaiduUpstreamError(operation, "provider", { upstreamCode })
  }
  return body
}

function parseFileEntry(value: unknown): BaiduFileEntry | null {
  if (!isRecord(value)) return null
  const id = fsidValue(value.fs_id)
  const name = stringValue(value, "server_filename") ?? stringValue(value, "filename")
  const path = stringValue(value, "path")
  const isdir = numberValue(value, "isdir")
  if (!id || !name || path === undefined || (isdir !== 0 && isdir !== 1)) return null
  const isDirectory = isdir === 1
  const size = numberValue(value, "size")
  const modifiedAt = numberValue(value, "server_mtime")
  const entry: BaiduFileEntry = {
    id,
    name,
    path,
    isDirectory,
    mediaType: !isDirectory && isVideo(value, name) ? "video" : "unsupported",
  }
  if (size !== undefined && size >= 0) entry.size = size
  if (modifiedAt !== undefined && modifiedAt >= 0) entry.modifiedAt = modifiedAt * 1000
  return entry
}

function isVideo(value: Record<string, unknown>, name: string): boolean {
  if (numberValue(value, "category") === 1) return true
  return /\.(mp4|m4v|webm|mov|mkv|avi|flv|ts|m2ts)$/i.test(name)
}

function baiduFileMetadataUrl(accessToken: string, fsid: string): URL {
  if (!isInt64Fsid(fsid)) throw new BaiduUpstreamError("file metadata", "invalid request")
  const url = new URL(BAIDU_MULTIMEDIA_URL)
  url.searchParams.set("method", "filemetas")
  url.searchParams.set("access_token", accessToken)
  // The API expects a JSON array of int64 values. Keep the validated decimal
  // text intact so JavaScript cannot round a large fs_id before sending it.
  url.searchParams.set("fsids", `[${fsid}]`)
  url.searchParams.set("dlink", "1")
  return url
}

function isInt64Fsid(value: string): boolean {
  if (!/^[1-9]\d{0,18}$/.test(value)) return false
  return value.length < MAX_INT64.length || value <= MAX_INT64
}

async function baiduHttpFailure(
  operation: BaiduOperation,
  response: Response,
): Promise<EishaUpstreamError> {
  const status = response.status
  let upstreamCode: number | undefined
  try {
    const body = (await response.json()) as unknown
    if (isRecord(body)) {
      const errno = baiduErrno(body)
      if (errno !== 0) upstreamCode = errno
    }
  } catch {
    // Discard provider bodies. A status and numeric errno are sufficient for
    // diagnostics without retaining paths, ids, links, or credential material.
  }
  return new BaiduUpstreamError(operation, "http", { status, upstreamCode })
}

function baiduErrno(value: Record<string, unknown>): number {
  return numberValue(value, "errno") ?? numberValue(value, "error_code") ?? 0
}

function baiduFailure(operation: string): EishaUpstreamError {
  return new EishaUpstreamError(`Baidu ${operation} request failed`)
}

export function isApprovedBaiduRawDlink(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (
      parsed.protocol === "https:" &&
      (EXACT_BAIDU_DOWNLOAD_HOSTS.has(parsed.hostname) ||
        parsed.hostname.endsWith(BAIDU_DOWNLOAD_SUFFIX))
    )
  } catch {
    return false
  }
}

export function isApprovedBaiduDlinkCapability(value: string): boolean {
  try {
    const parsed = new URL(value)
    if (!isApprovedBaiduRawDlink(value)) return false
    if (parsed.username || parsed.password || parsed.hash) return false
    return ![...parsed.searchParams.keys()].some((key) => {
      const normalized = key.toLowerCase()
      return normalized === "access_token" || normalized === "refresh_token"
    })
  } catch {
    return false
  }
}

export const isApprovedBaiduDlink = isApprovedBaiduDlinkCapability

function containsCredential(value: string, credential: string): boolean {
  if (value.includes(credential)) return true
  try {
    return decodeURIComponent(value).includes(credential)
  } catch {
    return true
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function stringValue(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" ? value[key] : undefined
}

function numberValue(value: Record<string, unknown>, key: string): number | undefined {
  return typeof value[key] === "number" && Number.isFinite(value[key]) ? value[key] : undefined
}

function stringOrNumber(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined
}

function fsidValue(value: unknown): string | undefined {
  const fsid = stringOrNumber(value)
  return fsid && isInt64Fsid(fsid) ? fsid : undefined
}

function parseCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0
  const value = Number(cursor)
  if (!Number.isSafeInteger(value) || value < 0) throw baiduFailure("directory")
  return value
}
