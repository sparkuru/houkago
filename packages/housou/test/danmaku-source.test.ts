import { expect, test } from "bun:test"
import type { FetchLike } from "houkago-eisha"
import type { Enmoku } from "houkago-kousoku"
import { insertBushitsuWithBuchou } from "../src/db/queries/bushitsu"
import {
  findDanmakuTrack,
  insertDanmakuEpisode,
  insertMediaRelease,
  listDanmakuRevisions,
  listMediaReleaseEvidence,
} from "../src/db/queries/danmaku"
import { insertKomonGrant } from "../src/db/queries/komon"
import { insertSeito } from "../src/db/queries/seito"
import { addEnmoku } from "../src/domain/bushitsu"
import {
  confirmReleaseEpisodeMatch,
  disableDanmakuRevision,
  resolveDanmakuCandidates,
  rollbackDanmakuRevision,
} from "../src/domain/danmaku"
import {
  ensureBilibiliDanmakuSource,
  refreshBilibiliDanmakuTrack,
} from "../src/domain/danmaku-source"
import { join } from "../src/ws/housou"

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function account(prefix: string): string {
  const accountId = id(prefix)
  insertSeito({
    id: accountId,
    username: accountId,
    usernameNorm: accountId.toLowerCase(),
    passwordHash: "test-only",
    createdAt: 1,
  })
  return accountId
}

function fixture(cues: string): Response {
  return new Response(`<i>${cues}</i>`)
}

function cue(time: number, text: string, mode = "scroll"): string {
  const modeCode = mode === "top" ? 5 : 1
  return `<d p="${time},${modeCode},25,16711680,0,0,0,0">${text}</d>`
}

function createBilibiliFixture(): {
  actorId: string
  bushitsuId: string
  enmoku: Enmoku
  episodeId: string
  reference: string
  releaseId: string
} {
  const actorId = account("source-owner")
  const bushitsuId = id("source-room")
  const episodeId = id("source-episode")
  const releaseId = id("source-release")
  const cid = `62131${crypto.randomUUID().replace(/\D/g, "").slice(0, 8)}`
  const reference = `bilibili:${cid}`

  insertBushitsuWithBuchou({
    id: bushitsuId,
    name: "Bilibili source room",
    buchouId: actorId,
    createdAt: 1,
  })
  insertDanmakuEpisode({
    id: episodeId,
    title: "Bilibili source episode",
    createdAt: 1,
    updatedAt: 1,
  })
  insertMediaRelease({
    id: releaseId,
    provider: "bilibili",
    providerReference: reference,
    createdAt: 1,
  })
  const enmoku = addEnmoku(bushitsuId, {
    title: "Bilibili source",
    type: "direct",
    url: `https://media.example.test/${releaseId}.mp4`,
    danmaku: { type: "fetch", ref: reference },
    addedBy: actorId,
  })
  confirmReleaseEpisodeMatch(actorId, {
    releaseId,
    episodeId,
    trustScope: "room",
    bushitsuId,
    enmokuId: enmoku.id,
    evidence: [{ kind: "provider", provider: "bilibili", reference }],
  })
  join(bushitsuId, actorId, "source owner")

  return { actorId, bushitsuId, enmoku, episodeId, reference, releaseId }
}

test("Bilibili official source ingests, refreshes, deduplicates, and falls back", async () => {
  const source = createBilibiliFixture()
  const firstXml = `${cue(2, " hello ", "top")}${cue(1, "first")}`
  const sameXml = `${cue(1, "first")}${cue(2, "hello", "top")}`
  const changedXml = `${cue(1, "first")}${cue(3, "changed")}`
  const outcomes: Array<string | Error> = [
    firstXml,
    sameXml,
    changedXml,
    new Error("upstream unavailable"),
  ]
  let fetchCount = 0
  const fetcher: FetchLike = async () => {
    fetchCount += 1
    const outcome = outcomes.shift()
    if (outcome instanceof Error) throw outcome
    if (outcome === undefined) throw new Error("unexpected fixture request")
    return fixture(outcome)
  }

  const first = await ensureBilibiliDanmakuSource(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
    { now: 1_000, freshnessMs: 100, fetcher },
  )
  const track = first.tracks[0]
  expect(track).toBeDefined()
  if (!track) throw new Error("official track was not created")
  expect(first.refreshedTrackIds).toEqual([track.id])
  expect(first.failedTrackIds).toEqual([])
  expect(fetchCount).toBe(1)

  const firstRevisions = listDanmakuRevisions(track.id)
  expect(firstRevisions).toHaveLength(1)
  const firstRevision = firstRevisions[0]
  expect(firstRevision).toMatchObject({
    status: "valid",
    provenance: {
      provider: "bilibili",
      reference: source.reference,
      label: "Bilibili official",
    },
  })
  expect(listMediaReleaseEvidence(source.releaseId)).toContainEqual({
    kind: "provider",
    provider: "bilibili",
    reference: source.reference,
  })

  const firstResolution = resolveDanmakuCandidates(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
  )
  const firstCandidate = firstResolution.candidates.find((candidate) => candidate.id === track.id)
  expect(firstCandidate).toMatchObject({
    sourceClass: "provider-official",
    availability: "available",
    cues: [
      { time: 1, text: "first" },
      { time: 2, text: "hello", mode: "top" },
    ],
  })
  expect(
    firstResolution.candidates.some((candidate) => candidate.id === `legacy:${source.enmoku.id}`),
  ).toBe(false)

  const fresh = await ensureBilibiliDanmakuSource(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
    { now: 1_050, freshnessMs: 100, fetcher },
  )
  expect(fresh.refreshedTrackIds).toEqual([])
  expect(fetchCount).toBe(1)

  const unchanged = await ensureBilibiliDanmakuSource(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
    { now: 1_200, freshnessMs: 100, fetcher },
  )
  expect(unchanged.refreshedTrackIds).toEqual([track.id])
  expect(unchanged.failedTrackIds).toEqual([])
  expect(fetchCount).toBe(2)
  expect(listDanmakuRevisions(track.id)).toHaveLength(1)
  expect(unchanged.tracks[0]?.activeRevisionId).toBe(firstRevision?.id)

  const changed = await ensureBilibiliDanmakuSource(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
    { now: 1_400, freshnessMs: 100, fetcher },
  )
  expect(changed.refreshedTrackIds).toEqual([track.id])
  expect(changed.failedTrackIds).toEqual([])
  expect(fetchCount).toBe(3)
  const changedRevision = listDanmakuRevisions(track.id)[0]
  expect(changedRevision?.status).toBe("valid")
  expect(changedRevision?.id).not.toBe(firstRevision?.id)
  expect(findDanmakuTrack(track.id)?.activeRevisionId).toBe(changedRevision?.id)

  const failed = await ensureBilibiliDanmakuSource(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
    { now: 1_600, freshnessMs: 100, fetcher },
  )
  expect(failed.refreshedTrackIds).toEqual([track.id])
  expect(failed.failedTrackIds).toEqual([track.id])
  expect(fetchCount).toBe(4)
  const revisionsAfterFailure = listDanmakuRevisions(track.id)
  expect(revisionsAfterFailure[0]?.status).toBe("failed")
  expect(findDanmakuTrack(track.id)?.activeRevisionId).toBe(changedRevision?.id)

  const fallback = resolveDanmakuCandidates(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
  ).candidates.find((candidate) => candidate.id === track.id)
  expect(fallback).toMatchObject({
    availability: "available",
    revisionId: changedRevision?.id,
    cues: [
      { time: 1, text: "first" },
      { time: 3, text: "changed" },
    ],
  })
})

test("concurrent refreshes for one Bilibili track share one upstream request", async () => {
  const source = createBilibiliFixture()
  let fetchCount = 0
  let openGate: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    openGate = resolve
  })
  const fetcher: FetchLike = async () => {
    fetchCount += 1
    await gate
    return fixture(cue(1, "coalesced"))
  }

  const initial = await ensureBilibiliDanmakuSource(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
    { now: 1_000, freshnessMs: 100, fetcher: async () => fixture(cue(0, "initial")) },
  )
  const track = initial.tracks[0]
  expect(track).toBeDefined()
  if (!track) throw new Error("official track was not created")

  const first = refreshBilibiliDanmakuTrack(track.id, source.reference, {
    now: 1_200,
    freshnessMs: 100,
    fetcher,
  })
  const second = refreshBilibiliDanmakuTrack(track.id, source.reference, {
    now: 1_200,
    freshnessMs: 100,
    fetcher,
  })
  expect(fetchCount).toBe(1)
  openGate()
  const [firstResult, secondResult] = await Promise.all([first, second])
  expect(firstResult).toEqual(secondResult)
  expect(firstResult.changed).toBe(true)
})

test("concurrent source resolution reuses one release and logical track", async () => {
  const source = createBilibiliFixture()
  let fetchCount = 0
  let openGate: () => void = () => undefined
  const gate = new Promise<void>((resolve) => {
    openGate = resolve
  })
  const fetcher: FetchLike = async () => {
    fetchCount += 1
    await gate
    return fixture(cue(1, "source coalesced"))
  }

  const first = ensureBilibiliDanmakuSource(source.actorId, source.bushitsuId, source.enmoku.id, {
    now: 1_200,
    freshnessMs: 100,
    fetcher,
  })
  const second = ensureBilibiliDanmakuSource(source.actorId, source.bushitsuId, source.enmoku.id, {
    now: 1_200,
    freshnessMs: 100,
    fetcher,
  })
  expect(fetchCount).toBe(1)
  openGate()
  const [firstResult, secondResult] = await Promise.all([first, second])
  expect(firstResult.release?.id).toBe(secondResult.release?.id)
  expect(firstResult.tracks.map((track) => track.id)).toEqual(
    secondResult.tracks.map((track) => track.id),
  )
  expect(firstResult.tracks).toHaveLength(1)
})

test("Komon revision controls disable a bad Bilibili revision without losing fallback", async () => {
  const source = createBilibiliFixture()
  const komon = account("source-komon")
  insertKomonGrant({ id: id("komon-grant"), seitoId: komon, grantedAt: 1 })
  const feeds = [cue(1, "good"), cue(1, "bad")]
  const fetcher: FetchLike = async () => {
    const feed = feeds.shift()
    if (!feed) throw new Error("unexpected fixture request")
    return fixture(feed)
  }

  const first = await ensureBilibiliDanmakuSource(
    source.actorId,
    source.bushitsuId,
    source.enmoku.id,
    { now: 1_000, freshnessMs: 100, fetcher },
  )
  const track = first.tracks[0]
  expect(track).toBeDefined()
  if (!track) throw new Error("official track was not created")
  const goodRevision = listDanmakuRevisions(track.id)[0]
  expect(goodRevision?.status).toBe("valid")

  await ensureBilibiliDanmakuSource(source.actorId, source.bushitsuId, source.enmoku.id, {
    now: 1_200,
    freshnessMs: 100,
    fetcher,
  })
  const badRevision = listDanmakuRevisions(track.id)[0]
  expect(badRevision?.status).toBe("valid")
  if (!goodRevision || !badRevision) throw new Error("fixture revisions were not created")
  expect(badRevision.id).not.toBe(goodRevision.id)

  const disabled = disableDanmakuRevision(
    komon,
    track.id,
    badRevision.id,
    "bad Bilibili revision",
    1_300,
  )
  expect(disabled.activeRevisionId).toBe(goodRevision.id)
  expect(() => rollbackDanmakuRevision(komon, track.id, badRevision.id, 1_301)).toThrow()
  expect(findDanmakuTrack(track.id)?.activeRevisionId).toBe(goodRevision.id)

  const blockedContentRefresh = await refreshBilibiliDanmakuTrack(track.id, source.reference, {
    now: 1_700,
    freshnessMs: 0,
    fetcher: async () => fixture(cue(1, "bad")),
  })
  expect(blockedContentRefresh).toMatchObject({ attempted: true, changed: false, failed: true })
  expect(findDanmakuTrack(track.id)?.activeRevisionId).toBe(goodRevision.id)

  const disabledTrack = disableDanmakuRevision(
    komon,
    track.id,
    goodRevision.id,
    "disable remaining Bilibili revision",
    1_800,
  )
  expect(disabledTrack.status).toBe("disabled")
  const fetchAfterDisable = await refreshBilibiliDanmakuTrack(track.id, source.reference, {
    now: 1_900,
    freshnessMs: 0,
    fetcher: async () => {
      throw new Error("disabled track must not fetch")
    },
  })
  expect(fetchAfterDisable).toMatchObject({ attempted: false, changed: false, failed: false })
  expect(findDanmakuTrack(track.id)?.status).toBe("disabled")
})

test("an unmatched Bilibili reference keeps the legacy candidate without creating identity", async () => {
  const actorId = account("unmatched-owner")
  const bushitsuId = id("unmatched-room")
  insertBushitsuWithBuchou({
    id: bushitsuId,
    name: "Unmatched source room",
    buchouId: actorId,
    createdAt: 1,
  })
  join(bushitsuId, actorId, "unmatched owner")
  const reference = `bilibili:62131${crypto.randomUUID().replace(/\D/g, "").slice(0, 8)}`
  const enmoku = addEnmoku(bushitsuId, {
    title: "Unmatched Bilibili source",
    type: "direct",
    url: "https://media.example.test/unmatched.mp4",
    danmaku: { type: "fetch", ref: reference },
    addedBy: actorId,
  })
  let fetchCount = 0
  const result = await ensureBilibiliDanmakuSource(actorId, bushitsuId, enmoku.id, {
    now: 1_000,
    fetcher: async () => {
      fetchCount += 1
      return fixture(cue(1, "must not fetch"))
    },
  })

  expect(result.release?.provider).toBe("bilibili")
  expect(result.tracks).toEqual([])
  expect(fetchCount).toBe(0)
  const candidates = resolveDanmakuCandidates(actorId, bushitsuId, enmoku.id).candidates
  expect(candidates).toContainEqual(
    expect.objectContaining({
      id: `legacy:${enmoku.id}`,
      legacyRef: reference,
      availability: "available",
    }),
  )
})
