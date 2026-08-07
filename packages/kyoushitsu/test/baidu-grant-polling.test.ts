import { expect, test } from "bun:test"
import { shouldPollPendingBaiduGrant } from "../src/lib/baidu-grant-polling"

test("pending grant deadline covers Chromium's first alarm and stops at expiry", () => {
  const now = 10_000
  const pending = {
    state: "pending" as const,
    requestId: "request-0123456789",
    expiresAt: now + 90_000,
  }
  expect(shouldPollPendingBaiduGrant(pending, now + 30_000)).toBe(true)
  expect(shouldPollPendingBaiduGrant(pending, now + 60_000)).toBe(true)
  expect(shouldPollPendingBaiduGrant(pending, pending.expiresAt - 1)).toBe(true)
  expect(shouldPollPendingBaiduGrant(pending, pending.expiresAt)).toBe(false)
  expect(
    shouldPollPendingBaiduGrant({ state: "failed", reason: "upstream-resolution-failed" }, now),
  ).toBe(false)
})
