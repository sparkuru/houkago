import { QueryClient } from "@tanstack/react-query"
import {
  HoukagoHttpError,
  RESOURCE_POLICIES,
  type ResourceName,
} from "houkago-kyoushitsu-core/http"

export function resourceQueryOptions(name: ResourceName) {
  const policy = RESOURCE_POLICIES[name]
  return {
    staleTime: policy.staleTimeMs,
    gcTime: name === "siteConfig" || name === "identityMe" ? Number.POSITIVE_INFINITY : 5 * 60_000,
    refetchOnWindowFocus: policy.refetchOnFocus,
    refetchOnReconnect: policy.refetchOnReconnect,
    retry: (count: number, error: unknown) =>
      policy.retry(error instanceof HoukagoHttpError ? error : { kind: "protocol" }, count),
    retryDelay: 250,
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
      mutations: { retry: false, gcTime: 0 },
    },
  })
}
