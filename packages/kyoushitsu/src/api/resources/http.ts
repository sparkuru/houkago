import {
  baiduFilesList,
  baiduPlaybackGrantCreate,
  baiduPlaybackGrantPoll,
  baiduSourceAvailability,
  baiduStatus,
  danmakuCandidatesResolve,
  danmakuEpisodeSearch,
  identityMe,
  identityRegister,
  identitySignIn,
  identitySignOut,
  roomBangumiGet,
  roomBangumiMove,
  roomCreate,
  roomGet,
  siteConfig,
} from "../generated"
import type {
  BaiduFilesListResponse,
  BaiduPlaybackGrantCreateResponse,
  BaiduPlaybackGrantPollResponse,
  BaiduSourceAvailabilityResponse,
  BaiduStatusResponse,
  DanmakuCandidatesResolveData,
  DanmakuCandidatesResolveResponse,
  DanmakuEpisodeSearchResponse,
  IdentityMeResponse,
  IdentityRegisterData,
  IdentityRegisterResponse,
  IdentitySignInData,
  IdentitySignInResponse,
  IdentitySignOutResponse,
  RoomBangumiGetResponse,
  RoomBangumiMoveResponse,
  RoomCreateData,
  RoomCreateResponse,
  RoomGetResponse,
  SiteConfigResponse,
} from "../generated"
import {
  HoukagoHttpError,
  housouHttpClient,
  normalizeHttpError,
  unwrapResult,
} from "../http-client"
import { normalizeSearchQuery } from "./keys"

export type HttpRequestOptions = {
  signal?: AbortSignal
}

export type RoomBootstrap = {
  room: RoomGetResponse
  bangumi: RoomBangumiGetResponse
}

export async function fetchSiteConfig(
  options: HttpRequestOptions = {},
): Promise<SiteConfigResponse> {
  const configuredFetch = housouHttpClient.getConfig().fetch ?? globalThis.fetch
  let empty = false
  const scopedFetch: typeof fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await configuredFetch(input, init)
      if (response.ok)
        empty = response.status === 204 || (await response.clone().text()).length === 0
      return response
    },
    { preconnect: configuredFetch.preconnect },
  )
  const result = await siteConfig({ ...options, fetch: scopedFetch, throwOnError: false })
  if (options.signal?.aborted)
    throw normalizeHttpError(
      new HoukagoHttpError("aborted", "Site configuration request was aborted"),
      result.response,
      result.request,
    )
  if (empty && !(result.error instanceof HoukagoHttpError && result.error.kind === "aborted")) {
    return unwrapResult<SiteConfigResponse>({
      ...result,
      error: new HoukagoHttpError(
        "protocol",
        "Public site configuration response is empty",
        result.response?.status,
        "EMPTY_RESPONSE",
      ),
    })
  }
  return unwrapResult<SiteConfigResponse>(result)
}

export function createRoom(
  body: RoomCreateData["body"],
  options: HttpRequestOptions = {},
): Promise<RoomCreateResponse> {
  return roomCreate({ body, ...options, throwOnError: false }).then((result) =>
    unwrapResult<RoomCreateResponse>(result),
  )
}

export function fetchIdentityMe(options: HttpRequestOptions = {}): Promise<IdentityMeResponse> {
  return identityMe({ ...options, throwOnError: false }).then((result) =>
    unwrapResult<IdentityMeResponse>(result),
  )
}

export function registerIdentity(
  body: IdentityRegisterData["body"],
  options: HttpRequestOptions = {},
): Promise<IdentityRegisterResponse> {
  return identityRegister({ body, ...options, throwOnError: false }).then((result) =>
    unwrapResult<IdentityRegisterResponse>(result),
  )
}

export function signInIdentity(
  body: IdentitySignInData["body"],
  options: HttpRequestOptions = {},
): Promise<IdentitySignInResponse> {
  return identitySignIn({ body, ...options, throwOnError: false }).then((result) =>
    unwrapResult<IdentitySignInResponse>(result),
  )
}

export function signOutIdentity(
  options: HttpRequestOptions = {},
): Promise<IdentitySignOutResponse> {
  return identitySignOut({ ...options, throwOnError: false }).then((result) =>
    unwrapResult<IdentitySignOutResponse>(result),
  )
}

export function fetchRoomBootstrap(
  roomId: string,
  options: HttpRequestOptions = {},
): Promise<RoomBootstrap> {
  return Promise.all([
    roomGet({ path: { id: roomId }, ...options, throwOnError: false }),
    roomBangumiGet({ path: { id: roomId }, ...options, throwOnError: false }),
  ]).then(([roomResult, bangumiResult]) => ({
    room: unwrapResult<RoomGetResponse>(roomResult),
    bangumi: unwrapResult<RoomBangumiGetResponse>(bangumiResult),
  }))
}

export function moveRoomBangumi(
  roomId: string,
  enmokuId: string,
  direction: "up" | "down",
  options: HttpRequestOptions = {},
): Promise<RoomBangumiMoveResponse> {
  return roomBangumiMove({
    path: { id: roomId, enmokuId },
    body: { direction },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<RoomBangumiMoveResponse>(result))
}

export function fetchBaiduStatus(options: HttpRequestOptions = {}): Promise<BaiduStatusResponse> {
  return baiduStatus({ ...options, throwOnError: false }).then((result) =>
    unwrapResult<BaiduStatusResponse>(result),
  )
}

export function fetchBaiduFiles(
  path: string,
  cursor?: string,
  options: HttpRequestOptions = {},
): Promise<BaiduFilesListResponse> {
  return baiduFilesList({
    body: { path, ...(cursor === undefined ? {} : { cursor }) },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<BaiduFilesListResponse>(result))
}

export function fetchBaiduAvailability(
  sourceId: string,
  roomId: string,
  options: HttpRequestOptions = {},
): Promise<BaiduSourceAvailabilityResponse> {
  return baiduSourceAvailability({
    path: { sourceId },
    query: { bushitsuId: roomId },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<BaiduSourceAvailabilityResponse>(result))
}

export function createBaiduGrant(
  sourceId: string,
  roomId: string,
  options: HttpRequestOptions = {},
): Promise<BaiduPlaybackGrantCreateResponse> {
  return baiduPlaybackGrantCreate({
    path: { sourceId },
    body: { bushitsuId: roomId },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<BaiduPlaybackGrantCreateResponse>(result))
}

export function pollBaiduGrant(
  requestId: string,
  options: HttpRequestOptions = {},
): Promise<BaiduPlaybackGrantPollResponse> {
  return baiduPlaybackGrantPoll({
    path: { requestId },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<BaiduPlaybackGrantPollResponse>(result))
}

export type BaiduGrantPreparationOptions = {
  signal: AbortSignal
  maxPolls?: number
  pollIntervalMs?: number
}

// Invoke once for an active preparation. Errors are never replayed; cancel the
// signal on logout, room/source change or preparation disposal.
export async function prepareBaiduGrant(
  sourceId: string,
  roomId: string,
  { signal, maxPolls = 10, pollIntervalMs = 1_000 }: BaiduGrantPreparationOptions,
): Promise<BaiduPlaybackGrantPollResponse> {
  if (!Number.isInteger(maxPolls) || maxPolls < 0) {
    throw new RangeError("maxPolls must be a non-negative integer")
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new RangeError("pollIntervalMs must be finite and non-negative")
  }
  assertNotAborted(signal)
  let grant = await createBaiduGrant(sourceId, roomId, { signal })
  for (let count = 0; grant.state === "pending" && count < maxPolls; count += 1) {
    assertNotAborted(signal)
    const remainingMs = grant.expiresAt - Date.now()
    if (remainingMs <= 0) break
    await waitForPoll(Math.min(pollIntervalMs, remainingMs), signal)
    assertNotAborted(signal)
    if (Date.now() >= grant.expiresAt) break
    grant = await pollBaiduGrant(grant.requestId, { signal })
  }
  assertNotAborted(signal)
  if (grant.state === "pending") {
    throw new HoukagoHttpError("protocol", "Baidu grant preparation exceeded its polling limit")
  }
  return grant
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new HoukagoHttpError("aborted", "Baidu grant preparation was aborted")
}

function waitForPoll(delayMs: number, signal: AbortSignal): Promise<void> {
  assertNotAborted(signal)
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new HoukagoHttpError("aborted", "Baidu grant preparation was aborted"))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, delayMs)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

export function fetchDanmakuSearch(
  query = "",
  options: HttpRequestOptions = {},
): Promise<DanmakuEpisodeSearchResponse> {
  return danmakuEpisodeSearch({
    query: { q: normalizeSearchQuery(query) },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<DanmakuEpisodeSearchResponse>(result))
}

export function fetchDanmakuCandidates(
  roomId: string,
  enmokuId: string,
  query: NonNullable<DanmakuCandidatesResolveData["query"]> = {},
  options: HttpRequestOptions = {},
): Promise<DanmakuCandidatesResolveResponse> {
  return danmakuCandidatesResolve({
    path: { bushitsuId: roomId, enmokuId },
    query,
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<DanmakuCandidatesResolveResponse>(result))
}

export function createDanmakuCandidateSearch() {
  let active: AbortController | undefined
  return {
    cancel(): void {
      active?.abort()
      active = undefined
    },
    async run(
      roomId: string,
      enmokuId: string,
      query: NonNullable<DanmakuCandidatesResolveData["query"]> = {},
      options: HttpRequestOptions = {},
    ): Promise<DanmakuCandidatesResolveResponse> {
      active?.abort()
      const controller = new AbortController()
      active = controller
      const abort = () => controller.abort()
      if (options.signal?.aborted) abort()
      options.signal?.addEventListener("abort", abort, { once: true })
      try {
        const result = await fetchDanmakuCandidates(roomId, enmokuId, query, {
          signal: controller.signal,
        })
        if (controller.signal.aborted) {
          throw new HoukagoHttpError("aborted", "Danmaku candidate search was cancelled")
        }
        return result
      } finally {
        options.signal?.removeEventListener("abort", abort)
        if (active === controller) active = undefined
      }
    },
  }
}
