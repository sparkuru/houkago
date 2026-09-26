import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import type { BaiduPlaybackGrantPollResponse, RoomBangumiGetResponse } from "../src/api/generated"

test("generated record DTO values assign to canonical Enmoku without a cast", () => {
  const queue: RoomBangumiGetResponse = [
    {
      id: "enmoku-1",
      bushitsuId: "room-1",
      title: "Episode",
      type: "direct",
      url: "https://media.test/video.mp4",
      headers: { Referer: "https://media.test" },
      subtitles: { English: { url: "https://media.test/subtitle.vtt", type: "vtt" } },
      addedBy: "seito-1",
    },
  ]
  const canonical: Enmoku[] = queue
  const headers: Record<string, string> | undefined = queue[0]?.headers
  const subtitles: Record<string, { url: string; type: string }> | undefined = queue[0]?.subtitles
  expect(canonical[0]?.headers).toEqual(headers)
  expect(subtitles?.English?.type).toBe("vtt")
})

function describeGrant(grant: BaiduPlaybackGrantPollResponse): string {
  switch (grant.state) {
    case "pending":
      return grant.requestId
    case "ready":
      return grant.grantUrl
    case "failed":
      return grant.reason
  }
}

test("generated grant union discriminants expose the correct branch fields", () => {
  expect(describeGrant({ state: "pending", requestId: "request-1", expiresAt: 123 })).toBe(
    "request-1",
  )
  expect(describeGrant({ state: "failed", reason: "upstream-resolution-failed" })).toBe(
    "upstream-resolution-failed",
  )
})
