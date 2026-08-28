import { expect, test } from "bun:test"
import type { Enmoku } from "houkago-kousoku"
import { createLocalDanmakuCandidate } from "../src/lib/local-danmaku-candidate"

const enmoku: Enmoku = {
  id: "local-candidate-enmoku",
  bushitsuId: "local-candidate-room",
  title: "Local candidate fixture",
  type: "direct",
  url: "https://media.example.test/local-candidate.mp4",
  addedBy: "local-candidate-viewer",
}

test("local XML becomes a viewer candidate with parser output and filename evidence", () => {
  const candidate = createLocalDanmakuCandidate(
    enmoku,
    "  episode.xml  ",
    '<i><d p="2,1,25,16711680">hello</d><d p="1,5,25,255">top</d></i>',
    "Empty file",
  )

  expect(candidate).toMatchObject({
    id: "local:media:https://media.example.test/local-candidate.mp4",
    sourceClass: "local",
    name: "episode.xml",
    availability: "available",
    evidence: [{ kind: "filename" }],
  })
  expect(candidate.cues?.map((cue) => cue.text)).toEqual(["top", "hello"])
})

test("empty or malformed local XML is unavailable and cannot win selection", () => {
  for (const input of ["", "<not-danmaku />", '<d p="not-a-time">ignored</d>']) {
    const candidate = createLocalDanmakuCandidate(enmoku, "empty.xml", input, "Empty file")
    expect(candidate).toMatchObject({
      sourceClass: "local",
      availability: "unavailable",
      name: "Empty file",
      reason: "Empty file",
    })
    expect(candidate.cues).toBeUndefined()
  }
})

test("local candidate labels stay bounded and never become empty", () => {
  const candidate = createLocalDanmakuCandidate(enmoku, " ", '<d p="0,1,25,16777215">cue</d>', " ")

  expect(candidate.name).toBe("Empty local danmaku")
  expect(candidate.name.length).toBeGreaterThan(0)

  const longName = createLocalDanmakuCandidate(
    enmoku,
    "x".repeat(300),
    '<d p="0,1,25,16777215">cue</d>',
  )
  expect(longName.name).toHaveLength(256)
})
