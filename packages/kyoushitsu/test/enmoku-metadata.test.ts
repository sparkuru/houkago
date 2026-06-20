import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import {
  bilibiliProvider,
  enmokuMetadataSummary,
  enmokuPlayableUrl,
  enmokuSourceChoices,
  providerStatItems,
  sourceIndexFromValue,
  sourceValue,
} from "../src/lib/enmoku-metadata"

const enmoku: Enmoku = {
  id: "e1",
  bushitsuId: "r1",
  title: "hls",
  type: "hls",
  url: "https://housou.test/eisha/proxy/master",
  sources: [
    { name: "1080p", url: "https://housou.test/eisha/proxy/1080" },
    { name: "1080p · hvc1", url: "https://housou.test/eisha/proxy/1080-hvc1" },
    { name: "360p · hvc1", url: "https://housou.test/eisha/proxy/360-hvc1" },
    { name: "", url: "https://housou.test/eisha/proxy/fallback" },
  ],
  subtitles: {
    English: { type: "hls", url: "https://housou.test/eisha/proxy/sub-en" },
    Japanese: { type: "hls", url: "https://housou.test/eisha/proxy/sub-ja" },
  },
  live: false,
  provider: {
    kind: "bilibili",
    url: "https://www.bilibili.com/video/BV1xx411c7mD/",
    coverUrl: "https://i0.hdslb.com/bfs/archive/cover.jpg",
    ownerName: "字幕君",
    stats: { view: 100, danmaku: 20, reply: 3, coin: 4, like: 5 },
  },
  addedBy: "host",
}

test("builds source choices with primary and parsed source URLs", () => {
  expect(enmokuSourceChoices(enmoku, "自动").map((choice) => choice.label)).toEqual([
    "自动",
    "1080p",
    "Source 4",
  ])
  expect(enmokuSourceChoices(enmoku, "自动").map((choice) => choice.url)).toEqual([
    "https://housou.test/eisha/proxy/master",
    "https://housou.test/eisha/proxy/1080",
    "https://housou.test/eisha/proxy/fallback",
  ])
  expect(enmokuSourceChoices(enmoku, "自动").map((choice) => choice.sourceIndex)).toEqual([
    null,
    0,
    3,
  ])
})

test("resolves playable URL from selected source index with fallback", () => {
  expect(enmokuPlayableUrl(enmoku, null)).toBe("https://housou.test/eisha/proxy/master")
  expect(enmokuPlayableUrl(enmoku, 0)).toBe("https://housou.test/eisha/proxy/1080")
  expect(enmokuPlayableUrl(enmoku, 99)).toBe("https://housou.test/eisha/proxy/master")
})

test("summarizes optional metadata without inventing empty defaults", () => {
  expect(enmokuMetadataSummary(enmoku)).toEqual({
    sourceCount: 4,
    subtitleNames: ["English", "Japanese"],
    live: false,
    hasMetadata: true,
  })
  expect(
    enmokuMetadataSummary({ ...enmoku, sources: undefined, subtitles: undefined, live: undefined }),
  ).toEqual({
    sourceCount: 0,
    subtitleNames: [],
    live: undefined,
    hasMetadata: true,
  })
  expect(
    enmokuMetadataSummary({
      ...enmoku,
      sources: undefined,
      subtitles: undefined,
      live: undefined,
      provider: undefined,
    }),
  ).toEqual({
    sourceCount: 0,
    subtitleNames: [],
    live: undefined,
    hasMetadata: false,
  })
})

test("round-trips source select values", () => {
  expect(sourceValue(null)).toBe("primary")
  expect(sourceValue(2)).toBe("source:2")
  expect(sourceIndexFromValue("primary")).toBeNull()
  expect(sourceIndexFromValue("source:2")).toBe(2)
  expect(sourceIndexFromValue("source:-1")).toBeNull()
  expect(sourceIndexFromValue("source:nope")).toBeNull()
})

test("extracts provider metadata view models", () => {
  expect(bilibiliProvider(enmoku)?.ownerName).toBe("字幕君")
  expect(providerStatItems(enmoku.provider)).toEqual([
    { key: "view", value: 100 },
    { key: "danmaku", value: 20 },
    { key: "reply", value: 3 },
    { key: "coin", value: 4 },
    { key: "like", value: 5 },
  ])
  expect(bilibiliProvider({ ...enmoku, provider: undefined })).toBeNull()
  expect(providerStatItems(undefined)).toEqual([])
})
