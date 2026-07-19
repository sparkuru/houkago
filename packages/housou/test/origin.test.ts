import { afterEach, expect, test } from "bun:test"
import { Forbidden } from "../src/lib/errors"
import { allowedOrigin, corsOrigin, isTrustedOrigin, requireTrustedOrigin } from "../src/lib/origin"

const initialOrigin = process.env.HOUKAGO_CORS_ORIGIN
const initialNodeEnv = process.env.NODE_ENV

afterEach(() => {
  if (initialOrigin === undefined) process.env.HOUKAGO_CORS_ORIGIN = undefined
  else process.env.HOUKAGO_CORS_ORIGIN = initialOrigin
  process.env.NODE_ENV = initialNodeEnv
})

test("configured credentialed origin is exact", () => {
  process.env.HOUKAGO_CORS_ORIGIN = "http://192.168.9.4:5173"

  expect(allowedOrigin()).toBe("http://192.168.9.4:5173")
  expect(() => requireTrustedOrigin("http://192.168.9.4:5173")).not.toThrow()
  expect(() => requireTrustedOrigin("http://192.168.9.5:5173")).toThrow(Forbidden)
})

test("development without an explicit origin accepts every frontend origin", () => {
  process.env.NODE_ENV = "development"
  process.env.HOUKAGO_CORS_ORIGIN = undefined

  expect(corsOrigin()).toBe(true)
  expect(isTrustedOrigin("http://192.168.9.4:5173")).toBe(true)
  expect(isTrustedOrigin("https://another-dev-host.test")).toBe(true)
})
