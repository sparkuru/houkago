import { afterEach, expect, test } from "bun:test"
import { housouUrl } from "../src/config/housou-url"

const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location")

afterEach(() => {
  if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation)
  else Reflect.deleteProperty(globalThis, "location")
})

test.each(["http://localhost:9999", "https://watch.example:8443", "http://[::1]:5174"])(
  "API base follows the actual site origin: %s",
  (origin) => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: new URL(`${origin}/bushitsu/room`),
    })
    expect(housouUrl()).toBe(`${origin}/api`)
  },
)
