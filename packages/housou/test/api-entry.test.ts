import { expect, test } from "bun:test"
import { app } from "../src/index"

test("API prefix owns health and JSON errors without exposing legacy routes", async () => {
  const healthy = await app.handle(new Request("http://site.test/api/health"))
  expect(healthy.status).toBe(200)
  expect(await healthy.json()).toEqual({ ok: true })
  for (const path of ["/api/missing", "/health", "/seitoshou/me", "/apix/health"]) {
    const response = await app.handle(new Request(`http://site.test${path}`))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "not found" } })
  }
})
