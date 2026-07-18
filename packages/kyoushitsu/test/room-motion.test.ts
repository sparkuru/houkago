import { expect, test } from "bun:test"
import { prefersReducedMotion } from "../src/composables/use-room-motion"

test("room motion follows the reduced-motion preference", () => {
  ;(globalThis as { matchMedia?: (query: string) => { matches: boolean } }).matchMedia = () => ({
    matches: true,
  })

  expect(prefersReducedMotion()).toBe(true)
})
