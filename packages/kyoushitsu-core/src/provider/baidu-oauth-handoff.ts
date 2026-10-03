const HANDOFF_MAX_ATTEMPTS = 10
const HANDOFF_RETRY_DELAY_MS = 1_000
const HANDOFF_RETRY_DEADLINE_MS = 15_000

type BaiduOauthHandoffRetryOptions = {
  active: () => boolean
  signal?: AbortSignal
  now?: () => number
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>
  retryable?: (error: unknown) => boolean
  maxAttempts?: number
  retryDelayMs?: number
  deadlineMs?: number
}

export async function redeemBaiduOauthHandoffWithRetry(
  redeem: () => Promise<void>,
  options: BaiduOauthHandoffRetryOptions,
): Promise<boolean> {
  const now = options.now ?? Date.now
  const wait = options.wait ?? waitFor
  const retryable = options.retryable ?? (() => true)
  const maxAttempts = options.maxAttempts ?? HANDOFF_MAX_ATTEMPTS
  const retryDelayMs = options.retryDelayMs ?? HANDOFF_RETRY_DELAY_MS
  const deadlineAt = now() + (options.deadlineMs ?? HANDOFF_RETRY_DEADLINE_MS)
  const active = () => options.active() && options.signal?.aborted !== true

  for (let attempt = 0; attempt < maxAttempts && active(); attempt += 1) {
    if (now() >= deadlineAt) return false
    try {
      await redeem()
      return active()
    } catch (error) {
      const remainingMs = deadlineAt - now()
      if (!retryable(error) || attempt + 1 >= maxAttempts || remainingMs <= 0 || !active()) {
        return false
      }
      await wait(Math.min(retryDelayMs, remainingMs), options.signal)
    }
  }

  return false
}

function waitFor(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener("abort", finish)
      resolve()
    }
    const timeoutId = setTimeout(finish, delayMs)
    signal?.addEventListener("abort", finish, { once: true })
  })
}
