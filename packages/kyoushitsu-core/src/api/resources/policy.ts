export type RetryFailure = {
  status?: number
  code?: string
  kind?: "http" | "network" | "aborted" | "protocol"
}

export type ResourcePolicy = {
  authority: "http" | "ws"
  enabledWhen: "always" | "session" | "room" | "active-panel" | "preparation"
  staleTimeMs: number
  refetchOnFocus: boolean
  refetchOnReconnect: boolean
  abortOnDisable: boolean
  purgeOnLogout: boolean
  cacheable: boolean
  replayable: boolean
  retry: (failure: RetryFailure, attempt: number) => boolean
}

const retryTransientOnce = (failure: RetryFailure, attempt: number): boolean =>
  attempt < 1 &&
  failure.kind !== "aborted" &&
  failure.kind !== "protocol" &&
  (failure.status === undefined || failure.status >= 500)

const retryNever = (): boolean => false

export const RESOURCE_POLICIES = {
  siteConfig: {
    authority: "http",
    enabledWhen: "always",
    staleTimeMs: Number.POSITIVE_INFINITY,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: false,
    purgeOnLogout: false,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  identityMe: {
    authority: "http",
    enabledWhen: "always",
    staleTimeMs: 0,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  roomMetadata: {
    authority: "http",
    enabledWhen: "room",
    staleTimeMs: 30_000,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  bangumiBootstrap: {
    authority: "http",
    enabledWhen: "room",
    staleTimeMs: Number.POSITIVE_INFINITY,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  providerStatus: {
    authority: "http",
    enabledWhen: "session",
    staleTimeMs: 15_000,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  providerFiles: {
    authority: "http",
    enabledWhen: "active-panel",
    staleTimeMs: 5_000,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  baiduAvailability: {
    authority: "http",
    enabledWhen: "preparation",
    staleTimeMs: 5_000,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  danmakuCandidates: {
    authority: "http",
    enabledWhen: "room",
    staleTimeMs: 30_000,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  danmakuSearch: {
    authority: "http",
    enabledWhen: "session",
    staleTimeMs: 30_000,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: true,
    replayable: true,
    retry: retryTransientOnce,
  },
  command: {
    authority: "http",
    enabledWhen: "session",
    staleTimeMs: 0,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: false,
    replayable: false,
    retry: retryNever,
  },
  identityCommand: {
    authority: "http",
    enabledWhen: "always",
    staleTimeMs: 0,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: false,
    replayable: false,
    retry: retryNever,
  },
  grantWorkflow: {
    authority: "http",
    enabledWhen: "preparation",
    staleTimeMs: 0,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: false,
    replayable: false,
    retry: retryNever,
  },
  roomLiveAuthority: {
    authority: "ws",
    enabledWhen: "room",
    staleTimeMs: 0,
    refetchOnFocus: false,
    refetchOnReconnect: false,
    abortOnDisable: true,
    purgeOnLogout: true,
    cacheable: false,
    replayable: false,
    retry: retryNever,
  },
} satisfies Record<string, ResourcePolicy>

export type ResourceName = keyof typeof RESOURCE_POLICIES

export function shouldRetry(
  resource: ResourceName,
  failure: RetryFailure,
  attempt: number,
): boolean {
  return RESOURCE_POLICIES[resource].retry(failure, attempt)
}

export function isWsAuthorityResource(resource: ResourceName): boolean {
  return RESOURCE_POLICIES[resource].authority === "ws"
}

export function isReplayableResource(resource: ResourceName): boolean {
  return RESOURCE_POLICIES[resource].replayable
}
