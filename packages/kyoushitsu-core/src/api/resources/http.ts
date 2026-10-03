import {
  baiduAdaptorPairing,
  baiduConnectionDelete,
  baiduFilesList,
  baiduOAuthStart,
  baiduPlaybackGrantCreate,
  baiduPlaybackGrantPoll,
  baiduSourceAvailability,
  baiduSourceCreate,
  baiduStatus,
  danmakuCandidatesResolve,
  danmakuEnmokuDefaultDelete,
  danmakuEnmokuDefaultUpdate,
  danmakuEpisodeSearch,
  danmakuMatchCreate,
  danmakuProposalCreate,
  eishaDanmaku,
  identityMe,
  identityRegister,
  identitySignIn,
  identitySignOut,
  roomBangumiGet,
  roomBangumiMove,
  roomBangumiPendingClear,
  roomCreate,
  roomEnmokuCreate,
  roomEnmokuDelete,
  roomEnmokuPreview,
  roomGet,
  roomMemberDelete,
  siteConfig,
} from "../generated/index"
import type {
  BaiduAdaptorPairingResponse,
  BaiduConnectionDeleteResponse,
  BaiduFilesListResponse,
  BaiduOAuthStartData,
  BaiduOAuthStartResponse,
  BaiduPlaybackGrantCreateResponse,
  BaiduPlaybackGrantPollResponse,
  BaiduSourceAvailabilityResponse,
  BaiduSourceCreateData,
  BaiduSourceCreateResponse,
  BaiduStatusResponse,
  DanmakuCandidatesResolveData,
  DanmakuCandidatesResolveResponse,
  DanmakuEnmokuDefaultDeleteResponse,
  DanmakuEnmokuDefaultUpdateResponse,
  DanmakuEpisodeSearchResponse,
  DanmakuMatchCreateData,
  DanmakuMatchCreateResponse,
  DanmakuProposalCreateData,
  DanmakuProposalCreateResponse,
  EishaDanmakuResponse,
  IdentityMeResponse,
  IdentityRegisterData,
  IdentityRegisterResponse,
  IdentitySignInData,
  IdentitySignInResponse,
  IdentitySignOutResponse,
  RoomBangumiGetResponse,
  RoomBangumiMoveResponse,
  RoomBangumiPendingClearResponse,
  RoomCreateData,
  RoomCreateResponse,
  RoomEnmokuCreateResponse,
  RoomEnmokuDeleteResponse,
  RoomEnmokuPreviewResponse,
  RoomGetResponse,
  RoomMemberDeleteResponse,
  SiteConfigResponse,
} from "../generated/index"
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

export function fetchRoom(
  roomId: string,
  options: HttpRequestOptions = {},
): Promise<RoomGetResponse> {
  return roomGet({ path: { id: roomId }, ...options, throwOnError: false }).then((result) =>
    unwrapResult<RoomGetResponse>(result),
  )
}

export function fetchRoomBangumi(
  roomId: string,
  options: HttpRequestOptions = {},
): Promise<RoomBangumiGetResponse> {
  return roomBangumiGet({ path: { id: roomId }, ...options, throwOnError: false }).then((result) =>
    unwrapResult<RoomBangumiGetResponse>(result),
  )
}

export function previewRoomEnmoku(
  roomId: string,
  sourceUrl: string,
  title?: string,
  options: HttpRequestOptions = {},
): Promise<RoomEnmokuPreviewResponse> {
  return roomEnmokuPreview({
    path: { id: roomId },
    body: { sourceUrl, ...(title ? { title } : {}) },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<RoomEnmokuPreviewResponse>(result))
}

export function createRoomEnmoku(
  roomId: string,
  sourceUrl: string,
  title?: string,
  options: HttpRequestOptions = {},
): Promise<RoomEnmokuCreateResponse> {
  return roomEnmokuCreate({
    path: { id: roomId },
    body: { sourceUrl, ...(title ? { title } : {}) },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<RoomEnmokuCreateResponse>(result))
}

export function deleteRoomEnmoku(
  roomId: string,
  enmokuId: string,
  options: HttpRequestOptions = {},
): Promise<RoomEnmokuDeleteResponse> {
  return roomEnmokuDelete({ path: { id: roomId, enmokuId }, ...options, throwOnError: false }).then(
    (result) => unwrapResult<RoomEnmokuDeleteResponse>(result),
  )
}

export function clearPendingRoomBangumi(
  roomId: string,
  options: HttpRequestOptions = {},
): Promise<RoomBangumiPendingClearResponse> {
  return roomBangumiPendingClear({ path: { id: roomId }, ...options, throwOnError: false }).then(
    (result) => unwrapResult<RoomBangumiPendingClearResponse>(result),
  )
}

export function deleteRoomMember(
  roomId: string,
  seitoId: string,
  options: HttpRequestOptions = {},
): Promise<RoomMemberDeleteResponse> {
  return roomMemberDelete({ path: { id: roomId, seitoId }, ...options, throwOnError: false }).then(
    (result) => unwrapResult<RoomMemberDeleteResponse>(result),
  )
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

export function requestBaiduAdapterPairing(
  deviceId: string,
  localPaired: boolean,
  options: HttpRequestOptions = {},
): Promise<BaiduAdaptorPairingResponse> {
  return baiduAdaptorPairing({
    body: { deviceId, localPaired },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<BaiduAdaptorPairingResponse>(result))
}

export function startBaiduOauth(
  retentionMode: BaiduOAuthStartData["body"]["retentionMode"],
  deviceId?: string,
  options: HttpRequestOptions = {},
): Promise<BaiduOAuthStartResponse> {
  return baiduOAuthStart({
    body: { retentionMode, ...(deviceId === undefined ? {} : { deviceId }) },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<BaiduOAuthStartResponse>(result))
}

export function revokeBaiduConnection(
  options: HttpRequestOptions = {},
): Promise<BaiduConnectionDeleteResponse> {
  return baiduConnectionDelete({ ...options, throwOnError: false }).then((result) =>
    unwrapResult<BaiduConnectionDeleteResponse>(result),
  )
}

export function createBaiduSource(
  body: BaiduSourceCreateData["body"],
  options: HttpRequestOptions = {},
): Promise<BaiduSourceCreateResponse> {
  return baiduSourceCreate({ body, ...options, throwOnError: false }).then((result) =>
    unwrapResult<BaiduSourceCreateResponse>(result),
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
  onPending?: () => void
}

// Invoke once for an active preparation. Errors are never replayed; cancel the
// signal on logout, room/source change or preparation disposal.
export async function prepareBaiduGrant(
  sourceId: string,
  roomId: string,
  { signal, maxPolls = 10, pollIntervalMs = 1_000, onPending }: BaiduGrantPreparationOptions,
): Promise<BaiduPlaybackGrantPollResponse> {
  if (!Number.isInteger(maxPolls) || maxPolls < 0) {
    throw new RangeError("maxPolls must be a non-negative integer")
  }
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new RangeError("pollIntervalMs must be finite and non-negative")
  }
  assertNotAborted(signal)
  let grant = await createBaiduGrant(sourceId, roomId, { signal })
  assertNotAborted(signal)
  if (grant.state === "pending") onPending?.()
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

export function fetchLegacyDanmakuCues(
  ref: string,
  options: HttpRequestOptions = {},
): Promise<EishaDanmakuResponse> {
  return eishaDanmaku({ path: { ref }, ...options, throwOnError: false }).then((result) =>
    unwrapResult<EishaDanmakuResponse>(result),
  )
}

export function setDanmakuRoomDefault(
  roomId: string,
  enmokuId: string,
  trackId: string,
  options: HttpRequestOptions = {},
): Promise<DanmakuEnmokuDefaultUpdateResponse> {
  return danmakuEnmokuDefaultUpdate({
    path: { bushitsuId: roomId, enmokuId },
    body: { trackId },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<DanmakuEnmokuDefaultUpdateResponse>(result))
}

export function clearDanmakuRoomDefault(
  roomId: string,
  enmokuId: string,
  options: HttpRequestOptions = {},
): Promise<DanmakuEnmokuDefaultDeleteResponse> {
  return danmakuEnmokuDefaultDelete({
    path: { bushitsuId: roomId, enmokuId },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<DanmakuEnmokuDefaultDeleteResponse>(result))
}

export function submitDanmakuPublicProposal(
  releaseId: string,
  evidence: DanmakuProposalCreateData["body"]["evidence"],
  options: HttpRequestOptions = {},
): Promise<DanmakuProposalCreateResponse> {
  return danmakuProposalCreate({
    body: { releaseId, evidence },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<DanmakuProposalCreateResponse>(result))
}

export function confirmDanmakuPersonalMatch(
  releaseId: string,
  episodeId: string,
  evidence: DanmakuMatchCreateData["body"]["evidence"],
  options: HttpRequestOptions = {},
): Promise<DanmakuMatchCreateResponse> {
  return danmakuMatchCreate({
    body: { releaseId, episodeId, trustScope: "personal", evidence },
    ...options,
    throwOnError: false,
  }).then((result) => unwrapResult<DanmakuMatchCreateResponse>(result))
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
