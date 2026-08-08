import { expect, test } from "bun:test"
import {
  CHROMIUM_PRIVATE_RULE_ID_BASE,
  releaseChromiumPrivateRuleId,
  reserveChromiumPrivateRuleId,
} from "../src/chromium-rules"
import { CHROMIUM_MEDIA_RULE_ID_BASE, ChromiumGrantPort } from "../src/network/chromium"
import type { ChromiumGrantBrowser, ChromiumSessionRule } from "../src/types"

const registryKey = "baidu.chromium-grants.v1"
const grant = {
  id: "grant-1",
  tabId: 7,
  sentinelUrl: "https://houkago.example/baidu/media/capability",
  dlink: "https://d.pcs.baidu.com/file?cap=1",
  expiresAt: 10_000,
}

test("a valid session registry survives a worker restart and remains idempotent", async () => {
  const harness = chromiumHarness()
  const first = new ChromiumGrantPort(harness.browser, () => ({ worker: 1 }))
  const ids = await first.install(grant, 1_000)
  const updateCount = harness.updates.length

  const scheduled: number[] = []
  const restarted = new ChromiumGrantPort(harness.browser, (_handler, delay) => {
    scheduled.push(delay)
  })
  await restarted.reconcile(2_000)
  expect(harness.updates).toHaveLength(updateCount)
  expect(scheduled).toEqual([8_000])
  expect(await restarted.install(grant, 2_000)).toEqual(ids)
  expect(harness.updates).toHaveLength(updateCount)
})

test("reconciliation removes expired, orphaned, and structurally altered owned rules", async () => {
  const harness = chromiumHarness()
  const port = new ChromiumGrantPort(harness.browser, () => ({}))
  const ids = await port.install(grant, 1_000)
  const headerRule = harness.rules.get(ids[1] ?? -1)
  if (!headerRule) throw new Error("test header rule missing")
  harness.rules.set(ids[1] ?? -1, {
    ...headerRule,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "user-agent", operation: "set", value: "pan.baidu.com" },
        { header: "referer", operation: "remove" },
      ],
      responseHeaders: [{ header: "cache-control", operation: "set", value: "no-store" }],
    },
  })
  harness.rules.set(CHROMIUM_MEDIA_RULE_ID_BASE + 10, {
    id: CHROMIUM_MEDIA_RULE_ID_BASE + 10,
    priority: 1,
    action: { type: "redirect", redirect: { url: grant.dlink } },
    condition: { regexFilter: "^https://ordinary.example/$" },
  })

  await new ChromiumGrantPort(harness.browser, () => ({})).reconcile(2_000)
  expect([...harness.rules.keys()]).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
  expect(harness.updates.at(-1)?.removeRuleIds.sort((a, b) => a - b)).toEqual([
    ...ids,
    CHROMIUM_MEDIA_RULE_ID_BASE + 10,
  ])

  await port.install({ ...grant, id: "expired" }, 1_000)
  await new ChromiumGrantPort(harness.browser, () => ({})).reconcile(10_001)
  expect([...harness.rules.keys()]).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
})

test("duplicate registry ownership fails closed and removes the shared rules", async () => {
  const harness = chromiumHarness()
  const port = new ChromiumGrantPort(harness.browser, () => ({}))
  const ids = await port.install(grant, 1_000)
  const row = {
    grantId: grant.id,
    ruleIds: ids,
    tabId: grant.tabId,
    sentinelUrl: grant.sentinelUrl,
    dlink: grant.dlink,
    expiresAt: grant.expiresAt,
  }
  harness.values.set(registryKey, { version: 1, grants: [row, { ...row, grantId: "other" }] })

  await new ChromiumGrantPort(harness.browser, () => ({})).reconcile(2_000)
  expect([...harness.rules.keys()]).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
})

test("duplicate grant identities and foreign session rules cannot become Houkago authority", async () => {
  const harness = chromiumHarness()
  const port = new ChromiumGrantPort(harness.browser, () => ({}))
  const firstIds = await port.install(grant, 1_000)
  const secondGrant = {
    ...grant,
    id: "grant-2",
    sentinelUrl: "https://houkago.example/baidu/media/second",
    dlink: "https://d.pcs.baidu.com/file?cap=2",
  }
  const secondIds = await port.install(secondGrant, 1_000)
  harness.values.set(registryKey, {
    version: 1,
    grants: [
      {
        grantId: grant.id,
        ruleIds: firstIds,
        tabId: grant.tabId,
        sentinelUrl: grant.sentinelUrl,
        dlink: grant.dlink,
        expiresAt: grant.expiresAt,
      },
      {
        grantId: grant.id,
        ruleIds: secondIds,
        tabId: secondGrant.tabId,
        sentinelUrl: secondGrant.sentinelUrl,
        dlink: secondGrant.dlink,
        expiresAt: secondGrant.expiresAt,
      },
    ],
  })
  harness.rules.set(999, {
    id: 999,
    priority: 1,
    action: { type: "block" },
    condition: { regexFilter: "^https://ordinary.example/$" },
  })

  const restarted = new ChromiumGrantPort(harness.browser, () => ({}))
  await restarted.reconcile(2_000)
  expect([...harness.rules.keys()]).toEqual([999])
  expect(harness.values.has(registryKey)).toBe(false)
  await restarted.clear()
  expect([...harness.rules.keys()]).toEqual([999])
})

test("strict registry parsing removes malformed owned rows without touching adjacent rules", async () => {
  const harness = chromiumHarness()
  const port = new ChromiumGrantPort(harness.browser, () => ({}))
  const ids = await port.install(grant, 1_000)
  const stored = harness.values.get(registryKey)
  if (!isRecord(stored) || !Array.isArray(stored.grants)) {
    throw new Error("test registry missing")
  }
  const row = stored.grants[0]
  if (!isRecord(row)) throw new Error("test registry row missing")
  harness.values.set(registryKey, {
    version: 1,
    grants: [{ ...row, unexpected: grant.dlink }],
  })
  harness.rules.set(CHROMIUM_MEDIA_RULE_ID_BASE - 1, { id: CHROMIUM_MEDIA_RULE_ID_BASE - 1 })
  harness.rules.set(CHROMIUM_PRIVATE_RULE_ID_BASE + 10_000, {
    id: CHROMIUM_PRIVATE_RULE_ID_BASE + 10_000,
  })

  await new ChromiumGrantPort(harness.browser, () => ({})).reconcile(2_000)
  expect([...harness.rules.keys()]).toEqual([
    CHROMIUM_MEDIA_RULE_ID_BASE - 1,
    CHROMIUM_PRIVATE_RULE_ID_BASE + 10_000,
  ])
  expect(ids.every((id) => !harness.rules.has(id))).toBe(true)
  expect(harness.values.has(registryKey)).toBe(false)
})

test("reconciliation removes an empty registry without treating foreign rules as owned", async () => {
  const harness = chromiumHarness()
  harness.values.set(registryKey, { version: 1, grants: [] })
  harness.rules.set(CHROMIUM_MEDIA_RULE_ID_BASE - 1, { id: CHROMIUM_MEDIA_RULE_ID_BASE - 1 })

  await new ChromiumGrantPort(harness.browser, () => ({})).reconcile(2_000)
  expect(harness.values.has(registryKey)).toBe(false)
  expect([...harness.rules.keys()]).toEqual([CHROMIUM_MEDIA_RULE_ID_BASE - 1])
})

test("reconciliation preserves an in-flight private HEAD rule and removes it once orphaned", async () => {
  const harness = chromiumHarness()
  const ruleId = reserveChromiumPrivateRuleId()
  expect(ruleId).toBe(CHROMIUM_PRIVATE_RULE_ID_BASE)
  harness.rules.set(ruleId, {
    id: ruleId,
    priority: 2,
    action: { type: "modifyHeaders" },
    condition: { regexFilter: "^https://d\\.pcs\\.baidu\\.com/private$" },
  })
  const port = new ChromiumGrantPort(harness.browser, () => ({}))

  await port.reconcile(1_000)
  expect(harness.rules.has(ruleId)).toBe(true)
  releaseChromiumPrivateRuleId(ruleId)
  await port.reconcile(1_000)
  expect(harness.rules.has(ruleId)).toBe(false)
})

test("a rejected registry write rolls back every DNR rule from the attempt", async () => {
  const harness = chromiumHarness()
  harness.failNextStorageSet = true
  const port = new ChromiumGrantPort(harness.browser, () => ({}))

  await expect(port.install(grant, 1_000)).rejects.toThrow("storage.session rejected")
  expect([...harness.rules.keys()]).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
  expect(harness.updates.at(-1)?.removeRuleIds).toEqual([
    CHROMIUM_MEDIA_RULE_ID_BASE,
    CHROMIUM_MEDIA_RULE_ID_BASE + 1,
  ])
})

test("a partial DNR failure is rolled back without persisting authority", async () => {
  const harness = chromiumHarness()
  harness.failNextRuleInstallPartially = true
  const port = new ChromiumGrantPort(harness.browser, () => ({}))

  await expect(port.install(grant, 1_000)).rejects.toThrow("DNR quota rejected")
  expect([...harness.rules.keys()]).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
})

test("a queued install rechecks logical expiry after it acquires ownership", async () => {
  const harness = chromiumHarness()
  const times = [1_000, grant.expiresAt + 1]
  const port = new ChromiumGrantPort(
    harness.browser,
    () => ({}),
    () => {},
    () => times.shift() ?? grant.expiresAt + 1,
  )

  await expect(port.install(grant)).rejects.toThrow("grant expired")
  expect(harness.updates).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
})

test("failed replacement cleanup retains the old row for a later reconciliation", async () => {
  const harness = chromiumHarness()
  const port = new ChromiumGrantPort(harness.browser, () => ({}))
  const ids = await port.install(grant, 1_000)
  harness.failNextRuleRemoval = true

  await expect(
    port.install(
      {
        ...grant,
        dlink: "https://d.pcs.baidu.com/file?cap=replacement",
      },
      2_000,
    ),
  ).rejects.toThrow("DNR removal rejected")
  expect(ids.every((id) => harness.rules.has(id))).toBe(true)
  expect(JSON.stringify(harness.values.get(registryKey))).toContain(grant.dlink)
  expect(JSON.stringify(harness.values.get(registryKey))).not.toContain("cap=replacement")

  await new ChromiumGrantPort(harness.browser, () => ({})).reconcile(2_000)
  expect(ids.every((id) => harness.rules.has(id))).toBe(true)
})

test("failed revoke keeps durable state until a later worker wake can clean it", async () => {
  const harness = chromiumHarness()
  const port = new ChromiumGrantPort(harness.browser, () => ({}))
  const ids = await port.install(grant, 1_000)
  harness.failNextRuleRemoval = true

  await expect(port.clear()).rejects.toThrow("DNR removal rejected")
  expect(ids.every((id) => harness.rules.has(id))).toBe(true)
  expect(harness.values.has(registryKey)).toBe(true)

  const restarted = new ChromiumGrantPort(harness.browser, () => ({}))
  await restarted.clear()
  expect([...harness.rules.keys()]).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
})

test("concurrent installs reserve distinct rule pairs and restart-safe revoke is idempotent", async () => {
  const harness = chromiumHarness()
  const port = new ChromiumGrantPort(harness.browser, () => ({}))
  const [firstIds, secondIds] = await Promise.all([
    port.install(grant, 1_000),
    port.install(
      {
        ...grant,
        id: "grant-2",
        sentinelUrl: "https://houkago.example/baidu/media/second",
        dlink: "https://d.pcs.baidu.com/file?cap=2",
      },
      1_000,
    ),
  ])
  expect(firstIds).toEqual([CHROMIUM_MEDIA_RULE_ID_BASE, CHROMIUM_MEDIA_RULE_ID_BASE + 1])
  expect(secondIds).toEqual([CHROMIUM_MEDIA_RULE_ID_BASE + 2, CHROMIUM_MEDIA_RULE_ID_BASE + 3])

  const restarted = new ChromiumGrantPort(harness.browser, () => ({}))
  await restarted.clear()
  await restarted.clear()
  expect([...harness.rules.keys()]).toEqual([])
  expect(harness.values.has(registryKey)).toBe(false)
})

type RuleUpdate = {
  removeRuleIds: number[]
  addRules?: Array<Record<string, unknown>>
}

function chromiumHarness(): {
  browser: ChromiumGrantBrowser
  rules: Map<number, ChromiumSessionRule>
  values: Map<string, unknown>
  updates: RuleUpdate[]
  failNextStorageSet: boolean
  failNextRuleInstallPartially: boolean
  failNextRuleRemoval: boolean
} {
  const harness = {
    rules: new Map<number, ChromiumSessionRule>(),
    values: new Map<string, unknown>(),
    updates: [] as RuleUpdate[],
    failNextStorageSet: false,
    failNextRuleInstallPartially: false,
    failNextRuleRemoval: false,
  }
  const browser: ChromiumGrantBrowser = {
    declarativeNetRequest: {
      async getSessionRules() {
        return [...harness.rules.values()]
      },
      async updateSessionRules(update) {
        harness.updates.push(update)
        if (harness.failNextRuleRemoval && !update.addRules?.length) {
          harness.failNextRuleRemoval = false
          throw new Error("DNR removal rejected")
        }
        for (const id of update.removeRuleIds) harness.rules.delete(id)
        if (harness.failNextRuleInstallPartially && update.addRules?.length) {
          harness.failNextRuleInstallPartially = false
          const first = update.addRules[0]
          if (typeof first?.id !== "number") throw new Error("test rule id missing")
          harness.rules.set(first.id, { ...first, id: first.id })
          throw new Error("DNR quota rejected")
        }
        for (const rule of update.addRules ?? []) {
          if (typeof rule.id !== "number") throw new Error("test rule id missing")
          harness.rules.set(rule.id, { ...rule, id: rule.id })
        }
      },
    },
    storage: {
      session: {
        async get(key) {
          return harness.values.has(key) ? { [key]: harness.values.get(key) } : {}
        },
        async set(next) {
          if (harness.failNextStorageSet) {
            harness.failNextStorageSet = false
            throw new Error("storage.session rejected")
          }
          for (const [key, value] of Object.entries(next)) harness.values.set(key, value)
        },
        async remove(key) {
          harness.values.delete(key)
        },
      },
    },
  }
  return {
    browser,
    rules: harness.rules,
    values: harness.values,
    updates: harness.updates,
    get failNextStorageSet() {
      return harness.failNextStorageSet
    },
    set failNextStorageSet(value: boolean) {
      harness.failNextStorageSet = value
    },
    get failNextRuleInstallPartially() {
      return harness.failNextRuleInstallPartially
    },
    set failNextRuleInstallPartially(value: boolean) {
      harness.failNextRuleInstallPartially = value
    },
    get failNextRuleRemoval() {
      return harness.failNextRuleRemoval
    },
    set failNextRuleRemoval(value: boolean) {
      harness.failNextRuleRemoval = value
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
