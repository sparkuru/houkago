import { expect, test } from "bun:test"

test("configured frontend origin receives credentialed CORS preflight headers", async () => {
  const previousOrigin = process.env.HOUKAGO_CORS_ORIGIN
  const previousNodeEnv = process.env.NODE_ENV
  const origin = "http://192.168.9.4:5173"
  process.env.HOUKAGO_CORS_ORIGIN = origin

  const { app } = await import(`../src/index.ts?cors-test=${crypto.randomUUID()}`)
  app.listen(0)
  try {
    const response = await fetch(`http://127.0.0.1:${app.server?.port}/seitoshou/register`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(origin)
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
  } finally {
    app.server?.stop()
    if (previousOrigin === undefined) Reflect.deleteProperty(process.env, "HOUKAGO_CORS_ORIGIN")
    else process.env.HOUKAGO_CORS_ORIGIN = previousOrigin
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV")
    else process.env.NODE_ENV = previousNodeEnv
  }
})

test("development CORS reflects any frontend origin with credentials", async () => {
  const previousOrigin = process.env.HOUKAGO_CORS_ORIGIN
  const previousNodeEnv = process.env.NODE_ENV
  const origin = "http://192.168.9.4:5173"
  Reflect.deleteProperty(process.env, "HOUKAGO_CORS_ORIGIN")
  process.env.NODE_ENV = "development"

  const { app } = await import(`../src/index.ts?dev-cors-test=${crypto.randomUUID()}`)
  app.listen(0)
  try {
    const response = await fetch(`http://127.0.0.1:${app.server?.port}/seitoshou/register`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe(origin)
    expect(response.headers.get("access-control-allow-credentials")).toBe("true")
  } finally {
    app.server?.stop()
    if (previousOrigin === undefined) Reflect.deleteProperty(process.env, "HOUKAGO_CORS_ORIGIN")
    else process.env.HOUKAGO_CORS_ORIGIN = previousOrigin
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV")
    else process.env.NODE_ENV = previousNodeEnv
  }
})
