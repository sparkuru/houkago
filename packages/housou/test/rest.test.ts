import { afterAll, beforeAll, expect, test } from "bun:test"
import { Elysia } from "elysia"
import { decodeDashManifestRef, decodeProxyRef } from "houkago-eisha"
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

test("previewing a public source does not write the room queue", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-preview", buchouId: "u1" }),
  }).then((r) => r.json())
  const originalFetch = globalThis.fetch
  const previewFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (new URL(url).hostname === "media.example.test") {
      return new Response(null, { headers: { "content-type": "video/mp4" } })
    }
    return originalFetch(input, init)
  }
  globalThis.fetch = previewFetch

  try {
    const preview = await fetch(`${base}/bushitsu/${room.id}/enmoku/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceUrl: "https://media.example.test/video.mp4",
        title: "Preview title",
      }),
    }).then((r) => r.json())

    expect(preview).toEqual({ state: "ready", title: "Preview title", type: "direct" })
    const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
    expect(bangumi).toEqual([])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("preview rejects a private source before it can be queued", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-private-preview", buchouId: "u1" }),
  }).then((r) => r.json())

  const response = await fetch(`${base}/bushitsu/${room.id}/enmoku/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceUrl: "http://127.0.0.1/video.mp4" }),
  })

  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({
    error: {
      code: "EISHA_PRIVATE_UPSTREAM",
      message: "private and local upstream URLs are not supported",
    },
  })
  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(bangumi).toEqual([])
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
    provider: {
      kind: "bilibili",
      url: "https://www.bilibili.com/video/BV1xx411c7mD/",
      coverUrl: "https://i0.hdslb.com/bfs/archive/cover.jpg",
      ownerName: "字幕君",
      stats: { view: 100, danmaku: 20, reply: 3 },
    },
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
  expect(enmoku.provider).toEqual(metadata.provider)
  expect(enmoku.live).toBe(true)

  const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
  expect(bangumi[0].headers).toEqual(metadata.headers)
  expect(bangumi[0].subtitles).toEqual(metadata.subtitles)
  expect(bangumi[0].sources).toEqual(metadata.sources)
  expect(bangumi[0].danmaku).toEqual(metadata.danmaku)
  expect(bangumi[0].provider).toEqual(metadata.provider)
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

test("add enmoku from Bilibili sourceUrl persists parser metadata", async () => {
  const room = await fetch(`${base}/bushitsu`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "r-bilibili-metadata", buchouId: "u1" }),
  }).then((r) => r.json())

  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname !== "api.bilibili.com") return originalFetch(input, init)

    if (url.pathname === "/x/web-interface/view") {
      return Response.json({
        code: 0,
        data: {
          bvid: "BV1xx411c7mD",
          title: "Bilibili resolved",
          pic: "https://i0.hdslb.com/bfs/archive/cover.jpg",
          cid: 62131,
          owner: { name: "Bili UP" },
          stat: { view: 1000, danmaku: 10, reply: 20, coin: 30, like: 40 },
        },
      })
    }

    return Response.json({
      code: 0,
      data: {
        support_formats: [{ quality: 32, display_desc: "480P" }],
        dash: {
          video: [
            {
              id: 32,
              baseUrl: "https://upos.example.test/video-480.m4s?sig=1",
              width: 512,
              height: 384,
              codecs: "avc1.64001E",
              segment_base: { initialization: "0-1023", index_range: "1024-2048" },
            },
          ],
          audio: [
            {
              id: 30280,
              baseUrl: "https://upos.example.test/audio-192.m4s?sig=1",
              codecs: "mp4a.40.2",
              bandwidth: 132000,
              segment_base: { initialization: "0-919", index_range: "920-1100" },
            },
          ],
        },
      },
    })
  }) as typeof fetch

  try {
    const enmoku = await fetch(`${base}/bushitsu/${room.id}/enmoku`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
        addedBy: "u1",
      }),
    }).then((r) => r.json())

    expect(enmoku.title).toBe("Bilibili resolved")
    expect(enmoku.type).toBe("dash")
    expect(enmoku.sources?.[0]?.name).toBe("480P · 512x384 · avc1")
    expect(enmoku.danmaku).toEqual({ type: "fetch", ref: "bilibili:62131" })
    expect(enmoku.provider).toEqual({
      kind: "bilibili",
      url: "https://www.bilibili.com/video/BV1xx411c7mD/",
      coverUrl: expect.stringContaining(`${base}/eisha/proxy/`),
      ownerName: "Bili UP",
      stats: { view: 1000, danmaku: 10, reply: 20, coin: 30, like: 40 },
    })
    expect(decodeProxyRef(enmoku.provider.coverUrl.split("/eisha/proxy/")[1] ?? "").url).toBe(
      "https://i0.hdslb.com/bfs/archive/cover.jpg",
    )
    const dashRef = decodeDashManifestRef(enmoku.url.split("/eisha/dash/")[1] ?? "")
    expect(dashRef.video[0]?.url).toBe("https://upos.example.test/video-480.m4s?sig=1")
    expect(dashRef.audio[0]?.url).toBe("https://upos.example.test/audio-192.m4s?sig=1")
    expect(dashRef.headers).toEqual({
      referer: "https://www.bilibili.com/",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    })

    const bangumi = await fetch(`${base}/bushitsu/${room.id}/bangumi`).then((r) => r.json())
    expect(bangumi[0].sources).toEqual(enmoku.sources)
    expect(bangumi[0].danmaku).toEqual(enmoku.danmaku)
    expect(bangumi[0].provider).toEqual(enmoku.provider)
  } finally {
    globalThis.fetch = originalFetch
  }
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
