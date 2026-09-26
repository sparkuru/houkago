import { afterEach, expect, test } from "bun:test"
import { DEFAULT_SITE_CONFIG } from "houkago-kousoku"
import {
  HoukagoHttpError,
  configureHousouHttpClient,
  createRoom,
  fetchSiteConfig,
  normalizeHttpError,
} from "houkago-kyoushitsu/http"
import { applySiteConfigTitle, createSiteConfigLoader } from "houkago-kyoushitsu/site-config"
import { shouldFallbackConfig } from "../src/app/runtime"
afterEach(() => configureHousouHttpClient())
function configure(response: () => Response) {
  const requests: Request[] = []
  configureHousouHttpClient({
    baseUrl: "http://fixture.test",
    fetch: Object.assign(
      async (input: RequestInfo | URL) => {
        requests.push(new Request(input))
        return response()
      },
      { preconnect: fetch.preconnect },
    ),
  })
  return requests
}
function loader(warnings: string[]) {
  return createSiteConfigLoader(
    async () => ({ data: await fetchSiteConfig(), error: null }),
    (message) => warnings.push(message),
    { shouldFallbackOnFailure: shouldFallbackConfig },
  )
}
for (const response of [
  () => new Response(""),
  () => new Response("", { headers: { "Content-Length": "0" } }),
  () => new Response(null, { status: 204 }),
]) {
  test("true empty response preserves typed metadata and defaults once", async () => {
    configure(response)
    try {
      await fetchSiteConfig()
      throw new Error("expected failure")
    } catch (error) {
      expect(error).toBeInstanceOf(HoukagoHttpError)
      if (!(error instanceof HoukagoHttpError)) throw error
      expect(error.code).toBe("EMPTY_RESPONSE")
      expect(error.response?.status).toBe(error.status)
      expect(error.request?.url).toBe("http://fixture.test/site-config")
    }
    const warnings: string[] = []
    const load = loader(warnings)
    expect(load()).toBe(load())
    expect(await load()).toBe(DEFAULT_SITE_CONFIG)
    expect(warnings).toHaveLength(1)
  })
}
for (const body of ["{}", "null", "3", '"primitive"', "{broken", " ", '{"site":{}}'])
  test(`invalid nonempty config rejects without fallback (${body})`, async () => {
    configure(
      () =>
        new Response(body, {
          headers: { "Content-Type": "application/json", "Content-Length": "0" },
        }),
    )
    const warnings: string[] = []
    await expect(loader(warnings)()).rejects.toThrow()
    expect(warnings).toEqual([])
  })
test("HTTP/network fallback warning is value-free, title uses normalized config", async () => {
  configure(() =>
    Response.json({ error: { code: "FAILED", message: "private-sentinel" } }, { status: 503 }),
  )
  const warnings: string[] = []
  const config = await loader(warnings)()
  expect(config).toBe(DEFAULT_SITE_CONFIG)
  expect(warnings.join()).not.toContain("private-sentinel")
  const target = { title: "" }
  applySiteConfigTitle(config, target)
  expect(target.title).toBe(config.site.browserTitle)
})
test("configured fetch, original cookies/signal and abort survive scoped config wrapper", async () => {
  const requests = configure(() => Response.json(DEFAULT_SITE_CONFIG))
  const controller = new AbortController()
  await fetchSiteConfig({ signal: controller.signal })
  expect(requests).toHaveLength(1)
  expect(requests[0]?.credentials).toBe("include")
  controller.abort()
  await expect(fetchSiteConfig({ signal: controller.signal })).rejects.toMatchObject({
    kind: "aborted",
  })
})
test("create resource makes one typed cookie/body request with normalized error metadata", async () => {
  const requests = configure(() =>
    Response.json({ id: "room", name: "name", buchouId: "a", createdAt: 1 }),
  )
  expect((await createRoom({ name: "name" })).id).toBe("room")
  expect(requests).toHaveLength(1)
  expect(requests[0]?.method).toBe("POST")
  expect(await requests[0]?.json()).toEqual({ name: "name" })
  expect(requests[0]?.credentials).toBe("include")
  configure(() =>
    Response.json({ error: { code: "FORBIDDEN", message: "Denied" } }, { status: 403 }),
  )
  await expect(createRoom({ name: "name" })).rejects.toMatchObject({
    status: 403,
    code: "FORBIDDEN",
    kind: "http",
  })
})
test("normalization preserves existing typed kind/code and fills metadata", () => {
  const error = normalizeHttpError(
    new HoukagoHttpError("protocol", "Empty", undefined, "EMPTY_RESPONSE"),
    new Response("", { status: 200 }),
    new Request("http://fixture.test"),
  )
  expect(error.code).toBe("EMPTY_RESPONSE")
  expect(error.kind).toBe("protocol")
  expect(error.status).toBe(200)
  expect(error.request?.method).toBe("GET")
})
