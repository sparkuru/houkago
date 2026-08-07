import type { BaiduPlaybackGrant } from "houkago-kousoku"

export function shouldPollPendingBaiduGrant(
  grant: BaiduPlaybackGrant,
  now: number,
): grant is Extract<BaiduPlaybackGrant, { state: "pending" }> {
  return grant.state === "pending" && now < grant.expiresAt
}
