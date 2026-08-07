import {
  createBaiduPlaybackGrant,
  fetchBaiduSourceAvailability,
  pollBaiduPlaybackGrant,
} from "@/api/baidu"
import { detectAndPairBaiduAdapter } from "@/composables/baidu-adapter"
import { shouldPollPendingBaiduGrant } from "@/lib/baidu-grant-polling"
import { type BaiduClientState, baiduProvider, isMobileBaiduClient } from "@/lib/baidu-provider"
import { houkagoAdapter } from "@/lib/houkago-adapter"
import type { BaiduPlaybackGrant, BaiduSourceAvailability, Enmoku } from "houkago-kousoku"
import { onBeforeUnmount, ref } from "vue"

export type BaiduPlaybackState =
  | "idle"
  | "preparing"
  | "waiting-owner"
  | "ready"
  | "mobile"
  | "adaptor-missing"
  | "adaptor-incompatible"
  | "owner-offline"
  | "connection-revoked"
  | "unavailable"

const POLL_INTERVAL_MS = 400

export function useBaiduPlayback(bushitsuId: string) {
  const state = ref<BaiduPlaybackState>("idle")
  const preparedGrantUrl = ref("")
  const clientState = ref<BaiduClientState>(mobileClient() ? "mobile" : "missing")
  const availabilityBySourceId = ref<Record<string, BaiduSourceAvailability>>({})
  let preparation = 0

  async function checkAdapter(): Promise<BaiduClientState> {
    if (clientState.value === "mobile") return clientState.value
    const detection = await detectAndPairBaiduAdapter()
    clientState.value = detection.state
    return clientState.value
  }

  async function prepare(enmoku: Enmoku | null): Promise<void> {
    const provider = enmoku ? baiduProvider(enmoku) : null
    const request = ++preparation
    preparedGrantUrl.value = ""
    if (!enmoku || !provider) {
      state.value = "idle"
      return
    }
    if (clientState.value === "mobile") {
      state.value = "mobile"
      return
    }

    state.value = "preparing"
    const availability = await refreshAvailability(enmoku)
    if (request !== preparation) return
    if (!availability?.playable) {
      state.value =
        availability?.reason === "owner-offline" ? "owner-offline" : "connection-revoked"
      return
    }
    const detectedState = await checkAdapter()
    if (request !== preparation) return
    if (detectedState === "missing") {
      state.value = "adaptor-missing"
      return
    }
    if (detectedState !== "ready") {
      state.value = "adaptor-incompatible"
      return
    }

    try {
      const response = await createBaiduPlaybackGrant(provider.sourceId, bushitsuId)
      let grant = response.data ?? null
      if (!grant) {
        state.value = "unavailable"
        return
      }
      grant = await awaitReadyGrant(grant, request)
      if (request !== preparation || !grant) return
      if (grant.state === "failed") {
        state.value = "unavailable"
        return
      }
      if (grant.state !== "ready") return
      await houkagoAdapter.prepareBaiduMedia(grant.grantUrl, grant.expiresAt)
      if (request !== preparation) return
      preparedGrantUrl.value = grant.grantUrl
      state.value = "ready"
    } catch {
      if (request === preparation) state.value = "unavailable"
    }
  }

  async function refreshAvailability(enmoku: Enmoku): Promise<BaiduSourceAvailability | null> {
    const provider = baiduProvider(enmoku)
    if (!provider) return null
    try {
      const { data } = await fetchBaiduSourceAvailability(provider.sourceId, bushitsuId)
      if (!data) return null
      availabilityBySourceId.value = {
        ...availabilityBySourceId.value,
        [provider.sourceId]: data,
      }
      return data
    } catch {
      return null
    }
  }

  async function refreshAvailabilities(enmoku: readonly Enmoku[]): Promise<void> {
    await Promise.all(enmoku.filter((item) => baiduProvider(item)).map(refreshAvailability))
  }

  async function awaitReadyGrant(
    grant: BaiduPlaybackGrant,
    request: number,
  ): Promise<BaiduPlaybackGrant | null> {
    let current = grant
    if (current.state === "pending" && request === preparation) state.value = "waiting-owner"
    while (shouldPollPendingBaiduGrant(current, Date.now()) && request === preparation) {
      await delay(POLL_INTERVAL_MS)
      if (request !== preparation) return null
      const response = await pollBaiduPlaybackGrant(current.requestId)
      if (!response.data) return null
      current = response.data
    }
    if (current.state === "pending" && request === preparation) state.value = "unavailable"
    return current
  }

  onBeforeUnmount(() => {
    preparation += 1
  })

  return {
    state,
    preparedGrantUrl,
    clientState,
    availabilityBySourceId,
    checkAdapter,
    refreshAvailability,
    refreshAvailabilities,
    prepare,
  }
}

function mobileClient(): boolean {
  if (typeof navigator === "undefined") return false
  return isMobileBaiduClient(navigator.userAgent, navigator.maxTouchPoints)
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
