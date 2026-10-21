import { expect, test } from "bun:test"
import { resolveBaiduRedirectUri } from "../src/lib/baidu-config"

test.each([
  "http://localhost:8080",
  "http://192.0.2.3:9999",
  "https://watch.example",
  "http://[::1]:8080",
])("relative Baidu callback follows public origin %s", (origin) => {
  expect(
    resolveBaiduRedirectUri("/api/baidu/oauth/callback", `${origin}/api/baidu/oauth/start`),
  ).toBe(`${origin}/api/baidu/oauth/callback`)
})

test("explicit absolute callback remains independent of the request origin", () => {
  expect(
    resolveBaiduRedirectUri(
      "https://callback.example/api/baidu/oauth/callback",
      "http://localhost:8080",
    ),
  ).toBe("https://callback.example/api/baidu/oauth/callback")
  expect(resolveBaiduRedirectUri("/api/baidu/oauth/callback")).toBeUndefined()
})

test.each([
  "//other.example/callback",
  "/\\other.example/callback",
  "callback",
  "javascript:alert(1)",
  "https://user:password@other.example/callback",
  "/api/baidu/oauth/callback#fragment",
  "/api/baidu/oauth/callback?query=unexpected",
  "/api/baidu/oauth/callback\n",
])("malformed Baidu callback is rejected: %s", (value) => {
  expect(resolveBaiduRedirectUri(value, "https://watch.example")).toBeUndefined()
})
