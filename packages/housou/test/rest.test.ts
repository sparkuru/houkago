import { afterAll, beforeAll, expect, test } from "bun:test"
import { Elysia } from "elysia"
import { decodeProxyRef } from "houkago-eisha"
import type { KousokuMessage } from "houkago-kousoku"
import { app } from "../src/index"

// Exercise the domain → db layering through the real REST surface. Bootstrap
// (CREATE TABLE IF NOT EXISTS) runs on import of the db client.

let base: string
let baseWs: string
let upstream: Elysia
let upstreamBase: string

beforeAll(() => {
  upstream = new Elysia()
    .get("/live/index.m3u8", () =>
      [
        "#EXTM3U",
        '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",URI="subs/en.m3u8"',
        "#EXT-X-STREAM-INF:BANDWIDTH=2400000,RESOLUTION=1280x720",
        "variant/720.m3u8",
      ].join("\n"),
    )
    .get("/live/subs/en.m3u8", () => "#EXTM3U\n#EXTINF:4,\nsub.ts\n#EXT-X-ENDLIST")
    .get("/live/variant/720.m3u8", () => "#EXTM3U\n#EXTINF:4,\nsegment.ts\n#EXT-X-ENDLIST")
  upstream.listen(0)
  upstreamBase = `http://localhost:${upstream.server?.port}`

  app.listen(0)
  base = `http://localhost:${app.server?.port}`
  baseWs = `ws://localhost:${app.server?.port}/ws`
})

afterAll(() => {
  app.server?.stop()
  upstream.server?.stop()
})

function open(bushitsuId: string, senderId: string): Promise<WebSocket> {
  const ws = new WebSocket(`${baseWs}?bushitsuId=${bushitsuId}&senderId=${senderId}`)
  return new Promise((resolve) => ws.addEventListener("open", () => resolve(ws), { once: true }))
}

function nextMatch(ws: WebSocket, pred: (m: KousokuMessage) => boolean): Promise<KousokuMessage> {
  return new Promise((resolve) => {
    const onMsg = (ev: MessageEvent) => {
      const m = JSON.parse(ev.data) as KousokuMessage
      if (pred(m)) {
        ws.removeEventListener("message", onMsg)
        resolve(m)
      }
    }
    ws.addEventListener("message", onMsg)
  })
}

test("create bushitsu, then read it back", async () => {
  const created = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "映画部", buchouId: "u1" }),
  }).then((r) => r.json())

  expect(created.id).toBeTruthy()
  expect(created.buchouId).toBe("u1")

  const fetched = await fetch(`${base}/bushitsu/${created.id}`).then((r) => r.json())
  expect(fetched.id).toBe(created.id)
  expect(fetched.name).toBe("映画部")
})

test("add enmoku and list bangumi", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r", buchouId: "u1" }),
  }).then((r) => r.json())

  await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "test", type: "direct", url: "https://e/v.mp4", addedBy: "u1" }),
  })

  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(Array.isArray(bangumi)).toBe(true)
  expect(bangumi[0].title).toBe("test")
  expect(bangumi[0].headers).toBeUndefined()
  expect(bangumi[0].subtitles).toBeUndefined()
  expect(bangumi[0].sources).toBeUndefined()
  expect(bangumi[0].danmaku).toBeUndefined()
  expect(bangumi[0].live).toBeUndefined()
})

test("add enmoku persists extended metadata in create response and bangumi", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-extended", buchouId: "u1" }),
  }).then((r) => r.json())
  const metadata = {
    headers: { authorization: "Bearer token", referer: "https://example.test/" },
    subtitles: {
      zh: { url: "https://media.example.test/sub.zh.vtt", type: "vtt" },
      ja: { url: "https://media.example.test/sub.ja.ass", type: "ass" },
    },
    sources: [{ name: "1080p", url: "https://media.example.test/1080.m3u8" }],
    danmaku: { type: "fetch", ref: "bilibili:av1" },
    live: true,
  } as const

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "extended",
      type: "hls",
      url: "https://media.example.test/master.m3u8",
      addedBy: "u1",
      ...metadata,
    }),
  }).then((r) => r.json())

  expect(enmoku.headers).toEqual(metadata.headers)
  expect(enmoku.subtitles).toEqual(metadata.subtitles)
  expect(enmoku.sources).toEqual(metadata.sources)
  expect(enmoku.danmaku).toEqual(metadata.danmaku)
  expect(enmoku.live).toBe(true)

  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(bangumi[0].headers).toEqual(metadata.headers)
  expect(bangumi[0].subtitles).toEqual(metadata.subtitles)
  expect(bangumi[0].sources).toEqual(metadata.sources)
  expect(bangumi[0].danmaku).toEqual(metadata.danmaku)
  expect(bangumi[0].live).toBe(true)
})

test("add enmoku from sourceUrl resolves through the eisha proxy", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-resolve", buchouId: "u1" }),
  }).then((r) => r.json())

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "resolved",
      sourceUrl: "https://media.example.test/video.mp4",
      headers: { authorization: "Bearer resolver" },
      addedBy: "u1",
    }),
  }).then((r) => r.json())

  expect(enmoku.title).toBe("resolved")
  expect(enmoku.type).toBe("direct")
  expect(enmoku.headers).toEqual({ authorization: "Bearer resolver" })
  expect(enmoku.url.startsWith(`${base}/eisha/proxy/`)).toBe(true)
  expect(decodeProxyRef(enmoku.url.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: "https://media.example.test/video.mp4",
    headers: { authorization: "Bearer resolver" },
  })
})

test("add enmoku from HLS sourceUrl persists parser metadata", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-hls-metadata", buchouId: "u1" }),
  }).then((r) => r.json())

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceUrl: `${upstreamBase}/live/index.m3u8`,
      addedBy: "u1",
    }),
  }).then((r) => r.json())

  expect(enmoku.type).toBe("hls")
  expect(enmoku.sources?.[0]?.name).toBe("1280x720 · 2400k")
  expect(decodeProxyRef(enmoku.sources?.[0]?.url.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: `${upstreamBase}/live/variant/720.m3u8`,
    hls: {
      manifestUrl: `${upstreamBase}/live/index.m3u8`,
      uri: "variant/720.m3u8",
      uriIndex: 1,
    },
  })
  expect(enmoku.subtitles?.English.type).toBe("hls")
  expect(decodeProxyRef(enmoku.subtitles?.English.url.split("/eisha/proxy/")[1] ?? "")).toEqual({
    url: `${upstreamBase}/live/subs/en.m3u8`,
    hls: {
      manifestUrl: `${upstreamBase}/live/index.m3u8`,
      uri: "subs/en.m3u8",
      uriIndex: 0,
    },
  })

  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(bangumi[0].sources).toEqual(enmoku.sources)
  expect(bangumi[0].subtitles).toEqual(enmoku.subtitles)
})

test("add enmoku broadcasts extended metadata in BANGUMI", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-extended-broadcast", buchouId: "host" }),
  }).then((r) => r.json())

  const host = await open(room.id, "host")
  const guest = await open(room.id, "guest")
  const hostBangumi = nextMatch(host, (m) => m.type === "BANGUMI")
  const guestBangumi = nextMatch(guest, (m) => m.type === "BANGUMI")

  await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "broadcast-extended",
      type: "live",
      url: "https://media.example.test/live.m3u8",
      sources: [{ name: "main", url: "https://media.example.test/live.m3u8" }],
      live: true,
      addedBy: "host",
    }),
  })

  const [hostMsg, guestMsg] = await Promise.all([hostBangumi, guestBangumi])
  if (hostMsg.type === "BANGUMI") {
    expect(hostMsg.payload.enmoku[0]?.sources).toEqual([
      { name: "main", url: "https://media.example.test/live.m3u8" },
    ])
    expect(hostMsg.payload.enmoku[0]?.live).toBe(true)
  }
  if (guestMsg.type === "BANGUMI") {
    expect(guestMsg.payload.enmoku[0]?.sources).toEqual([
      { name: "main", url: "https://media.example.test/live.m3u8" },
    ])
    expect(guestMsg.payload.enmoku[0]?.live).toBe(true)
  }

  host.close()
  guest.close()
})

test("add resolved enmoku broadcasts the full BANGUMI snapshot", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-resolve-broadcast", buchouId: "host" }),
  }).then((r) => r.json())

  const host = await open(room.id, "host")
  const guest = await open(room.id, "guest")
  const hostBangumi = nextMatch(host, (m) => m.type === "BANGUMI")
  const guestBangumi = nextMatch(guest, (m) => m.type === "BANGUMI")

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sourceUrl: "https://media.example.test/video.mp4",
      addedBy: "host",
    }),
  }).then((r) => r.json())

  const [hostMsg, guestMsg] = await Promise.all([hostBangumi, guestBangumi])
  if (hostMsg.type === "BANGUMI") expect(hostMsg.payload.enmoku[0]?.id).toBe(enmoku.id)
  if (guestMsg.type === "BANGUMI") expect(guestMsg.payload.enmoku[0]?.id).toBe(enmoku.id)

  host.close()
  guest.close()
})

test("delete enmoku removes it from bangumi", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-delete", buchouId: "u1" }),
  }).then((r) => r.json())

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "delete-me",
      type: "direct",
      url: "https://e/v.mp4",
      addedBy: "u1",
    }),
  }).then((r) => r.json())

  const deleted = await fetch(`${base}/bushitsu/${room.id}/enmoku/${enmoku.id}`, {
    method: "DELETE",
  })
  expect(deleted.status).toBe(200)

  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(bangumi.some((e: { id: string }) => e.id === enmoku.id)).toBe(false)
})

test("delete missing enmoku yields 404 with structured error", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-delete-missing", buchouId: "u1" }),
  }).then((r) => r.json())

  const res = await fetch(`${base}/bushitsu/${room.id}/enmoku/nope`, {
    method: "DELETE",
  })
  expect(res.status).toBe(404)
  const body = await res.json()
  expect(body.error.code).toBe("ENMOKU_NOT_FOUND")
})

test("delete enmoku broadcasts BANGUMI to active room members", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-delete-broadcast", buchouId: "host" }),
  }).then((r) => r.json())

  const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "broadcast-delete",
      type: "direct",
      url: "https://e/v.mp4",
      addedBy: "host",
    }),
  }).then((r) => r.json())

  const host = await open(room.id, "host")
  const guest = await open(room.id, "guest")
  const hostBangumi = nextMatch(host, (m) => m.type === "BANGUMI")
  const guestBangumi = nextMatch(guest, (m) => m.type === "BANGUMI")

  await fetch(`${base}/bushitsu/${room.id}/enmoku/${enmoku.id}`, {
    method: "DELETE",
  })

  const [hostMsg, guestMsg] = await Promise.all([hostBangumi, guestBangumi])
  if (hostMsg.type === "BANGUMI") expect(hostMsg.payload.enmoku).toEqual([])
  if (guestMsg.type === "BANGUMI") expect(guestMsg.payload.enmoku).toEqual([])

  host.close()
  guest.close()
})

test("missing bushitsu yields 404 with structured error", async () => {
  const res = await fetch(`${base}/bushitsu/nope`)
  expect(res.status).toBe(404)
  const body = await res.json()
  expect(body.error.code).toBe("BUSHITSU_NOT_FOUND")
})
