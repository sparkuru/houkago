import type { AdapterStorage } from "./types"

export type BaiduPermit = {
  sourceId: string
  bushitsuId: string
  upstreamHandle: string
}

const PERMITS_KEY = "baidu.permits"

export class BaiduPermitStore {
  constructor(private readonly storage: AdapterStorage) {}

  async permit(value: BaiduPermit): Promise<void> {
    const permits = await this.all()
    const key = permitKey(value.sourceId, value.bushitsuId)
    permits[key] = value
    await this.storage.set(PERMITS_KEY, permits)
  }

  async permitted(sourceId: string, bushitsuId: string): Promise<BaiduPermit | null> {
    const permits = await this.all()
    return permits[permitKey(sourceId, bushitsuId)] ?? null
  }

  async revokeAll(): Promise<void> {
    await this.storage.remove(PERMITS_KEY)
  }

  private async all(): Promise<Record<string, BaiduPermit>> {
    const value = await this.storage.get<unknown>(PERMITS_KEY)
    if (!value || typeof value !== "object" || Array.isArray(value)) return {}
    const permits: Record<string, BaiduPermit> = {}
    for (const [key, permit] of Object.entries(value)) {
      if (isPermit(permit) && key === permitKey(permit.sourceId, permit.bushitsuId)) {
        permits[key] = permit
      }
    }
    return permits
  }
}

function isPermit(value: unknown): value is BaiduPermit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const permit = value as Record<string, unknown>
  return (
    typeof permit.sourceId === "string" &&
    permit.sourceId.length > 0 &&
    typeof permit.bushitsuId === "string" &&
    permit.bushitsuId.length > 0 &&
    typeof permit.upstreamHandle === "string" &&
    permit.upstreamHandle.length > 0 &&
    Object.keys(permit).every((key) => ["sourceId", "bushitsuId", "upstreamHandle"].includes(key))
  )
}

function permitKey(sourceId: string, bushitsuId: string): string {
  return `${bushitsuId}:${sourceId}`
}
