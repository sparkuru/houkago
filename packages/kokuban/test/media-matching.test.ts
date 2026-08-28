import { expect, test } from "bun:test"
import {
  extractFilenameEvidence,
  parseMediaFilename,
  rankMediaReleaseCandidates,
  scoreMediaReleaseCandidate,
} from "../src"

test("parses a noisy release filename from its basename", () => {
  expect(
    parseMediaFilename(
      "/private/provider/path/[SubsPlease] Frieren - Beyond Journeys End - S01E02 [1080p][WEB-DL].mkv",
    ),
  ).toEqual({
    normalized: "subsplease frieren beyond journeys end s01e02 1080p web dl",
    work: "frieren beyond journeys end",
    season: 1,
    episode: 2,
    group: "SubsPlease",
    releaseHints: ["1080p", "web-dl"],
    warnings: [],
  })
})

test("recognizes CJK episode markers and excludes technical numbers", () => {
  expect(parseMediaFilename("[字幕组] 进击的巨人 第12集 [1920x1080][HEVC].mp4")).toEqual({
    normalized: "字幕组 进击的巨人 第12集 1920x1080 hevc",
    work: "进击的巨人",
    episode: 12,
    group: "字幕组",
    releaseHints: ["1920x1080", "hevc"],
    warnings: [],
  })
})

test("does not turn ranges or conflicting episode tokens into an exact number", () => {
  expect(parseMediaFilename("[Group] Show 01-02.mkv")).toMatchObject({
    work: "show",
    group: "Group",
    warnings: ["episode-range"],
  })
  expect(parseMediaFilename("[Group] Show S01E02 - 03.mkv")).toMatchObject({
    work: "show",
    season: 1,
    warnings: ["conflicting-episode"],
  })
  expect(parseMediaFilename("/secret/only-a-container-name.mkv")).toMatchObject({
    work: "only a container name",
    warnings: [],
  })
})

test("emits only shared filename evidence and never the source path", () => {
  expect(extractFilenameEvidence("C:\\private\\account\\[Group] Show - 03.mkv")).toEqual({
    kind: "filename",
    work: "show",
    episode: 3,
    group: "Group",
  })
})

test("bounds persisted filename evidence and mismatch details", () => {
  const evidence = extractFilenameEvidence(
    `[${"G".repeat(300)}] ${"Long title ".repeat(80)} - 03.mkv`,
  )
  expect(evidence.kind).toBe("filename")
  expect(evidence.group?.length).toBe(256)
  expect(evidence.work?.length).toBeLessThanOrEqual(256)

  const mismatch = scoreMediaReleaseCandidate(
    { fileName: `${"Observed title ".repeat(80)} - 03.mkv` },
    { id: "episode-3", title: "Different title", episode: 3 },
  )
  expect(mismatch.contributions[0]?.detail.length).toBeLessThanOrEqual(512)
})

test("scores explainable evidence while requiring confirmation", () => {
  const result = scoreMediaReleaseCandidate(
    { fileName: "[Group] Show - 03 [1080p].mkv", size: 100, duration: 601 },
    { id: "episode-3", title: "Show", episode: 3, size: 100, duration: 600 },
  )

  expect(result).toMatchObject({
    candidateId: "episode-3",
    score: 85,
    confidence: "suggested",
    requiresConfirmation: true,
    mismatches: [],
    warnings: [],
  })
  expect(result.contributions.map((item) => [item.field, item.status, item.points])).toEqual([
    ["work", "matched", 50],
    ["season", "missing", 0],
    ["episode", "matched", 25],
    ["size", "matched", 5],
    ["duration", "matched", 5],
  ])
})

test("filename-only and contradictory evidence remain non-authoritative", () => {
  const filenameOnly = scoreMediaReleaseCandidate(
    { fileName: "Show - 03.mkv" },
    { id: "episode-3", title: "Show", episode: 3 },
  )
  expect(filenameOnly.score).toBe(75)
  expect(filenameOnly.confidence).toBe("suggested")
  expect(filenameOnly.requiresConfirmation).toBe(true)

  const mismatch = scoreMediaReleaseCandidate(
    { fileName: "Show - 03.mkv" },
    { id: "episode-4", title: "Show", episode: 4 },
  )
  expect(mismatch.confidence).toBe("none")
  expect(mismatch.mismatches).toEqual(["episode differs: 3 ≠ 4"])
})

test("ranks equal scores deterministically and tolerates small duration drift", () => {
  const results = rankMediaReleaseCandidates({ fileName: "Show - 03.mkv", duration: 600 }, [
    { id: "z", title: "Show", episode: 3, duration: 602 },
    { id: "a", title: "Show", episode: 3, duration: 602 },
  ])

  expect(results.map((item) => item.candidateId)).toEqual(["a", "z"])
  expect(results.every((item) => item.contributions.at(-1)?.status === "matched")).toBe(true)
})
