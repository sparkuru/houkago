import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import {
  baiduBreadcrumbs,
  baiduParentPath,
  baiduPlaybackAvailability,
  baiduProvider,
  formatBaiduFileSize,
  isMobileBaiduClient,
} from "../src/lib/baidu-provider"

const baiduEnmoku: Enmoku = {
  id: "e1",
  bushitsuId: "room-1",
  title: "movie",
  type: "direct",
  url: "/baidu/media/source-1",
  addedBy: "alice",
  provider: { kind: "baidu", sourceId: "source-1", fileName: "movie.mp4" },
}

test("Baidu provider helper narrows without affecting ordinary sources", () => {
  expect(baiduProvider(baiduEnmoku)?.sourceId).toBe("source-1")
  expect(baiduProvider({ ...baiduEnmoku, provider: undefined })).toBeNull()
  expect(baiduPlaybackAvailability({ ...baiduEnmoku, provider: undefined }, "missing").reason).toBe(
    "not-baidu",
  )
})

test("Baidu playback availability combines source policy with the viewer client boundary", () => {
  const availability = {
    sourceId: "source-1",
    mode: "server-saved" as const,
    ownerOnline: false,
    playable: true,
  }
  expect(baiduPlaybackAvailability(baiduEnmoku, "ready", availability)).toEqual({
    ready: true,
    reason: null,
  })
  expect(baiduPlaybackAvailability(baiduEnmoku, "mobile").reason).toBe("mobile")
  expect(baiduPlaybackAvailability(baiduEnmoku, "missing").reason).toBe("adaptor-missing")
  expect(baiduPlaybackAvailability(baiduEnmoku, "ready").reason).toBe("availability-unknown")
  expect(
    baiduPlaybackAvailability(baiduEnmoku, "ready", {
      ...availability,
      mode: "user-held",
      playable: false,
      reason: "owner-offline",
    }).reason,
  ).toBe("owner-offline")
})

test("Baidu directory helpers keep navigation and metadata predictable", () => {
  expect(baiduBreadcrumbs("/video/anime")).toEqual([
    { label: "/", path: "/" },
    { label: "video", path: "/video" },
    { label: "anime", path: "/video/anime" },
  ])
  expect(baiduParentPath("/video/anime")).toBe("/video")
  expect(baiduParentPath("/")).toBeNull()
  expect(formatBaiduFileSize(1_572_864)).toBe("1.5 MB")
})

test("mobile detection covers phones and touch iPads without flagging desktop", () => {
  expect(isMobileBaiduClient("Mozilla/5.0 (Linux; Android 15; Mobile)")).toBe(true)
  expect(isMobileBaiduClient("Mozilla/5.0 (Macintosh; Intel Mac OS X)", 5)).toBe(true)
  expect(isMobileBaiduClient("Mozilla/5.0 (X11; Linux x86_64)", 0)).toBe(false)
})
