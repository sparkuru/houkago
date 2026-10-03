export type BrowserOperationId = keyof typeof import("../generated/sdk.gen")
export type ResourceKey = readonly [BrowserOperationId, ...string[]]

export type DanmakuCandidateKeyInput = {
  sessionScope: string
  roomId: string
  enmokuId: string
  sourceId?: string
  releaseId?: string
  duration?: number
  fingerprint?: string
  fingerprintBytes?: number
  query?: string
  cursor?: string
}

export const WS_AUTHORITY_FIELDS = [
  "admission",
  "permissions",
  "roster",
  "currentPlayback",
  "liveQueue",
] as const

const privateRoots = new Set([
  "identityMe",
  "roomGet",
  "roomBangumiGet",
  "baiduStatus",
  "baiduFilesList",
  "baiduSourceAvailability",
  "danmakuCandidatesResolve",
  "danmakuEpisodeSearch",
  "baiduPlaybackGrantCreate",
])
const wsAuthorityFields = new Set<string>(WS_AUTHORITY_FIELDS)

export function siteConfigKey(): ResourceKey {
  return ["siteConfig"]
}

export function identityMeKey(sessionScope: string): ResourceKey {
  return ["identityMe", sessionScope]
}

export function roomBootstrapKey(sessionScope: string, roomId: string): ResourceKey {
  return ["roomGet", sessionScope, roomId]
}

export function bangumiBootstrapKey(
  sessionScope: string,
  roomId: string,
  bootstrapGeneration: string,
): ResourceKey {
  return ["roomBangumiGet", sessionScope, roomId, bootstrapGeneration]
}

export function providerStatusKey(provider: string, sessionScope: string): ResourceKey {
  return ["baiduStatus", provider, sessionScope]
}

export function providerFilesKey(
  provider: string,
  sessionScope: string,
  path: string,
  cursor?: string,
): ResourceKey {
  return ["baiduFilesList", provider, sessionScope, path, cursor ?? ""]
}

export function baiduAvailabilityKey(
  sessionScope: string,
  roomId: string,
  sourceId: string,
): ResourceKey {
  return ["baiduSourceAvailability", sessionScope, roomId, sourceId]
}

export function danmakuCandidatesKey(input: DanmakuCandidateKeyInput): ResourceKey {
  return [
    "danmakuCandidatesResolve",
    input.sessionScope,
    input.roomId,
    input.enmokuId,
    input.sourceId ?? "",
    input.releaseId ?? "",
    input.duration === undefined ? "" : String(input.duration),
    input.fingerprint ?? "",
    input.fingerprintBytes === undefined ? "" : String(input.fingerprintBytes),
    normalizeSearchQuery(input.query),
    input.cursor ?? "",
  ]
}

export function grantWorkflowKey(
  sessionScope: string,
  roomId: string,
  sourceId: string,
  workflowId: string,
): ResourceKey {
  return ["baiduPlaybackGrantCreate", sessionScope, roomId, sourceId, workflowId]
}

export function danmakuSearchKey(sessionScope: string, query = ""): ResourceKey {
  return ["danmakuEpisodeSearch", sessionScope, normalizeSearchQuery(query)]
}

// Commands only return recovery hints after acknowledgement. The room session
// still decides whether to apply a subsequent bootstrap snapshot.
export function roomCommandInvalidations(
  sessionScope: string,
  roomId: string,
  bootstrapGeneration: string,
): ResourceKey[] {
  return [
    roomBootstrapKey(sessionScope, roomId),
    bangumiBootstrapKey(sessionScope, roomId, bootstrapGeneration),
  ]
}

export type PrivateResourceCache = {
  cancel: (matches: (key: readonly unknown[]) => boolean) => Promise<void>
  remove: (matches: (key: readonly unknown[]) => boolean) => void
}

export async function purgePrivateResources(cache: PrivateResourceCache): Promise<void> {
  try {
    await cache.cancel(isPrivateResourceKey)
  } finally {
    cache.remove(isPrivateResourceKey)
  }
}

export function isPrivateResourceKey(key: readonly unknown[]): boolean {
  const root = key[0]
  return typeof root === "string" && privateRoots.has(root)
}

export function purgePrivateResourceKeys(keys: Iterable<ResourceKey>): ResourceKey[] {
  return [...keys].filter((key) => !isPrivateResourceKey(key))
}

export function isWsAuthorityKey(key: readonly unknown[]): boolean {
  return key[0] === "ws-authority"
}

export function isWsAuthorityField(value: string): boolean {
  return wsAuthorityFields.has(value)
}

export function normalizeSearchQuery(value = ""): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}
