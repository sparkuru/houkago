import { afterAll, beforeAll, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { insertBushitsuWithBuchou } from "../src/db/queries/bushitsu"
import {
  insertDanmakuEpisode,
  insertDanmakuTrack,
  insertMediaRelease,
} from "../src/db/queries/danmaku"
import { insertSeito } from "../src/db/queries/seito"
import { addEnmoku } from "../src/domain/bushitsu"
import {
  confirmReleaseEpisodeMatch,
  ingestDanmakuRevision,
  setEnmokuDanmakuDefault,
} from "../src/domain/danmaku"
import { app } from "../src/index"
import { issueSeitoshou } from "../src/lib/seitoshou"

const origin = "http://127.0.0.1:5173"
let base: string
let baseWs: string

type Peer = {
  ws: WebSocket
  nextMatch(predicate: (message: KousokuMessage) => boolean): Promise<KousokuMessage>
}

function account(prefix: string): { id: string; cookie: string } {
  const id = `${prefix}-${crypto.randomUUID()}`
  insertSeito({
    id,
    username: id,
    usernameNorm: id.toLowerCase(),
    passwordHash: "test-only",
    createdAt: 1,
  })
  const session = issueSeitoshou({ id, username: id, createdAt: 1 }, Date.now())
  return { id, cookie: `houkago_seitoshou=${session.token}` }
}

async function openPeer(cookie: string, bushitsuId: string): Promise<Peer> {
  const ws = new WebSocket(`${baseWs}?bushitsuId=${bushitsuId}`, {
    headers: { cookie, origin },
  })
  const inbox: KousokuMessage[] = []
  const waiters: Array<{
    predicate: (message: KousokuMessage) => boolean
    resolve: (message: KousokuMessage) => void
  }> = []
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data) as KousokuMessage
    const index = waiters.findIndex((waiter) => waiter.predicate(message))
    if (index === -1) {
      inbox.push(message)
      return
    }
    const [waiter] = waiters.splice(index, 1)
    waiter.resolve(message)
  })
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve(), { once: true }))
  return {
    ws,
    nextMatch(predicate) {
      const index = inbox.findIndex(predicate)
      if (index !== -1) return Promise.resolve(inbox.splice(index, 1)[0] as KousokuMessage)
      return new Promise((resolve) => waiters.push({ predicate, resolve }))
    },
  }
}

beforeAll(() => {
  app.listen(0)
  const port = app.server?.port
  if (!port) throw new Error("test server did not start")
  base = `http://localhost:${port}`
  baseWs = `ws://localhost:${port}/ws`
})

afterAll(() => {
  app.server?.stop()
})

test("room defaults persist, broadcast, and reach a late joiner", async () => {
  const owner = account("hybrid-e2e-owner")
  const viewer = account("hybrid-e2e-viewer")
  const roomId = `hybrid-e2e-room-${crypto.randomUUID()}`
  const episodeId = `hybrid-e2e-episode-${crypto.randomUUID()}`
  const releaseId = `hybrid-e2e-release-${crypto.randomUUID()}`
  const trackId = `hybrid-e2e-track-${crypto.randomUUID()}`
  insertBushitsuWithBuchou({
    id: roomId,
    name: "Hybrid e2e room",
    buchouId: owner.id,
    createdAt: 1,
  })
  insertDanmakuEpisode({
    id: episodeId,
    title: "Hybrid e2e episode",
    createdAt: 1,
    updatedAt: 1,
  })
  insertMediaRelease({
    id: releaseId,
    provider: "fixture",
    providerReference: releaseId,
    fileName: "hybrid-e2e.mp4",
    createdAt: 1,
  })
  insertDanmakuTrack({
    id: trackId,
    episodeId,
    releaseId,
    sourceClass: "server-stored",
    name: "Hybrid stored track",
    status: "active",
    createdAt: 1,
    updatedAt: 1,
  })
  ingestDanmakuRevision(trackId, [{ time: 1, text: "hello", mode: "scroll" }], undefined, 2)
  const enmoku = addEnmoku(roomId, {
    title: "Hybrid e2e source",
    type: "direct",
    url: "https://fixture.test/hybrid-e2e.mp4",
    danmaku: { type: "fetch", ref: `fixture:${releaseId}` },
    addedBy: owner.id,
  })
  confirmReleaseEpisodeMatch(owner.id, {
    releaseId,
    episodeId,
    trustScope: "room",
    bushitsuId: roomId,
    enmokuId: enmoku.id,
    evidence: [{ kind: "filename", work: "Hybrid e2e", episode: 1 }],
  })

  const ownerPeer = await openPeer(owner.cookie, roomId)
  const initial = await ownerPeer.nextMatch((message) => message.type === "DANMAKU_DEFAULT")
  expect(initial.type).toBe("DANMAKU_DEFAULT")
  if (initial.type === "DANMAKU_DEFAULT") expect(initial.payload.defaults).toEqual([])

  const broadcast = ownerPeer.nextMatch(
    (message) =>
      message.type === "DANMAKU_DEFAULT" &&
      message.payload.defaults.some((item) => item.trackId === trackId),
  )
  const update = await app.handle(
    new Request(`${base}/danmaku/bushitsu/${roomId}/enmoku/${enmoku.id}/default`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: owner.cookie,
        origin,
      },
      body: JSON.stringify({ trackId }),
    }),
  )
  expect(update.status).toBe(200)
  const updateBody = (await update.json()) as { defaults: Array<{ trackId: string }> }
  expect(updateBody.defaults.some((item) => item.trackId === trackId)).toBe(true)
  await broadcast

  const forbidden = await app.handle(
    new Request(`${base}/danmaku/bushitsu/${roomId}/enmoku/${enmoku.id}/default`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: viewer.cookie,
        origin,
      },
      body: JSON.stringify({ trackId }),
    }),
  )
  expect(forbidden.status).toBe(403)

  const latePeer = await openPeer(viewer.cookie, roomId)
  const late = await latePeer.nextMatch((message) => message.type === "DANMAKU_DEFAULT")
  expect(late.type).toBe("DANMAKU_DEFAULT")
  if (late.type === "DANMAKU_DEFAULT") {
    expect(late.payload.defaults).toEqual([
      expect.objectContaining({ enmokuId: enmoku.id, trackId, availability: "available" }),
    ])
  }

  const candidates = await app.handle(
    new Request(`${base}/danmaku/bushitsu/${roomId}/enmoku/${enmoku.id}`, {
      headers: { cookie: viewer.cookie },
    }),
  )
  expect(candidates.status).toBe(200)
  const candidateBody = (await candidates.json()) as {
    roomDefault: { trackId: string } | null
  }
  expect(candidateBody.roomDefault?.trackId).toBe(trackId)

  ownerPeer.ws.close()
  latePeer.ws.close()
})
