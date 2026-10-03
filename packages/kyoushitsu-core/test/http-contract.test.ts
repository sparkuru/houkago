import { afterEach, expect, test } from "bun:test"
import { HoukagoHttpError, configureHousouHttpClient } from "../src/api/http-client"
import {
  createBaiduGrant,
  createDanmakuCandidateSearch,
  fetchBaiduAvailability,
  fetchDanmakuCandidates,
  fetchDanmakuSearch,
  fetchIdentityMe,
  fetchSiteConfig,
  moveRoomBangumi,
  pollBaiduGrant,
  prepareBaiduGrant,
  signInIdentity,
  signOutIdentity,
} from "../src/api/resources/http"

type FetchHandler = (request: Request) => Response | Promise<Response>

const siteConfig = {
  site: { name: "活动室", subtitle: null, browserTitle: "放映室" },
  entry: {
    floorCode: "3F",
    floorLabel: "文化部楼层",
    hint: "沿走廊前行。",
    privacyNote: "只显示已知的教室。",
    defaultBushitsuName: "动画研究会",
  },
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

function installFetch(handler: FetchHandler): Request[] {
  const requests: Request[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    return handler(request)
  }
  configureHousouHttpClient({ baseUrl: "https://housou.test", fetch: fetcher })
  return requests
}

async function captureFailure(action: () => Promise<unknown>): Promise<unknown> {
  let resolved = false
  let failure: unknown
  try {
    await action()
    resolved = true
  } catch (error) {
    failure = error
  }
  expect(resolved).toBe(false)
  return failure
}

afterEach(() => {
  configureHousouHttpClient({ baseUrl: "http://127.0.0.1:3000", fetch: globalThis.fetch })
})

test("site config uses the configured origin and cookie credentials", async () => {
  const requests = installFetch(() => jsonResponse(siteConfig))

  await expect(fetchSiteConfig()).resolves.toEqual(siteConfig)

  const request = requests[0]
  if (!request) throw new Error("site config request was not captured")
  expect(request.url).toBe("https://housou.test/site-config")
  expect(request.credentials).toBe("include")
})

test.each([400, 401, 403, 404, 409, 422, 428, 500, 502, 503])(
  "identity errors retain status, domain details and response metadata (%i)",
  async (status) => {
    const requests = installFetch(() =>
      jsonResponse(
        { error: { code: `CONTRACT_${status}`, message: `failure ${status}` } },
        status,
        { "x-contract-status": String(status) },
      ),
    )

    const failure = await captureFailure(() => fetchIdentityMe())
    expect(failure).toBeInstanceOf(HoukagoHttpError)
    if (!(failure instanceof HoukagoHttpError)) return

    expect(failure.kind).toBe("http")
    expect(failure.status).toBe(status)
    expect(failure.code).toBe(`CONTRACT_${status}`)
    expect(failure.message).toBe(`failure ${status}`)
    expect(failure.response?.headers["x-contract-status"]).toBe(String(status))
    expect(requests).toHaveLength(1)
  },
)

test("network failures are not converted into successful empty data", async () => {
  installFetch(() => {
    throw new TypeError("socket unavailable")
  })

  const failure = await captureFailure(() => fetchIdentityMe())
  expect(failure).toBeInstanceOf(HoukagoHttpError)
  if (!(failure instanceof HoukagoHttpError)) return
  expect(failure.kind).toBe("network")
  expect(failure.status).toBeUndefined()
  expect(failure.message).toBe("socket unavailable")
})

test.each(["", "{}", "null", "true", "1", '"unexpected"', "{invalid-json"])(
  "invalid success bodies are protocol failures (%s)",
  async (body) => {
    installFetch(
      () => new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
    )
    expect(await captureFailure(() => fetchIdentityMe())).toMatchObject({
      kind: "protocol",
      status: 200,
    })
  },
)

test.each([204, 200])(
  "empty transport responses cannot become typed success (%i)",
  async (status) => {
    installFetch(
      () =>
        new Response(null, {
          status,
          headers: { "content-type": "application/json", "content-length": "0" },
        }),
    )
    expect(await captureFailure(() => fetchIdentityMe())).toMatchObject({
      kind: "protocol",
      status,
    })
  },
)

test("identity commands preserve the public summary, cookie credentials and acknowledgement", async () => {
  const seito = { id: "seito-1", username: "alice", createdAt: 123 }
  const requests = installFetch((request) =>
    jsonResponse(request.url.endsWith("/sign-in") ? seito : { ok: true }),
  )
  await expect(signInIdentity({ username: "alice", password: "password1" })).resolves.toEqual(seito)
  await expect(signOutIdentity()).resolves.toEqual({ ok: true })
  expect(requests.map((request) => request.credentials)).toEqual(["include", "include"])
  expect(await requests[0]?.json()).toEqual({ username: "alice", password: "password1" })
})

test("queue domain failure stays a rejected command without replay", async () => {
  const requests = installFetch(() =>
    jsonResponse(
      { error: { code: "FORBIDDEN", message: "only room owner may manage the queue" } },
      403,
    ),
  )
  const failure = await captureFailure(() => moveRoomBangumi("room-1", "enmoku-1", "down"))
  expect(failure).toMatchObject({ kind: "http", status: 403, code: "FORBIDDEN" })
  expect(requests).toHaveLength(1)
})

test.each(["ready", "failed"])("grant preparation creates once and stops at %s", async (state) => {
  const terminal =
    state === "ready"
      ? {
          state,
          grantUrl: "https://housou.test/baidu/media/grant-1",
          expiresAt: Date.now() + 60_000,
        }
      : { state, reason: "upstream-resolution-failed" }
  const responses = [
    { state: "pending", requestId: "request-123456789", expiresAt: Date.now() + 60_000 },
    terminal,
  ]
  const requests = installFetch(() => {
    const response = responses.shift()
    if (!response) throw new Error("grant workflow polled past its terminal state")
    return jsonResponse(response)
  })
  await expect(
    prepareBaiduGrant("source-1", "room-1", {
      signal: new AbortController().signal,
      maxPolls: 3,
      pollIntervalMs: 0,
    }),
  ).resolves.toEqual(terminal)
  expect(requests.map((request) => request.method)).toEqual(["POST", "GET"])
  expect(requests.every((request) => request.credentials === "include")).toBe(true)
})

test("grant preparation has a strict polling limit and never replays creation", async () => {
  const requests = installFetch(() =>
    jsonResponse({
      state: "pending",
      requestId: "request-123456789",
      expiresAt: Date.now() + 60_000,
    }),
  )
  const failure = await captureFailure(() =>
    prepareBaiduGrant("source-1", "room-1", {
      signal: new AbortController().signal,
      maxPolls: 2,
      pollIntervalMs: 0,
    }),
  )
  expect(failure).toMatchObject({ kind: "protocol" })
  expect(requests.map((request) => request.method)).toEqual(["POST", "GET", "GET"])
})

test("logout cancellation stops pending grant waits without another request", async () => {
  const controller = new AbortController()
  const requests = installFetch(() => {
    setTimeout(() => controller.abort(), 0)
    return jsonResponse({
      state: "pending",
      requestId: "request-123456789",
      expiresAt: Date.now() + 60_000,
    })
  })
  const failure = await captureFailure(() =>
    prepareBaiduGrant("source-1", "room-1", {
      signal: controller.signal,
      pollIntervalMs: 60_000,
    }),
  )
  expect(failure).toMatchObject({ kind: "aborted" })
  expect(requests.map((request) => request.method)).toEqual(["POST"])
})

test("cancelled or expired grants cannot start or continue polling", async () => {
  const controller = new AbortController()
  controller.abort()
  const requests = installFetch(() =>
    jsonResponse({ state: "pending", requestId: "request-123456789", expiresAt: 1 }),
  )
  expect(
    await captureFailure(() =>
      prepareBaiduGrant("source-1", "room-1", { signal: controller.signal }),
    ),
  ).toMatchObject({ kind: "aborted" })
  expect(requests).toHaveLength(0)
  expect(
    await captureFailure(() =>
      prepareBaiduGrant("source-1", "room-1", { signal: new AbortController().signal }),
    ),
  ).toMatchObject({ kind: "protocol" })
  expect(requests).toHaveLength(1)
})

test("superseded candidate searches abort the old request and preserve the new result", async () => {
  let firstSignal: AbortSignal | undefined
  let started = () => {}
  const firstStarted = new Promise<void>((resolve) => {
    started = resolve
  })
  installFetch((request) => {
    if (new URL(request.url).searchParams.get("releaseId") === "release-old") {
      firstSignal = request.signal
      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        )
        started()
      })
    }
    return jsonResponse({
      bushitsuId: "room-1",
      enmokuId: "enmoku-1",
      candidates: [],
      roomDefault: null,
    })
  })
  const search = createDanmakuCandidateSearch()
  const old = search.run("room-1", "enmoku-1", { releaseId: "release-old" })
  const failure = captureFailure(() => old)
  await firstStarted
  const result = await search.run("room-1", "enmoku-1", { releaseId: "release-new" })
  expect(firstSignal?.aborted).toBe(true)
  expect(await failure).toMatchObject({ kind: "aborted" })
  expect(result.candidates).toEqual([])
})

test("catalog search sends the same normalized query used by its key", async () => {
  const requests = installFetch(() => jsonResponse([]))
  await expect(fetchDanmakuSearch("  My   Search ")).resolves.toEqual([])
  expect(new URL(requests[0]?.url ?? "https://invalid").searchParams.get("q")).toBe("my search")
})

test("room queue mutation returns an acknowledgement without a live-state payload", async () => {
  const requests = installFetch(() => jsonResponse({ ok: true }))

  await expect(moveRoomBangumi("room-1", "enmoku-1", "up")).resolves.toEqual({ ok: true })

  const request = requests[0]
  if (!request) throw new Error("queue request was not captured")
  expect(request.method).toBe("POST")
  expect(new URL(request.url).pathname).toBe("/bushitsu/room-1/bangumi/enmoku-1/move")
  expect(await request.json()).toEqual({ direction: "up" })
})

test("Baidu availability and grant polling preserve all union states", async () => {
  const responses = [
    jsonResponse({
      sourceId: "source-1",
      mode: "user-held",
      ownerOnline: true,
      playable: true,
    }),
    jsonResponse({ state: "pending", requestId: "request-123456789", expiresAt: 100 }),
    jsonResponse({
      state: "ready",
      grantUrl: "https://housou.test/baidu/media/grant-1",
      expiresAt: 200,
    }),
    jsonResponse({ state: "failed", reason: "upstream-resolution-failed" }),
  ]
  const requests = installFetch(() => {
    const response = responses.shift()
    if (!response) throw new Error("unexpected Baidu request")
    return response
  })

  await expect(fetchBaiduAvailability("source-1", "room-1")).resolves.toEqual({
    sourceId: "source-1",
    mode: "user-held",
    ownerOnline: true,
    playable: true,
  })
  await expect(createBaiduGrant("source-1", "room-1")).resolves.toEqual({
    state: "pending",
    requestId: "request-123456789",
    expiresAt: 100,
  })
  await expect(pollBaiduGrant("request-123456789")).resolves.toEqual({
    state: "ready",
    grantUrl: "https://housou.test/baidu/media/grant-1",
    expiresAt: 200,
  })
  await expect(pollBaiduGrant("request-123456789")).resolves.toEqual({
    state: "failed",
    reason: "upstream-resolution-failed",
  })

  expect(new URL(requests[0]?.url ?? "https://invalid").searchParams.get("bushitsuId")).toBe(
    "room-1",
  )
  expect(new URL(requests[1]?.url ?? "https://invalid").pathname).toBe(
    "/baidu/sources/source-1/grants",
  )
})

test("danmaku candidate requests carry search dimensions and honor AbortSignal", async () => {
  const requests = installFetch(() =>
    jsonResponse({ bushitsuId: "room-1", enmokuId: "enmoku-1", candidates: [], roomDefault: null }),
  )

  await expect(
    fetchDanmakuCandidates("room-1", "enmoku-1", {
      releaseId: "release-1",
      duration: 123,
      fingerprint: "fingerprint-1",
      fingerprintBytes: 64,
    }),
  ).resolves.toEqual({
    bushitsuId: "room-1",
    enmokuId: "enmoku-1",
    candidates: [],
    roomDefault: null,
  })

  const search = new URL(requests[0]?.url ?? "https://invalid").searchParams
  expect(search.get("releaseId")).toBe("release-1")
  expect(search.get("duration")).toBe("123")
  expect(search.get("fingerprint")).toBe("fingerprint-1")
  expect(search.get("fingerprintBytes")).toBe("64")

  const controller = new AbortController()
  const pendingFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    return new Promise<Response>((_resolve, reject) => {
      const rejectAbort = () => reject(new DOMException("Aborted", "AbortError"))
      if (request.signal.aborted) {
        rejectAbort()
      } else {
        request.signal.addEventListener("abort", rejectAbort, { once: true })
      }
    })
  }
  configureHousouHttpClient({ baseUrl: "https://housou.test", fetch: pendingFetch })
  const pending = fetchDanmakuCandidates("room-1", "enmoku-1", {}, { signal: controller.signal })
  controller.abort()

  const failure = await captureFailure(() => pending)
  expect(failure).toBeInstanceOf(HoukagoHttpError)
  if (!(failure instanceof HoukagoHttpError)) return
  expect(failure.kind).toBe("aborted")
})
