export const CHROMIUM_PRIVATE_RULE_ID_BASE = 40_000
export const CHROMIUM_PRIVATE_RULE_ID_END = 49_999

const activePrivateRuleIds = new Set<number>()

export function exactChromiumUrlRegex(value: string): string {
  return `^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`
}

export function reserveChromiumPrivateRuleId(): number {
  for (let id = CHROMIUM_PRIVATE_RULE_ID_BASE; id <= CHROMIUM_PRIVATE_RULE_ID_END; id += 1) {
    if (!activePrivateRuleIds.has(id)) {
      activePrivateRuleIds.add(id)
      return id
    }
  }
  throw new Error("Chromium private rule capacity reached")
}

export function releaseChromiumPrivateRuleId(id: number): void {
  activePrivateRuleIds.delete(id)
}

export function isActiveChromiumPrivateRuleId(id: number): boolean {
  return activePrivateRuleIds.has(id)
}

export function isOwnedChromiumPrivateRuleId(id: number): boolean {
  return (
    Number.isInteger(id) &&
    id >= CHROMIUM_PRIVATE_RULE_ID_BASE &&
    id <= CHROMIUM_PRIVATE_RULE_ID_END
  )
}
