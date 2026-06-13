import { expect, test } from "bun:test"
import type { Shinkou } from "houkago-kousoku"
import { NotBuchou } from "../src/lib/errors"
import { ShinkouSeigyo } from "../src/ws/shinkou"

// Pure sync-core tests (design §5): host-authority gate + projected-progress
// math, exercised without a socket. ShinkouSeigyo is in-memory so each test
// uses a fresh instance.

const playing: Shinkou = { isPlaying: true, currentTime: 100, playbackRate: 1 }
const paused: Shinkou = { isPlaying: false, currentTime: 100, playbackRate: 1 }

test("genjou defaults to a fresh paused state for an unknown room", () => {
  const s = new ShinkouSeigyo()
  const g = s.genjou("ghost")
  expect(g.enmokuId).toBeNull()
  expect(g.shinkou.isPlaying).toBe(false)
  expect(g.shinkou.currentTime).toBe(0)
})

test("部長 may record a Shinkou; genjou reflects it", () => {
  const s = new ShinkouSeigyo()
  s.shinkou("rA", playing, "e1", "host", "host", 1_000)
  const g = s.genjou("rA")
  expect(g.enmokuId).toBe("e1")
  expect(g.shinkou.currentTime).toBe(100)
  expect(g.shinkouServerTime).toBe(1_000)
})

test("non-部長 SHINKOU is rejected with NotBuchou and leaves state untouched", () => {
  const s = new ShinkouSeigyo()
  s.shinkou("rA", playing, "e1", "host", "host", 1_000)
  expect(() => s.shinkou("rA", paused, "e1", "intruder", "host", 2_000)).toThrow(NotBuchou)
  // authoritative state must be unchanged after a rejected drive attempt
  const g = s.genjou("rA")
  expect(g.shinkou.isPlaying).toBe(true)
  expect(g.shinkouServerTime).toBe(1_000)
})

test("projected returns currentTime while paused (no elapsed advance)", () => {
  const s = new ShinkouSeigyo()
  s.shinkou("rA", paused, null, "host", "host", 1_000)
  expect(s.projected("rA", 9_000)).toBe(100)
})

test("projected advances by elapsed*rate while playing (design §5)", () => {
  const s = new ShinkouSeigyo()
  s.shinkou(
    "rA",
    { isPlaying: true, currentTime: 100, playbackRate: 2 },
    null,
    "host",
    "host",
    1_000,
  )
  // 4s of wall-clock elapsed at rate 2 → +8s → 108
  expect(s.projected("rA", 5_000)).toBe(108)
})
