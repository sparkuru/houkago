import {
  exactChromiumUrlRegex,
  isActiveChromiumPrivateRuleId,
  isOwnedChromiumPrivateRuleId,
} from "../chromium-rules"
import type { AdapterMediaGrant } from "../grants"
import { isAllowedSentinelUrl, isApprovedBaiduDownloadUrl } from "../host-policy"
import type { ChromiumBrowser, ChromiumGrantBrowser, ChromiumSessionRule } from "../types"

export const CHROMIUM_MEDIA_RULE_ID_BASE = 20_000
export const CHROMIUM_MEDIA_RULE_ID_END = 39_999
const REGISTRY_KEY = "baidu.chromium-grants.v1"
const REGISTRY_VERSION = 1

type ChromiumGrantRow = {
  grantId: string
  ruleIds: [number, number]
  tabId: number
  sentinelUrl: string
  dlink: string
  expiresAt: number
}

type Timer = (handler: () => void, delay: number) => unknown
type ClearTimer = (handle: unknown) => void

export async function installChromiumGrant(
  browserApi: ChromiumBrowser,
  grant: AdapterMediaGrant,
  slot: number,
): Promise<number[]> {
  const redirectRuleId = CHROMIUM_MEDIA_RULE_ID_BASE + slot * 2
  const headerRuleId = redirectRuleId + 1
  await browserApi.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [redirectRuleId, headerRuleId],
    addRules: [
      {
        id: redirectRuleId,
        priority: 1,
        action: { type: "redirect", redirect: { url: grant.dlink } },
        condition: {
          regexFilter: exactChromiumUrlRegex(grant.sentinelUrl),
          isUrlFilterCaseSensitive: true,
          tabIds: [grant.tabId],
          resourceTypes: ["media", "xmlhttprequest"],
        },
      },
      {
        id: headerRuleId,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "user-agent", operation: "set", value: "pan.baidu.com" },
            { header: "referer", operation: "remove" },
            { header: "cache-control", operation: "set", value: "no-cache" },
          ],
          responseHeaders: [{ header: "cache-control", operation: "set", value: "no-store" }],
        },
        condition: {
          regexFilter: exactChromiumUrlRegex(grant.dlink),
          isUrlFilterCaseSensitive: true,
          tabIds: [grant.tabId],
          resourceTypes: ["media", "xmlhttprequest"],
        },
      },
    ],
  })
  return [redirectRuleId, headerRuleId]
}

export async function removeChromiumGrant(
  browserApi: ChromiumBrowser,
  ruleIds: number[],
): Promise<void> {
  if (ruleIds.length === 0) return
  await browserApi.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds })
}

export class ChromiumGrantPort {
  private tail = Promise.resolve()
  private readonly active = new Map<
    string,
    { ids: [number, number]; expiresAt: number; timer: unknown }
  >()

  constructor(
    private readonly browserApi: ChromiumGrantBrowser,
    private readonly timer: Timer = (handler, delay) => setTimeout(handler, delay),
    private readonly clearTimer: ClearTimer = (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
    private readonly clock: () => number = Date.now,
  ) {}

  async install(grant: AdapterMediaGrant, now?: number): Promise<number[]> {
    const requestedAt = now ?? this.clock()
    if (grant.expiresAt <= requestedAt) throw new Error("grant expired")
    if (!isApprovedBaiduDownloadUrl(grant.dlink)) throw new Error("download host denied")
    if (!isAllowedSentinelUrl(grant.sentinelUrl)) throw new Error("sentinel origin denied")
    return this.exclusive(async () => {
      const currentNow = now ?? this.clock()
      if (grant.expiresAt <= currentNow) throw new Error("grant expired")
      let rows = await this.reconcileInternal(currentNow)
      const existing = rows.find((row) => row.grantId === grant.id)
      if (existing && rowMatchesGrant(existing, grant)) {
        this.schedule(existing, currentNow)
        return existing.ruleIds
      }
      if (existing) {
        await this.removeRow(rows, existing)
        rows = rows.filter((candidate) => candidate !== existing)
      }

      const liveRules = await this.browserApi.declarativeNetRequest.getSessionRules()
      const ids = allocateRuleIds(liveRules)
      const slot = (ids[0] - CHROMIUM_MEDIA_RULE_ID_BASE) / 2
      const row: ChromiumGrantRow = {
        grantId: grant.id,
        ruleIds: ids,
        tabId: grant.tabId,
        sentinelUrl: grant.sentinelUrl,
        dlink: grant.dlink,
        expiresAt: grant.expiresAt,
      }
      try {
        await installChromiumGrant(this.browserApi, grant, slot)
        await writeRegistry(this.browserApi, [...rows, row])
      } catch (error) {
        await Promise.allSettled([
          removeChromiumGrant(this.browserApi, ids),
          writeRegistry(
            this.browserApi,
            rows.filter((candidate) => candidate.grantId !== grant.id),
          ),
        ])
        throw error
      }
      this.schedule(row, currentNow)
      return ids
    })
  }

  async reconcile(now?: number): Promise<void> {
    await this.exclusive(async () => {
      await this.reconcileInternal(now ?? this.clock())
    })
  }

  async clear(): Promise<void> {
    await this.exclusive(async () => {
      this.clearScheduled()
      const rules = await this.browserApi.declarativeNetRequest.getSessionRules()
      await removeChromiumGrant(
        this.browserApi,
        rules
          .filter((rule) => isOwnedMediaRuleId(rule.id) || isOwnedChromiumPrivateRuleId(rule.id))
          .map((rule) => rule.id),
      )
      await this.browserApi.storage.session.remove(REGISTRY_KEY)
    })
  }

  private async reconcileInternal(now: number): Promise<ChromiumGrantRow[]> {
    const [stored, liveRules] = await Promise.all([
      this.browserApi.storage.session.get(REGISTRY_KEY),
      this.browserApi.declarativeNetRequest.getSessionRules(),
    ])
    const parsed = parseRegistry(stored[REGISTRY_KEY])
    const liveById = new Map(liveRules.map((rule) => [rule.id, rule]))
    const idCounts = new Map<number, number>()
    const grantCounts = new Map<string, number>()
    for (const row of parsed.rows) {
      grantCounts.set(row.grantId, (grantCounts.get(row.grantId) ?? 0) + 1)
      for (const id of row.ruleIds) idCounts.set(id, (idCounts.get(id) ?? 0) + 1)
    }
    const rows = parsed.rows.filter((row) => {
      if (row.expiresAt <= now) return false
      if (grantCounts.get(row.grantId) !== 1) return false
      if (row.ruleIds.some((id) => idCounts.get(id) !== 1)) return false
      return expectedRules(row).every((expected) => {
        const live = liveById.get(expected.id)
        return live !== undefined && sameJsonValue(live, expected)
      })
    })
    const retainedIds = new Set(rows.flatMap((row) => row.ruleIds))
    const removeRuleIds = liveRules
      .filter(
        (rule) =>
          (isOwnedMediaRuleId(rule.id) && !retainedIds.has(rule.id)) ||
          (isOwnedChromiumPrivateRuleId(rule.id) && !isActiveChromiumPrivateRuleId(rule.id)),
      )
      .map((rule) => rule.id)
    if (removeRuleIds.length > 0) await removeChromiumGrant(this.browserApi, removeRuleIds)
    if (parsed.changed || rows.length !== parsed.rows.length || removeRuleIds.length > 0) {
      await writeRegistry(this.browserApi, rows)
    }
    this.clearScheduled()
    for (const row of rows) this.schedule(row, now)
    return rows
  }

  private async removeRow(rows: ChromiumGrantRow[], row: ChromiumGrantRow): Promise<void> {
    const active = this.active.get(row.grantId)
    if (active) this.clearTimer(active.timer)
    this.active.delete(row.grantId)
    await removeChromiumGrant(this.browserApi, row.ruleIds)
    await writeRegistry(
      this.browserApi,
      rows.filter((candidate) => candidate !== row),
    )
  }

  private schedule(row: ChromiumGrantRow, now: number): void {
    const current = this.active.get(row.grantId)
    if (
      current &&
      current.expiresAt === row.expiresAt &&
      current.ids[0] === row.ruleIds[0] &&
      current.ids[1] === row.ruleIds[1]
    ) {
      return
    }
    if (current) this.clearTimer(current.timer)
    const timer = this.timer(
      () => {
        void this.expire(row.grantId, row.ruleIds).catch(() => {
          console.warn("houkago-adapter: expired Chromium grant cleanup failed")
        })
      },
      Math.max(0, row.expiresAt - now),
    )
    this.active.set(row.grantId, { ids: row.ruleIds, expiresAt: row.expiresAt, timer })
  }

  private async expire(grantId: string, ids: [number, number]): Promise<void> {
    await this.exclusive(async () => {
      const stored = await this.browserApi.storage.session.get(REGISTRY_KEY)
      const rows = parseRegistry(stored[REGISTRY_KEY]).rows
      const row = rows.find(
        (candidate) =>
          candidate.grantId === grantId &&
          candidate.ruleIds[0] === ids[0] &&
          candidate.ruleIds[1] === ids[1],
      )
      if (!row) return
      await removeChromiumGrant(this.browserApi, row.ruleIds)
      await writeRegistry(
        this.browserApi,
        rows.filter((candidate) => candidate !== row),
      )
      this.active.delete(grantId)
    })
  }

  private clearScheduled(): void {
    for (const grant of this.active.values()) this.clearTimer(grant.timer)
    this.active.clear()
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.tail
    let release = () => {}
    this.tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }
}

function expectedRules(row: ChromiumGrantRow): ChromiumSessionRule[] {
  return grantRules(
    {
      id: row.grantId,
      tabId: row.tabId,
      sentinelUrl: row.sentinelUrl,
      dlink: row.dlink,
      expiresAt: row.expiresAt,
    },
    row.ruleIds,
  )
}

function grantRules(grant: AdapterMediaGrant, ids: [number, number]): ChromiumSessionRule[] {
  return [
    {
      id: ids[0],
      priority: 1,
      action: { type: "redirect", redirect: { url: grant.dlink } },
      condition: {
        regexFilter: exactChromiumUrlRegex(grant.sentinelUrl),
        isUrlFilterCaseSensitive: true,
        tabIds: [grant.tabId],
        resourceTypes: ["media", "xmlhttprequest"],
      },
    },
    {
      id: ids[1],
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          { header: "user-agent", operation: "set", value: "pan.baidu.com" },
          { header: "referer", operation: "remove" },
          { header: "cache-control", operation: "set", value: "no-cache" },
        ],
        responseHeaders: [{ header: "cache-control", operation: "set", value: "no-store" }],
      },
      condition: {
        regexFilter: exactChromiumUrlRegex(grant.dlink),
        isUrlFilterCaseSensitive: true,
        tabIds: [grant.tabId],
        resourceTypes: ["media", "xmlhttprequest"],
      },
    },
  ]
}

function allocateRuleIds(rules: ChromiumSessionRule[]): [number, number] {
  const occupied = new Set(rules.map((rule) => rule.id))
  for (let id = CHROMIUM_MEDIA_RULE_ID_BASE; id < CHROMIUM_MEDIA_RULE_ID_END; id += 2) {
    if (!occupied.has(id) && !occupied.has(id + 1)) return [id, id + 1]
  }
  throw new Error("Chromium grant rule capacity reached")
}

function isOwnedMediaRuleId(id: number): boolean {
  return (
    Number.isInteger(id) && id >= CHROMIUM_MEDIA_RULE_ID_BASE && id <= CHROMIUM_MEDIA_RULE_ID_END
  )
}

function rowMatchesGrant(row: ChromiumGrantRow, grant: AdapterMediaGrant): boolean {
  return (
    row.grantId === grant.id &&
    row.tabId === grant.tabId &&
    row.sentinelUrl === grant.sentinelUrl &&
    row.dlink === grant.dlink &&
    row.expiresAt === grant.expiresAt
  )
}

function parseRegistry(value: unknown): { rows: ChromiumGrantRow[]; changed: boolean } {
  if (!isRecord(value) || value.version !== REGISTRY_VERSION || !Array.isArray(value.grants)) {
    return { rows: [], changed: value !== undefined }
  }
  const rows = value.grants.map(parseRow).filter((row) => row !== null)
  return {
    rows,
    changed:
      rows.length === 0 ||
      rows.length !== value.grants.length ||
      Object.keys(value).some((key) => key !== "version" && key !== "grants"),
  }
}

function parseRow(value: unknown): ChromiumGrantRow | null {
  if (!isRecord(value)) return null
  const keys = ["grantId", "ruleIds", "tabId", "sentinelUrl", "dlink", "expiresAt"]
  if (Object.keys(value).some((key) => !keys.includes(key))) return null
  if (typeof value.grantId !== "string" || value.grantId.length === 0) return null
  if (!Array.isArray(value.ruleIds) || value.ruleIds.length !== 2) return null
  const [redirectRuleId, headerRuleId] = value.ruleIds
  if (
    typeof redirectRuleId !== "number" ||
    typeof headerRuleId !== "number" ||
    !isOwnedMediaRuleId(redirectRuleId) ||
    !isOwnedMediaRuleId(headerRuleId) ||
    redirectRuleId % 2 !== 0 ||
    headerRuleId !== redirectRuleId + 1
  ) {
    return null
  }
  if (typeof value.tabId !== "number" || !Number.isInteger(value.tabId) || value.tabId < 0) {
    return null
  }
  if (typeof value.sentinelUrl !== "string" || !isAllowedSentinelUrl(value.sentinelUrl)) {
    return null
  }
  if (typeof value.dlink !== "string" || !isApprovedBaiduDownloadUrl(value.dlink)) return null
  if (typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt)) return null
  return {
    grantId: value.grantId,
    ruleIds: [redirectRuleId, headerRuleId],
    tabId: value.tabId,
    sentinelUrl: value.sentinelUrl,
    dlink: value.dlink,
    expiresAt: value.expiresAt,
  }
}

async function writeRegistry(
  browserApi: ChromiumGrantBrowser,
  rows: ChromiumGrantRow[],
): Promise<void> {
  if (rows.length === 0) {
    await browserApi.storage.session.remove(REGISTRY_KEY)
    return
  }
  await browserApi.storage.session.set({
    [REGISTRY_KEY]: { version: REGISTRY_VERSION, grants: rows },
  })
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameJsonValue(value, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && sameJsonValue(left[key], right[key]))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
