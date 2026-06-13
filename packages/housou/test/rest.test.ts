import { afterAll, beforeAll, expect, test } from "bun:test"
import { app } from "../src/index"

// Exercise the domain → db layering through the real REST surface. Bootstrap
// (CREATE TABLE IF NOT EXISTS) runs on import of the db client.

let base: string

beforeAll(() => {
  app.listen(0)
  base = `http://localhost:${app.server?.port}`
})

afterAll(() => {
  app.server?.stop()
})

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
})

test("missing bushitsu yields 404 with structured error", async () => {
  const res = await fetch(`${base}/bushitsu/nope`)
  expect(res.status).toBe(404)
  const body = await res.json()
  expect(body.error.code).toBe("BUSHITSU_NOT_FOUND")
})
