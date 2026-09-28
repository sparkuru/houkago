import { afterEach, expect, test } from "bun:test"
import { type HoukagoHttpError, configureHousouHttpClient } from "../src/api/http-client"
import {
  clearDanmakuRoomDefault,
  confirmDanmakuPersonalMatch,
  createBaiduSource,
  fetchLegacyDanmakuCues,
  requestBaiduAdapterPairing,
  revokeBaiduConnection,
  setDanmakuRoomDefault,
  startBaiduOauth,
  submitDanmakuPublicProposal,
} from "../src/api/resources/http"

function installFetch(handler: (request: Request) => Response | Promise<Response>): Request[] {
  const requests: Request[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    return handler(request)
  }
  configureHousouHttpClient({ baseUrl: "https://housou.test", fetch: fetcher })
  return requests
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

afterEach(() => {
  configureHousouHttpClient({ baseUrl: "http://127.0.0.1:3000", fetch: globalThis.fetch })
})

test("Baidu pairing, OAuth, source creation and revoke use cookie SDK routes", async () => {
  const created = {
    id: "item-1",
    bushitsuId: "room-1",
    title: "Movie",
    type: "direct",
    url: "baidu://source-1",
    provider: { kind: "baidu", sourceId: "source-1", fileName: "Movie.mp4" },
    addedBy: "alice",
  }
  const requests = installFetch((request) => {
    const path = new URL(request.url).pathname
    if (path === "/baidu/adaptor/pairing")
      return json({ state: "pairing-required", pairingCode: "123456", expiresAt: 10 })
    if (path === "/baidu/oauth/start")
      return json({ authorizationUrl: "https://baidu.test/oauth", expiresAt: 10 })
    if (path === "/baidu/sources") return json(created)
    return json({ ok: true })
  })

  await expect(requestBaiduAdapterPairing("device-1", false)).resolves.toMatchObject({
    state: "pairing-required",
  })
  await expect(startBaiduOauth("user-held", "device-1")).resolves.toMatchObject({
    authorizationUrl: "https://baidu.test/oauth",
  })
  await expect(
    createBaiduSource({
      bushitsuId: "room-1",
      fileId: "file-1",
      fileName: "Movie.mp4",
      upstreamHandle: "file-1",
    }),
  ).resolves.toEqual(created)
  await expect(revokeBaiduConnection()).resolves.toEqual({ ok: true })

  expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
    ["POST", "/baidu/adaptor/pairing"],
    ["POST", "/baidu/oauth/start"],
    ["POST", "/baidu/sources"],
    ["DELETE", "/baidu/connection"],
  ])
  expect(requests.every((request) => request.credentials === "include")).toBe(true)
  expect(await requests[0]?.json()).toEqual({ deviceId: "device-1", localPaired: false })
  expect(await requests[1]?.json()).toEqual({ retentionMode: "user-held", deviceId: "device-1" })
  expect(await requests[2]?.json()).toEqual({
    bushitsuId: "room-1",
    fileId: "file-1",
    fileName: "Movie.mp4",
    upstreamHandle: "file-1",
  })
})

test("Baidu revoke failure remains a typed rejection for caller-owned local cleanup", async () => {
  const requests = installFetch(() =>
    json({ error: { code: "UPSTREAM", message: "try again" } }, 503),
  )
  await expect(revokeBaiduConnection()).rejects.toMatchObject({
    kind: "http",
    status: 503,
    code: "UPSTREAM",
  } satisfies Partial<HoukagoHttpError>)
  expect(requests).toHaveLength(1)
})

test("danmaku default, proposal, match and legacy cue operations retain path and body", async () => {
  const requests = installFetch((request) => {
    if (request.url.includes("/eisha/danmaku/"))
      return json([{ time: 1, text: "hello", mode: "scroll" }])
    return json({ ok: true })
  })
  const evidence = [{ kind: "confirmation" as const, scope: "personal" as const }]
  await setDanmakuRoomDefault("room-1", "item-1", "track-1")
  await clearDanmakuRoomDefault("room-1", "item-1")
  await submitDanmakuPublicProposal("release-1", evidence)
  await confirmDanmakuPersonalMatch("release-1", "episode-1", evidence)
  await expect(fetchLegacyDanmakuCues("legacy-1")).resolves.toEqual([
    { time: 1, text: "hello", mode: "scroll" },
  ])

  expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
    ["PUT", "/danmaku/bushitsu/room-1/enmoku/item-1/default"],
    ["DELETE", "/danmaku/bushitsu/room-1/enmoku/item-1/default"],
    ["POST", "/danmaku/proposals"],
    ["POST", "/danmaku/matches"],
    ["GET", "/eisha/danmaku/legacy-1"],
  ])
  expect(await requests[0]?.json()).toEqual({ trackId: "track-1" })
  expect(await requests[2]?.json()).toEqual({ releaseId: "release-1", evidence })
  expect(await requests[3]?.json()).toEqual({
    releaseId: "release-1",
    episodeId: "episode-1",
    trustScope: "personal",
    evidence,
  })
  expect(requests.every((request) => request.credentials === "include")).toBe(true)
})

test("abort signal reaches newly added adapters", async () => {
  const controller = new AbortController()
  const requests = installFetch(
    (request) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"))
        if (request.signal.aborted) abort()
        else request.signal.addEventListener("abort", abort, { once: true })
      }),
  )
  const pending = startBaiduOauth("server-saved", undefined, { signal: controller.signal })
  controller.abort()
  await expect(pending).rejects.toMatchObject({
    kind: "aborted",
  } satisfies Partial<HoukagoHttpError>)
  expect(requests[0]?.signal.aborted).toBe(true)
})
