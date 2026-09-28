import {
  BAIDU_MEDIA_FINGERPRINT_CAPABILITY,
  type BaiduMediaFingerprint,
  type Enmoku,
} from "houkago-kousoku"
import {
  type BaiduAdapterDetection,
  detectBaiduAdapter,
} from "houkago-kyoushitsu/baidu-adapter-detection"
import { isMobileBaiduClient } from "houkago-kyoushitsu/baidu-provider"
import { adapterCapabilityReady, houkagoAdapter } from "houkago-kyoushitsu/houkago-adapter"
import { housouUrl } from "houkago-kyoushitsu/housou-url"
import {
  fetchBaiduAvailability,
  prepareBaiduGrant,
  requestBaiduAdapterPairing,
} from "houkago-kyoushitsu/http"
import type {
  BaiduPlaybackGrantPollResponse,
  BaiduSourceAvailabilityResponse,
} from "houkago-kyoushitsu/http/generated"
import { useEffect, useState } from "react"

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

export type BaiduPlayback = {
  state: BaiduPlaybackState
  grantUrl: string | null
  fingerprint: BaiduMediaFingerprint | null
  retry: () => void
}

type ScopedPlayback = Omit<BaiduPlayback, "retry"> & { scope: string }

export type BaiduPlaybackDependencies = {
  availability: (
    sourceId: string,
    roomId: string,
    signal: AbortSignal,
  ) => Promise<BaiduSourceAvailabilityResponse>
  detect: (signal: AbortSignal) => Promise<BaiduAdapterDetection>
  grant: (
    sourceId: string,
    roomId: string,
    signal: AbortSignal,
    onPending: () => void,
  ) => Promise<BaiduPlaybackGrantPollResponse>
  fingerprint: (
    sourceId: string,
    roomId: string,
    grantUrl: string,
    expiresAt: number,
  ) => Promise<BaiduMediaFingerprint>
  prepareMedia: (grantUrl: string, expiresAt: number) => Promise<void>
}

const defaultDependencies: BaiduPlaybackDependencies = {
  availability: (sourceId, roomId, signal) => fetchBaiduAvailability(sourceId, roomId, { signal }),
  detect: (signal) =>
    detectBaiduAdapter({
      hello: () => houkagoAdapter.hello(),
      pair: (base, code) => houkagoAdapter.pair(base, code),
      requestPairing: async (deviceId, localPaired) => ({
        data: await requestBaiduAdapterPairing(deviceId, localPaired, { signal }),
      }),
      serverBase: housouUrl,
    }),
  grant: (sourceId, roomId, signal, onPending) =>
    prepareBaiduGrant(sourceId, roomId, {
      signal,
      maxPolls: 225,
      pollIntervalMs: 400,
      onPending,
    }),
  fingerprint: (sourceId, roomId, grantUrl, expiresAt) =>
    houkagoAdapter.fingerprintBaiduMedia(sourceId, roomId, grantUrl, expiresAt),
  prepareMedia: (grantUrl, expiresAt) => houkagoAdapter.prepareBaiduMedia(grantUrl, expiresAt),
}

const unavailable: Omit<BaiduPlayback, "retry"> = {
  state: "unavailable",
  grantUrl: null,
  fingerprint: null,
}

export async function prepareBaiduPlayback(
  sourceId: string,
  roomId: string,
  signal: AbortSignal,
  onPending: () => void,
  dependencies: BaiduPlaybackDependencies = defaultDependencies,
): Promise<Omit<BaiduPlayback, "retry">> {
  const assertActive = () => {
    if (signal.aborted) throw new DOMException("Baidu playback cancelled", "AbortError")
  }
  assertActive()
  const availability = await dependencies.availability(sourceId, roomId, signal)
  assertActive()
  if (!availability.playable)
    return {
      state: availability.reason === "owner-offline" ? "owner-offline" : "connection-revoked",
      grantUrl: null,
      fingerprint: null,
    }
  const detection = await dependencies.detect(signal)
  assertActive()
  if (detection.state !== "ready")
    return {
      state: detection.state === "missing" ? "adaptor-missing" : "adaptor-incompatible",
      grantUrl: null,
      fingerprint: null,
    }
  let grant = await dependencies.grant(sourceId, roomId, signal, onPending)
  assertActive()
  if (grant.state !== "ready") return unavailable
  if (adapterCapabilityReady(detection.hello, BAIDU_MEDIA_FINGERPRINT_CAPABILITY)) {
    try {
      const fingerprint = await dependencies.fingerprint(
        sourceId,
        roomId,
        grant.grantUrl,
        grant.expiresAt,
      )
      assertActive()
      return { state: "ready", grantUrl: grant.grantUrl, fingerprint }
    } catch {
      assertActive()
      // A failed optional fingerprint may have claimed the one-use grant.
      grant = await dependencies.grant(sourceId, roomId, signal, onPending)
      assertActive()
      if (grant.state !== "ready") return unavailable
    }
  }
  await dependencies.prepareMedia(grant.grantUrl, grant.expiresAt)
  assertActive()
  return { state: "ready", grantUrl: grant.grantUrl, fingerprint: null }
}

export function useBaiduPlayback(roomId: string, enmoku: Enmoku | null): BaiduPlayback {
  const sourceId = enmoku?.provider?.kind === "baidu" ? enmoku.provider.sourceId : null
  const [attempt, setAttempt] = useState(0)
  const scope = `${roomId}:${enmoku?.id ?? ""}:${sourceId ?? ""}:${attempt}`
  const [result, setResult] = useState<ScopedPlayback>({
    scope,
    state: "idle",
    grantUrl: null,
    fingerprint: null,
  })

  useEffect(() => {
    const abort = new AbortController()
    let active = true
    let startTimer: ReturnType<typeof setTimeout> | undefined
    const publish = (next: Omit<BaiduPlayback, "retry">) => {
      if (active && !abort.signal.aborted) setResult({ ...next, scope })
    }

    if (!sourceId) {
      publish({ state: "idle", grantUrl: null, fingerprint: null })
    } else if (isMobileBaiduClient(navigator.userAgent, navigator.maxTouchPoints)) {
      publish({ state: "mobile", grantUrl: null, fingerprint: null })
    } else {
      publish({ state: "preparing", grantUrl: null, fingerprint: null })
      // Strict Mode disposes its first effect before this starts a one-use grant.
      startTimer = setTimeout(() => {
        void prepare()
      }, 0)
    }

    async function prepare(): Promise<void> {
      if (!sourceId || abort.signal.aborted) return
      try {
        publish(
          await prepareBaiduPlayback(sourceId, roomId, abort.signal, () =>
            publish({ state: "waiting-owner", grantUrl: null, fingerprint: null }),
          ),
        )
      } catch {
        publish(unavailable)
      }
    }

    return () => {
      active = false
      clearTimeout(startTimer)
      abort.abort()
    }
  }, [roomId, sourceId, scope])

  const visible =
    result.scope === scope
      ? result
      : { state: "preparing" as const, grantUrl: null, fingerprint: null }
  return { ...visible, retry: () => setAttempt((value) => value + 1) }
}
