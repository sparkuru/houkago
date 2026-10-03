import { afterEach, expect, test } from "bun:test"
import {
  clearPendingRoomBangumi,
  configureHousouHttpClient,
  createRoomEnmoku,
  deleteRoomEnmoku,
  deleteRoomMember,
  fetchRoom,
  fetchRoomBangumi,
  moveRoomBangumi,
  previewRoomEnmoku,
} from "houkago-kyoushitsu-core/http"

afterEach(() => configureHousouHttpClient())

test("room adapters send typed cookie requests and retain command errors", async () => {
  const requests: Request[] = []
  let fail = false
  configureHousouHttpClient({
    baseUrl: "http://fixture.test",
    fetch: Object.assign(
      async (input: RequestInfo | URL) => {
        const request = new Request(input)
        requests.push(request)
        if (fail)
          return Response.json({ error: { code: "FORBIDDEN", message: "Denied" } }, { status: 403 })
        if (request.url.endsWith("/enmoku/preview"))
          return Response.json({ state: "ready", title: "Clip", type: "direct" })
        if (request.method === "POST" && request.url.endsWith("/enmoku"))
          return Response.json({
            id: "item",
            title: "Clip",
            bushitsuId: "room",
            type: "direct",
            url: "https://example.test/clip.mp4",
            addedBy: "host",
          })
        if (request.url.endsWith("/bangumi")) return Response.json([])
        if (request.url.endsWith("/room"))
          return Response.json({ id: "room", name: "Room", buchouId: "host", createdAt: 1 })
        return Response.json({ ok: true, removed: 1 })
      },
      { preconnect: fetch.preconnect },
    ),
  })
  const signal = new AbortController().signal
  expect((await fetchRoom("room", { signal })).name).toBe("Room")
  expect(await fetchRoomBangumi("room", { signal })).toEqual([])
  expect(
    (await previewRoomEnmoku("room", "https://example.test/clip.mp4", "Clip", { signal })).title,
  ).toBe("Clip")
  expect(
    (await createRoomEnmoku("room", "https://example.test/clip.mp4", "Clip", { signal })).id,
  ).toBe("item")
  await moveRoomBangumi("room", "item", "up", { signal })
  await deleteRoomEnmoku("room", "item", { signal })
  await clearPendingRoomBangumi("room", { signal })
  await deleteRoomMember("room", "guest", { signal })
  expect(requests.map((request) => [request.method, new URL(request.url).pathname])).toEqual([
    ["GET", "/bushitsu/room"],
    ["GET", "/bushitsu/room/bangumi"],
    ["POST", "/bushitsu/room/enmoku/preview"],
    ["POST", "/bushitsu/room/enmoku"],
    ["POST", "/bushitsu/room/bangumi/item/move"],
    ["DELETE", "/bushitsu/room/enmoku/item"],
    ["DELETE", "/bushitsu/room/bangumi/pending"],
    ["DELETE", "/bushitsu/room/meibo/guest"],
  ])
  expect(requests.every((request) => request.credentials === "include")).toBe(true)
  expect(await requests[2]?.json()).toEqual({
    sourceUrl: "https://example.test/clip.mp4",
    title: "Clip",
  })
  expect(await requests[4]?.json()).toEqual({ direction: "up" })
  fail = true
  await expect(deleteRoomMember("room", "guest")).rejects.toMatchObject({
    status: 403,
    code: "FORBIDDEN",
  })
})
