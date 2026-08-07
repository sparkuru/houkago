import type { AdapterMediaGrant } from "../grants"
import { isAllowedSentinelUrl, isApprovedBaiduDownloadUrl } from "../host-policy"
import type { ChromiumBrowser } from "../types"

const RULE_ID_BASE = 20_000

function exactUrlRegex(value: string): string {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
}

export async function installChromiumGrant(
  browserApi: ChromiumBrowser,
  grant: AdapterMediaGrant,
  slot: number,
): Promise<number[]> {
  const redirectRuleId = RULE_ID_BASE + slot * 2
  const headerRuleId = redirectRuleId + 1
  await browserApi.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [redirectRuleId, headerRuleId],
    addRules: [
      {
        id: redirectRuleId,
        priority: 1,
        action: { type: "redirect", redirect: { url: grant.dlink } },
        condition: {
          regexFilter: exactUrlRegex(grant.sentinelUrl),
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
          ],
        },
        condition: {
          regexFilter: exactUrlRegex(grant.dlink),
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
  await browserApi.declarativeNetRequest.updateSessionRules({ removeRuleIds: ruleIds })
}

type Timer = (handler: () => void, delay: number) => unknown
type ClearTimer = (handle: unknown) => void

export class ChromiumGrantPort {
  private nextSlot = 0
  private readonly active = new Map<string, { ids: number[]; timer: unknown }>()

  constructor(
    private readonly browserApi: ChromiumBrowser,
    private readonly timer: Timer = setTimeout,
    private readonly clearTimer: ClearTimer = (handle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>),
  ) {}

  async install(grant: AdapterMediaGrant, now = Date.now()): Promise<number[]> {
    if (grant.expiresAt <= now) throw new Error("grant expired")
    if (!isApprovedBaiduDownloadUrl(grant.dlink)) throw new Error("download host denied")
    if (!isAllowedSentinelUrl(grant.sentinelUrl)) throw new Error("sentinel origin denied")
    const ids = await installChromiumGrant(this.browserApi, grant, this.nextSlot++)
    const timer = this.timer(() => {
      void removeChromiumGrant(this.browserApi, ids).catch(() => {
        console.warn("houkago-adapter: expired Chromium grant cleanup failed")
      })
      this.active.delete(grant.id)
    }, grant.expiresAt - now)
    this.active.set(grant.id, { ids, timer })
    return ids
  }

  async clear(): Promise<void> {
    const removals: Array<Promise<void>> = []
    for (const grant of this.active.values()) {
      this.clearTimer(grant.timer)
      removals.push(removeChromiumGrant(this.browserApi, grant.ids))
    }
    this.active.clear()
    await Promise.allSettled(removals)
  }
}
