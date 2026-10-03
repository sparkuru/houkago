import type { BaiduProvider, BaiduSourceAvailability, Enmoku } from "houkago-kousoku"

export type BaiduClientState = "ready" | "missing" | "incompatible" | "mobile"

export type BaiduBrowserState =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "disconnected"
  | "expired"
  | "success"

export type BaiduPlaybackAvailability =
  | { ready: true; reason: null }
  | {
      ready: false
      reason:
        | "not-baidu"
        | "mobile"
        | "adaptor-missing"
        | "adaptor-incompatible"
        | "availability-unknown"
        | "owner-offline"
        | "reconnect-required"
        | "integration-unavailable"
    }

export function baiduProvider(enmoku: Enmoku): BaiduProvider | null {
  return enmoku.provider?.kind === "baidu" ? enmoku.provider : null
}

export function baiduPlaybackAvailability(
  enmoku: Enmoku,
  clientState: BaiduClientState,
  sourceAvailability?: BaiduSourceAvailability | null,
): BaiduPlaybackAvailability {
  if (!baiduProvider(enmoku)) return { ready: false, reason: "not-baidu" }
  if (clientState === "mobile") return { ready: false, reason: "mobile" }
  if (clientState === "missing") return { ready: false, reason: "adaptor-missing" }
  if (clientState === "incompatible") return { ready: false, reason: "adaptor-incompatible" }
  if (!sourceAvailability || sourceAvailability.sourceId !== baiduProvider(enmoku)?.sourceId) {
    return { ready: false, reason: "availability-unknown" }
  }
  if (!sourceAvailability.playable) {
    return {
      ready: false,
      reason:
        sourceAvailability.reason === "owner-offline" ? "owner-offline" : "reconnect-required",
    }
  }
  return { ready: true, reason: null }
}

export function isMobileBaiduClient(userAgent: string, maxTouchPoints = 0): boolean {
  if (/Android|iPhone|iPod|Mobile/i.test(userAgent)) return true
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}

export function formatBaiduFileSize(size?: number): string {
  if (size === undefined) return ""
  if (size < 1024) return `${size} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = size / 1024
  let unit = units[0]
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024
    unit = units[index]
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`
}

export function baiduBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  const segments = path.split("/").filter(Boolean)
  const breadcrumbs = [{ label: "/", path: "/" }]
  let current = ""
  for (const segment of segments) {
    current += `/${segment}`
    breadcrumbs.push({ label: segment, path: current })
  }
  return breadcrumbs
}

export function baiduParentPath(path: string): string | null {
  const segments = path.split("/").filter(Boolean)
  if (segments.length === 0) return null
  segments.pop()
  return segments.length === 0 ? "/" : `/${segments.join("/")}`
}
