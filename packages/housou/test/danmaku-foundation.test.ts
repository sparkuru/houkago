import { expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import type { DanmakuContent, DanmakuCue, DanmakuEvidence, DanmakuTrack } from "houkago-kousoku"
import { db } from "../src/db/client"
import { insertBushitsuWithBuchou } from "../src/db/queries/bushitsu"
import {
  findDanmakuAlignment,
  findDanmakuContent,
  findDanmakuEpisode,
  findDanmakuRevision,
  findDanmakuTrack,
  findGlobalReleaseEpisodeMatch,
  insertDanmakuContent,
  insertDanmakuEpisode,
  insertDanmakuTrack,
  insertMediaRelease,
  listDanmakuRevisions,
  listDanmakuTracks,
  listMediaReleaseEvidence,
} from "../src/db/queries/danmaku"
import { listDanmakuAudit } from "../src/db/queries/danmaku-audit"
import { findKomonBySeitoId, insertKomonGrant } from "../src/db/queries/komon"
import { insertSeito } from "../src/db/queries/seito"
import { addEnmoku } from "../src/domain/bushitsu"
import {
  collectDanmakuContent,
  confirmReleaseEpisodeMatch,
  curateDanmakuEpisode,
  decideDanmakuProposal,
  disableDanmakuRevision,
  ingestDanmakuRevision,
  pinDanmakuRevision,
  recordDanmakuRefreshFailure,
  recordMediaReleaseEvidence,
  registerDanmakuTrack,
  registerMediaRelease,
  rollbackDanmakuRevision,
  saveDanmakuAlignment,
  submitDanmakuProposal,
  updateDanmakuSourcePolicy,
} from "../src/domain/danmaku"
import { app } from "../src/index"
import {
  canonicalizeDanmakuCues,
  digestsEqual,
  hashCanonicalDanmakuCues,
} from "../src/lib/danmaku-content"
import {
  DanmakuContentHashCollision,
  DanmakuMatchInvalid,
  DanmakuPolicyInvalid,
  DanmakuRevisionNotFound,
  Forbidden,
  KomonRequired,
} from "../src/lib/errors"
import { grantKomon, isKomon, revokeKomon } from "../src/lib/komon"
import { issueSeitoshou } from "../src/lib/seitoshou"

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
    createdAt: Date.now(),
  })
  return accountId
}

function seedKomon(seitoId: string): void {
  insertKomonGrant({ id: id("komon"), seitoId, grantedAt: Date.now() })
}

function sessionCookie(seitoId: string): string {
  const session = issueSeitoshou({ id: seitoId, username: seitoId, createdAt: 1 }, Date.now())
  return `houkago_seitoshou=${session.token}`
}

function episode(episodeId = id("episode")) {
  const value = {
    id: episodeId,
    title: "The Test Episode",
    season: 1,
    episode: 2,
    createdAt: 1,
    updatedAt: 1,
  } as const
  insertDanmakuEpisode(value)
  return value
}

function release(releaseId = id("release")) {
  const value = {
    id: releaseId,
    provider: "fixture",
    providerReference: releaseId,
    fileName: `${releaseId}.mp4`,
    size: 1024,
    duration: 120,
    createdAt: 1,
  } as const
  insertMediaRelease(value)
  return value
}

function track(episodeId: string, releaseId: string, trackId = id("track")): DanmakuTrack {
  const value: DanmakuTrack = {
    id: trackId,
    episodeId,
    releaseId,
    sourceClass: "provider-official",
    name: "Fixture official track",
    provenance: { provider: "fixture", reference: releaseId },
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  }
  insertDanmakuTrack(value)
  return value
}

const evidence: DanmakuEvidence[] = [
  {
    kind: "fingerprint",
    digest: { algorithm: "md5", scope: "prefix-16mib", bytes: 16 * 1024 * 1024, value: "abc123" },
  },
]

test("canonical cues and digest comparison are stable and scope-aware", () => {
  const first: DanmakuCue[] = [
    { time: 2, text: " second ", mode: "scroll" },
    { time: 1, text: "first", mode: "top", color: "#fff" },
  ]
  const second: DanmakuCue[] = [
    { time: 1, text: "first", mode: "top", color: "#fff" },
    { time: 2, text: "second", mode: "scroll" },
  ]
  expect(canonicalizeDanmakuCues(first)).toEqual(canonicalizeDanmakuCues(second))

  const left = hashCanonicalDanmakuCues(first).digest
  const right = hashCanonicalDanmakuCues(second).digest
  expect(digestsEqual(left, right)).toBe(true)
  expect(digestsEqual(left, { ...right, algorithm: "md5" })).toBe(false)
  expect(digestsEqual(left, { ...right, scope: "whole-file" })).toBe(false)
  expect(digestsEqual(left, { ...right, bytes: 1 })).toBe(false)
})

test("identity, evidence, and trust scopes round-trip without conflating room and Komon authority", () => {
  const komon = account("komon-owner")
  const viewer = account("viewer")
  const roomOwner = account("room-owner")
  seedKomon(komon)
  const canonicalEpisode = curateDanmakuEpisode(
    komon,
    {
      title: "Curated title",
      season: 2,
      episode: 4,
    },
    10,
  )
  const firstRelease = release()
  const secondRelease = release()
  const firstTrack = track(canonicalEpisode.id, firstRelease.id)
  const secondTrack = track(canonicalEpisode.id, secondRelease.id)
  const firstEvidence = {
    kind: "fingerprint" as const,
    digest: { algorithm: "md5", scope: "prefix-16mib", bytes: 16 * 1024 * 1024, value: "first" },
  }
  const secondEvidence = {
    kind: "fingerprint" as const,
    digest: { algorithm: "md5", scope: "prefix-16mib", bytes: 16 * 1024 * 1024, value: "second" },
  }
  recordMediaReleaseEvidence(firstRelease.id, firstEvidence, 11)
  recordMediaReleaseEvidence(secondRelease.id, secondEvidence, 12)
  const roomId = id("room")
  insertBushitsuWithBuchou({
    id: roomId,
    name: "Matching room",
    buchouId: roomOwner,
    createdAt: 1,
  })
  const enmoku = addEnmoku(roomId, {
    title: "Queued source",
    type: "direct",
    url: "https://fixture.test/video.mp4",
    addedBy: roomOwner,
  })

  const personal = {
    releaseId: firstRelease.id,
    episodeId: canonicalEpisode.id,
    trustScope: "personal",
    evidence,
  } as const
  const personalMatch = confirmReleaseEpisodeMatch(viewer, personal)
  expect(personalMatch.trustScope).toBe("personal")
  expect(personalMatch.seitoId).toBe(viewer)
  const otherPersonalMatch = confirmReleaseEpisodeMatch(roomOwner, personal)
  expect(otherPersonalMatch.seitoId).toBe(roomOwner)
  expect(otherPersonalMatch.id).not.toBe(personalMatch.id)

  const roomMatch = {
    releaseId: secondRelease.id,
    episodeId: canonicalEpisode.id,
    trustScope: "room",
    bushitsuId: roomId,
    enmokuId: enmoku.id,
    evidence,
  } as const
  const confirmedRoomMatch = confirmReleaseEpisodeMatch(roomOwner, roomMatch)
  expect(confirmedRoomMatch.bushitsuId).toBe(roomId)
  expect(() => confirmReleaseEpisodeMatch(viewer, roomMatch)).toThrow(Forbidden)

  const global = {
    releaseId: firstRelease.id,
    episodeId: canonicalEpisode.id,
    trustScope: "global",
    evidence,
  } as const
  expect(() => confirmReleaseEpisodeMatch(roomOwner, global)).toThrow(Forbidden)
  const promoted = confirmReleaseEpisodeMatch(komon, global)
  expect(promoted.reviewerSeitoId).toBe(komon)
  expect(promoted.confidence).toBe("confirmed")
  expect(findGlobalReleaseEpisodeMatch(firstRelease.id)?.episodeId).toBe(canonicalEpisode.id)
  expect(confirmReleaseEpisodeMatch(komon, global)).toEqual(promoted)

  const firstAlignment = saveDanmakuAlignment(
    viewer,
    { releaseId: firstRelease.id, trackId: firstTrack.id, offsetSeconds: 0.25 },
    23,
  )
  const secondAlignment = saveDanmakuAlignment(
    roomOwner,
    { releaseId: secondRelease.id, trackId: secondTrack.id, offsetSeconds: -0.5 },
    24,
  )
  expect(firstAlignment.offsetSeconds).toBe(0.25)
  expect(secondAlignment.offsetSeconds).toBe(-0.5)
  expect(findDanmakuAlignment(firstRelease.id, firstTrack.id)).toEqual(firstAlignment)
  expect(findDanmakuAlignment(secondRelease.id, secondTrack.id)).toEqual(secondAlignment)
  expect(listMediaReleaseEvidence(firstRelease.id)).toEqual([firstEvidence])
  expect(listMediaReleaseEvidence(secondRelease.id)).toEqual([secondEvidence])
  expect(listDanmakuTracks(canonicalEpisode.id)).toHaveLength(2)
  expect(listDanmakuAudit("episode", canonicalEpisode.id).map((item) => item.action)).toEqual([
    "episode_curated",
  ])
})

test("proposal decisions are Komon-authorized, auditable, and idempotent", () => {
  const komon = account("proposal-komon")
  const viewer = account("proposal-viewer")
  seedKomon(komon)
  const target = episode()
  const firstRelease = release()
  const firstProposal = submitDanmakuProposal(
    viewer,
    {
      releaseId: firstRelease.id,
      targetEpisodeId: target.id,
      evidence,
    },
    30,
  )
  expect(findGlobalReleaseEpisodeMatch(firstRelease.id)).toBeNull()
  expect(() => decideDanmakuProposal(viewer, firstProposal.id, { action: "approve" }, 31)).toThrow(
    KomonRequired,
  )

  const approved = decideDanmakuProposal(komon, firstProposal.id, { action: "approve" }, 31)
  expect(approved.status).toBe("approved")
  expect(findGlobalReleaseEpisodeMatch(firstRelease.id)?.episodeId).toBe(target.id)
  expect(listDanmakuAudit("proposal", firstProposal.id).map((item) => item.action)).toEqual([
    "proposal_submitted",
    "proposal_approved",
  ])
  expect(decideDanmakuProposal(komon, firstProposal.id, { action: "approve" }, 32)).toEqual(
    approved,
  )
  expect(() => decideDanmakuProposal(komon, firstProposal.id, { action: "reject" }, 33)).toThrow(
    DanmakuMatchInvalid,
  )

  const newEpisodeProposal = submitDanmakuProposal(
    viewer,
    {
      releaseId: release().id,
      suggestedTitle: "Newly curated episode",
      suggestedSeason: 3,
      suggestedEpisode: 1,
      evidence,
    },
    40,
  )
  const newlyApproved = decideDanmakuProposal(
    komon,
    newEpisodeProposal.id,
    { action: "approve" },
    41,
  )
  expect(newlyApproved.targetEpisodeId).toBeTruthy()
  if (!newlyApproved.targetEpisodeId) throw new Error("approved proposal has no episode")
  expect(findDanmakuEpisode(newlyApproved.targetEpisodeId)?.title).toBe("Newly curated episode")

  const mergeRelease = release()
  const mergeProposal = submitDanmakuProposal(
    viewer,
    {
      releaseId: mergeRelease.id,
      suggestedTitle: "An obsolete title",
      evidence,
    },
    50,
  )
  const merged = decideDanmakuProposal(
    komon,
    mergeProposal.id,
    { action: "merge", episodeId: target.id, disposition: "canonical duplicate" },
    51,
  )
  expect(merged.status).toBe("merged")
  expect(merged.mergeTargetEpisodeId).toBe(target.id)
  expect(findGlobalReleaseEpisodeMatch(mergeRelease.id)?.episodeId).toBe(target.id)

  const rejectedRelease = release()
  const rejectedProposal = submitDanmakuProposal(
    viewer,
    {
      releaseId: rejectedRelease.id,
      targetEpisodeId: target.id,
      evidence,
    },
    60,
  )
  expect(decideDanmakuProposal(komon, rejectedProposal.id, { action: "reject" }, 61).status).toBe(
    "rejected",
  )
  expect(findGlobalReleaseEpisodeMatch(rejectedRelease.id)).toBeNull()
})

test("official revisions deduplicate, fall back on failure, and protect rollback content during GC", () => {
  const komon = account("revision-komon")
  seedKomon(komon)
  const canonicalEpisode = episode()
  const mediaRelease = release()
  const danmakuTrack = track(canonicalEpisode.id, mediaRelease.id)

  const first = ingestDanmakuRevision(
    danmakuTrack.id,
    [{ time: 1, text: "hello", mode: "scroll" }],
    { provider: "fixture", reference: "revision-1" },
    100,
  )
  expect(first.changed).toBe(true)
  if (!first.revision.contentHash) throw new Error("valid revision needs a content hash")
  const firstContent = findDanmakuContent(first.revision.contentHash)
  if (!firstContent) throw new Error("first revision content was not stored")
  const collidingContent: DanmakuContent = {
    ...firstContent,
    canonicalJson: `${firstContent.canonicalJson} `,
    byteLength: firstContent.byteLength + 1,
  }
  expect(() => insertDanmakuContent(collidingContent)).toThrow(DanmakuContentHashCollision)
  const same = ingestDanmakuRevision(
    danmakuTrack.id,
    [{ time: 1, text: " hello ", mode: "scroll" }],
    { provider: "fixture", reference: "same-content" },
    150,
  )
  expect(same.changed).toBe(false)
  expect(same.revision.id).toBe(first.revision.id)

  const second = ingestDanmakuRevision(
    danmakuTrack.id,
    [
      { time: 1, text: "hello", mode: "scroll" },
      { time: 2, text: "new", mode: "bottom" },
    ],
    { provider: "fixture", reference: "revision-2" },
    200,
  )
  expect(second.changed).toBe(true)
  expect(findDanmakuTrack(danmakuTrack.id)?.activeRevisionId).toBe(second.revision.id)

  const failed = recordDanmakuRefreshFailure(
    danmakuTrack.id,
    "upstream unavailable",
    { provider: "fixture", reference: "failed-attempt" },
    250,
  )
  expect(failed.status).toBe("failed")
  expect(findDanmakuTrack(danmakuTrack.id)?.activeRevisionId).toBe(second.revision.id)

  expect(pinDanmakuRevision(komon, first.revision.id, true, 270).pinned).toBe(true)
  const disabled = disableDanmakuRevision(
    komon,
    danmakuTrack.id,
    second.revision.id,
    "bad upstream revision",
    280,
  )
  expect(disabled.activeRevisionId).toBe(first.revision.id)
  expect(() => rollbackDanmakuRevision(komon, danmakuTrack.id, second.revision.id, 281)).toThrow(
    DanmakuRevisionNotFound,
  )

  const third = ingestDanmakuRevision(
    danmakuTrack.id,
    [{ time: 3, text: "third", mode: "top" }],
    { provider: "fixture", reference: "revision-3" },
    300,
  )
  expect(third.track.activeRevisionId).toBe(third.revision.id)
  const collected = collectDanmakuContent(komon, 0, 20, 400)
  expect(collected.map((item) => item.contentHash)).toContain(second.revision.contentHash)
  if (!first.revision.contentHash || !third.revision.contentHash) {
    throw new Error("valid revisions need content hashes")
  }
  expect(findDanmakuContent(first.revision.contentHash)).not.toBeNull()
  expect(findDanmakuContent(third.revision.contentHash)).not.toBeNull()
  expect(findDanmakuRevision(second.revision.id)?.contentHash).toBe(second.revision.contentHash)
  expect(listDanmakuRevisions(danmakuTrack.id).map((item) => item.id)).toEqual([
    third.revision.id,
    failed.id,
    second.revision.id,
    first.revision.id,
  ])

  expect(
    rollbackDanmakuRevision(komon, danmakuTrack.id, first.revision.id, 410).activeRevisionId,
  ).toBe(first.revision.id)
})

test("only Komon may update the source policy and invalid orderings are rejected", () => {
  const komon = account("policy-komon")
  const viewer = account("policy-viewer")
  seedKomon(komon)
  const valid = {
    allowedClasses: ["provider-official", "server-stored"] as const,
    order: ["provider-official", "server-stored"] as const,
  }
  expect(() => updateDanmakuSourcePolicy(viewer, valid, 500)).toThrow(KomonRequired)
  expect(() =>
    updateDanmakuSourcePolicy(
      komon,
      { allowedClasses: ["server-stored", "server-stored"], order: ["server-stored"] },
      501,
    ),
  ).toThrow(DanmakuPolicyInvalid)
  expect(() =>
    updateDanmakuSourcePolicy(komon, { allowedClasses: ["server-stored"], order: ["local"] }, 502),
  ).toThrow(DanmakuPolicyInvalid)
  const updated = updateDanmakuSourcePolicy(komon, valid, 503)
  expect(updated.updatedBy).toBe(komon)
  expect(
    db.query("SELECT allowed_json, order_json FROM danmaku_source_policy WHERE id = 1").get(),
  ).toEqual({
    allowed_json: '["provider-official","server-stored"]',
    order_json: '["provider-official","server-stored"]',
  })
})

test("danmaku routes derive session authority and keep governance endpoints gated", async () => {
  const komon = account("route-komon")
  const viewer = account("route-viewer")
  seedKomon(komon)
  const canonicalEpisode = curateDanmakuEpisode(komon, { title: "Route episode" }, 600)
  const mediaRelease = release()
  const origin = "http://127.0.0.1:5173"

  const unauthenticated = await app.handle(new Request("http://localhost/danmaku/episodes?q=route"))
  expect(unauthenticated.status).toBe(401)

  const search = await app.handle(
    new Request("http://localhost/danmaku/episodes?q=route", {
      headers: { cookie: sessionCookie(viewer) },
    }),
  )
  expect(search.status).toBe(200)
  expect((await search.json())[0].id).toBe(canonicalEpisode.id)

  const forbiddenCurate = await app.handle(
    new Request("http://localhost/danmaku/episodes", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie(viewer), origin },
      body: JSON.stringify({ title: "not allowed" }),
    }),
  )
  expect(forbiddenCurate.status).toBe(403)

  const proposal = await app.handle(
    new Request("http://localhost/danmaku/proposals", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie(viewer), origin },
      body: JSON.stringify({
        releaseId: mediaRelease.id,
        targetEpisodeId: canonicalEpisode.id,
        evidence,
      }),
    }),
  )
  expect(proposal.status).toBe(200)

  const proposals = await app.handle(
    new Request("http://localhost/danmaku/proposals", {
      headers: { cookie: sessionCookie(komon) },
    }),
  )
  expect(proposals.status).toBe(200)
  expect(
    (await proposals.json()).some(
      (item: { releaseId: string }) => item.releaseId === mediaRelease.id,
    ),
  ).toBe(true)

  const forbiddenPolicy = await app.handle(
    new Request("http://localhost/danmaku/policy", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie(viewer), origin },
      body: JSON.stringify({ allowedClasses: ["server-stored"], order: ["server-stored"] }),
    }),
  )
  expect(forbiddenPolicy.status).toBe(403)
})

test("pool metadata rejects private provider material and redacts refresh errors", () => {
  const komon = account("secret-komon")
  seedKomon(komon)
  const mediaRelease = release()
  expect(() =>
    recordMediaReleaseEvidence(mediaRelease.id, {
      kind: "provider",
      provider: "fixture",
      reference: "dlink=https://private.example/file",
    }),
  ).toThrow(DanmakuMatchInvalid)
  expect(() =>
    recordMediaReleaseEvidence(mediaRelease.id, {
      kind: "provider",
      provider: "fixture",
      reference: '{"dlink":"secret"}',
    }),
  ).toThrow(DanmakuMatchInvalid)

  const danmakuTrack = track(episode().id, mediaRelease.id)
  const failed = recordDanmakuRefreshFailure(
    danmakuTrack.id,
    'response {"access_token":"secret"} password="pw" GET https://private.example/feed?access_token=secret fsid=abc123',
    undefined,
    700,
  )
  expect(failed.error).not.toContain("access_token")
  expect(failed.error).not.toContain("secret")
  expect(failed.error).not.toContain("fsid")
  expect(failed.error).not.toContain("password")
  expect(failed.error).not.toContain("pw")
})

test("Komon grant changes are independent from room roles and idempotent", () => {
  const actor = account("grant-actor")
  const target = account("grant-target")
  insertKomonGrant({ id: id("initial-komon"), seitoId: actor, grantedAt: 1 })
  grantKomon(actor, target, 710)
  grantKomon(actor, target, 711)
  expect(isKomon(target)).toBe(true)
  expect(findKomonBySeitoId(target)?.revokedAt).toBeUndefined()
  expect(listDanmakuAudit("komon", target).map((item) => item.action)).toEqual(["komon_granted"])

  revokeKomon(actor, target, 712)
  expect(isKomon(target)).toBe(false)
  grantKomon(actor, target, 713)
  expect(isKomon(target)).toBe(true)
  expect(listDanmakuAudit("komon", target).map((item) => item.action)).toEqual([
    "komon_granted",
    "komon_revoked",
    "komon_restored",
  ])
})

test("Komon bootstrap is explicit, idempotent, and fails closed for unknown usernames", async () => {
  const dbPath = `/tmp/houkago-komon-bootstrap-${crypto.randomUUID()}.sqlite`
  const clientUrl = new URL("../src/db/client.ts", import.meta.url).href
  const runBun = async (code: string, env: Record<string, string>) => {
    const child = Bun.spawn([process.execPath, "-e", code], {
      env: { ...process.env, ...env },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout: stdout.trim(), stderr, exitCode }
  }

  try {
    const seed = await runBun(
      `
        const { db } = await import(${JSON.stringify(clientUrl)})
        db.query("INSERT INTO seito (id, username, username_norm, password_hash, created_at) VALUES ('admin-id', 'Admin', 'admin', 'hash', 1)").run()
        db.close()
      `,
      { HOUSOU_DB: dbPath, HOUKAGO_KOMON_USERNAMES: "" },
    )
    expect(seed).toEqual({ stdout: "", stderr: "", exitCode: 0 })

    const bootstrapped = await runBun(
      `
        const { db } = await import(${JSON.stringify(clientUrl)})
        console.log(JSON.stringify({
          grant: db.query("SELECT seito_id, revoked_at FROM komon").all(),
          audit: db.query("SELECT action, subject_id FROM danmaku_audit WHERE subject_type = 'komon'").all(),
        }))
        db.close()
      `,
      { HOUSOU_DB: dbPath, HOUKAGO_KOMON_USERNAMES: " Admin,admin " },
    )
    expect(bootstrapped.exitCode).toBe(0)
    expect(JSON.parse(bootstrapped.stdout)).toEqual({
      grant: [{ seito_id: "admin-id", revoked_at: null }],
      audit: [{ action: "komon_granted", subject_id: "admin-id" }],
    })

    const missing = await runBun(`await import(${JSON.stringify(clientUrl)})`, {
      HOUSOU_DB: dbPath,
      HOUKAGO_KOMON_USERNAMES: "missing-account",
    })
    expect(missing.exitCode).not.toBe(0)
    expect(missing.stderr).toContain("missing-account")
  } finally {
    await rm(dbPath, { force: true })
    await rm(`${dbPath}-shm`, { force: true })
    await rm(`${dbPath}-wal`, { force: true })
  }
})

test("track registration rejects references outside the identity pool", () => {
  const episodeRecord = episode()
  const releaseRecord = release()
  const registered = registerDanmakuTrack({
    id: id("registered-track"),
    episodeId: episodeRecord.id,
    releaseId: releaseRecord.id,
    sourceClass: "server-stored",
    name: "Registered track",
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  })
  expect(findDanmakuTrack(registered.id)).toEqual(registered)
  expect(() =>
    registerDanmakuTrack({
      ...registered,
      id: id("missing-release-track"),
      releaseId: id("missing-release"),
    }),
  ).toThrow(DanmakuMatchInvalid)
})
