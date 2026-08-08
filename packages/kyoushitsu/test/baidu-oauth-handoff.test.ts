import { expect, test } from "bun:test"
import { redeemBaiduOauthHandoffWithRetry } from "../src/lib/baidu-oauth-handoff"

test("retries an OAuth handoff that is not ready on the first focus", async () => {
  let attempts = 0
  const waits: number[] = []

  const redeemed = await redeemBaiduOauthHandoffWithRetry(
    async () => {
      attempts += 1
      if (attempts === 1) throw new Error("OAuth handoff is unavailable")
    },
    {
      active: () => true,
      wait: async (delayMs) => {
        waits.push(delayMs)
      },
    },
  )

  expect(redeemed).toBe(true)
  expect(attempts).toBe(2)
  expect(waits).toEqual([1_000])
})

test("does not redeem again after the first successful OAuth handoff", async () => {
  let attempts = 0
  const redeemed = await redeemBaiduOauthHandoffWithRetry(
    async () => {
      attempts += 1
    },
    { active: () => true, wait: async () => {} },
  )

  expect(redeemed).toBe(true)
  expect(attempts).toBe(1)
})

test("stops OAuth handoff retries when the authorization flow is cancelled", async () => {
  let active = true
  let attempts = 0
  const redeemed = await redeemBaiduOauthHandoffWithRetry(
    async () => {
      attempts += 1
      throw new Error("OAuth handoff is unavailable")
    },
    {
      active: () => active,
      wait: async () => {
        active = false
      },
    },
  )

  expect(redeemed).toBe(false)
  expect(attempts).toBe(1)
})

test("aborts a pending OAuth handoff retry without leaving its delay active", async () => {
  const controller = new AbortController()
  let attempts = 0
  let releaseWaitStarted: (() => void) | undefined
  const waitStarted = new Promise<void>((resolve) => {
    releaseWaitStarted = resolve
  })

  const result = redeemBaiduOauthHandoffWithRetry(
    async () => {
      attempts += 1
      throw new Error("OAuth handoff is unavailable")
    },
    {
      active: () => true,
      signal: controller.signal,
      wait: (_delayMs, signal) =>
        new Promise((resolve) => {
          releaseWaitStarted?.()
          signal?.addEventListener("abort", () => resolve(), { once: true })
        }),
    },
  )

  await waitStarted
  controller.abort()

  expect(await result).toBe(false)
  expect(attempts).toBe(1)
})

test("stops OAuth handoff retries after max-attempt exhaustion", async () => {
  let attempts = 0
  const waits: number[] = []
  const redeemed = await redeemBaiduOauthHandoffWithRetry(
    async () => {
      attempts += 1
      throw new Error("OAuth handoff is unavailable")
    },
    {
      active: () => true,
      wait: async (delayMs) => {
        waits.push(delayMs)
      },
      maxAttempts: 3,
      deadlineMs: 10_000,
    },
  )

  expect(redeemed).toBe(false)
  expect(attempts).toBe(3)
  expect(waits).toEqual([1_000, 1_000])
})

test("does not retry a permanent OAuth handoff error", async () => {
  let attempts = 0
  const redeemed = await redeemBaiduOauthHandoffWithRetry(
    async () => {
      attempts += 1
      throw new Error("permanent authorization failure")
    },
    {
      active: () => true,
      retryable: () => false,
      wait: async () => {
        throw new Error("permanent errors must not wait")
      },
    },
  )

  expect(redeemed).toBe(false)
  expect(attempts).toBe(1)
})

test("bounds OAuth handoff retries by attempts and deadline", async () => {
  let attempts = 0
  let now = 1_000
  const waits: number[] = []
  const redeemed = await redeemBaiduOauthHandoffWithRetry(
    async () => {
      attempts += 1
      throw new Error("OAuth handoff is unavailable")
    },
    {
      active: () => true,
      now: () => now,
      wait: async (delayMs) => {
        waits.push(delayMs)
        now += delayMs
      },
      maxAttempts: 10,
      retryDelayMs: 1_000,
      deadlineMs: 2_500,
    },
  )

  expect(redeemed).toBe(false)
  expect(attempts).toBe(3)
  expect(waits).toEqual([1_000, 1_000, 500])
})
