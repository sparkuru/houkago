import { expect, test } from "bun:test"
import { Elysia, t } from "elysia"

test("ordinary request schemas preserve JSON and multipart fields after parser hardening", async () => {
  const app = new Elysia()
    .post("/security-fixture", ({ body }) => body, {
      body: t.Object({ name: t.String() }),
    })
    .compile()
  const form = new FormData()
  form.set("name", "club fixture")
  const requests = [
    new Request("http://fixture.test/security-fixture", { method: "POST", body: form }),
    new Request("http://fixture.test/security-fixture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "club fixture" }),
    }),
  ]
  for (const request of requests) {
    const response = await app.handle(request)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ name: "club fixture" })
  }
})

test("invalid arrays return a bounded validation error list", async () => {
  const app = new Elysia()
    .onError(({ code, error }) => {
      if (code === "VALIDATION") return { count: error.all.length }
    })
    .post("/security-fixture", ({ body }) => body, {
      body: t.Object({ values: t.Array(t.Number()) }),
    })
    .compile()
  const response = await app.handle(
    new Request("http://fixture.test/security-fixture", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values: Array.from({ length: 80 }, () => "invalid") }),
    }),
  )
  expect(response.status).toBe(422)
  const result = await response.json()
  expect(result.count).toBeGreaterThan(0)
  expect(result.count).toBeLessThanOrEqual(64)
})

test("schema names and defaults remain literal data during route compilation", async () => {
  const name = "club'name"
  const value = "club's choice\nsecond line"
  const app = new Elysia()
    .get("/security-fixture", ({ query }) => query, {
      query: t.Object({ [name]: t.String({ default: value }) }, { additionalProperties: true }),
    })
    .compile()
  const response = await app.handle(new Request("http://fixture.test/security-fixture"))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ [name]: value })
})
