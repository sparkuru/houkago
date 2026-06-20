import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import {
  enmokuMetadataSummary,
  enmokuPlayableUrl,
  enmokuSourceChoices,
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
    { name: "", url: "https://housou.test/eisha/proxy/fallback" },
  ],
  subtitles: {
    English: { type: "hls", url: "https://housou.test/eisha/proxy/sub-en" },
    Japanese: { type: "hls", url: "https://housou.test/eisha/proxy/sub-ja" },
  },
  live: false,
  addedBy: "host",
}

test("builds source choices with primary and parsed source URLs", () => {
  expect(enmokuSourceChoices(enmoku, "自动").map((choice) => choice.label)).toEqual([
    "自动",
    "1080p",
    "Source 2",
  ])
  expect(enmokuSourceChoices(enmoku, "自动").map((choice) => choice.url)).toEqual([
    "https://housou.test/eisha/proxy/master",
    "https://housou.test/eisha/proxy/1080",
    "https://housou.test/eisha/proxy/fallback",
  ])
})

test("resolves playable URL from selected source index with fallback", () => {
  expect(enmokuPlayableUrl(enmoku, null)).toBe("https://housou.test/eisha/proxy/master")
  expect(enmokuPlayableUrl(enmoku, 0)).toBe("https://housou.test/eisha/proxy/1080")
  expect(enmokuPlayableUrl(enmoku, 99)).toBe("https://housou.test/eisha/proxy/master")
})

test("summarizes optional metadata without inventing empty defaults", () => {
  expect(enmokuMetadataSummary(enmoku)).toEqual({
    sourceCount: 2,
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
