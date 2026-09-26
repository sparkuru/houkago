import { createContext, useContext, useSyncExternalStore } from "react"
import type { AppRuntime, Identity } from "./runtime"
export const RuntimeContext = createContext<AppRuntime | null>(null)
export function useRuntime() {
  const value = useContext(RuntimeContext)
  if (!value) throw new Error("App runtime is missing")
  return value
}
export function useIdentity() {
  const runtime = useRuntime()
  const state = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
  const query = useResourceState<Identity>(runtime.identityKey())
  return { runtime, state, identity: query?.data }
}

export function useResourceState<T>(key: readonly unknown[]) {
  const runtime = useRuntime()
  return useSyncExternalStore(runtime.subscribeQueries, () =>
    runtime.queryClient.getQueryState<T>(key),
  )
}
