import { isAllowedSentinelUrl, isApprovedBaiduDownloadUrl } from "./host-policy"

export type AdapterMediaGrant = {
  id: string
  tabId: number
  sentinelUrl: string
  dlink: string
  expiresAt: number
}

export class MediaGrantRegistry {
  private readonly grants = new Map<string, AdapterMediaGrant>()
  private readonly requestGrant = new Map<
    string,
    { grantId: string; tabId: number; blocked: boolean }
  >()

  install(grant: AdapterMediaGrant, now = Date.now()): void {
    if (grant.expiresAt <= now) throw new Error("grant expired")
    if (!isApprovedBaiduDownloadUrl(grant.dlink)) throw new Error("download host denied")
    if (!isAllowedSentinelUrl(grant.sentinelUrl)) throw new Error("sentinel origin denied")
    this.grants.set(grant.id, grant)
  }

  redirectFor(url: string, requestId: string, tabId: number, now = Date.now()): string | null {
    this.purge(now)
    const grant = [...this.grants.values()].find(
      (candidate) => candidate.sentinelUrl === url && candidate.tabId === tabId,
    )
    if (!grant) return null
    this.requestGrant.set(requestId, { grantId: grant.id, tabId, blocked: false })
    return grant.dlink
  }

  authorizeRedirect(
    requestId: string,
    tabId: number,
    redirectUrl: string,
    now = Date.now(),
  ): boolean {
    this.purge(now)
    const request = this.requestGrant.get(requestId)
    const grant = request ? this.grants.get(request.grantId) : undefined
    if (
      !grant ||
      request?.tabId !== tabId ||
      request.blocked ||
      !isApprovedBaiduDownloadUrl(redirectUrl)
    ) {
      if (request) request.blocked = true
      return false
    }
    return true
  }

  shouldBlockRedirect(
    requestId: string,
    tabId: number,
    redirectUrl: string,
    now = Date.now(),
  ): boolean {
    this.purge(now)
    const request = this.requestGrant.get(requestId)
    if (!request || request.tabId !== tabId) return false
    return !this.authorizeRedirect(requestId, tabId, redirectUrl, now)
  }

  shouldInjectUserAgent(url: string, requestId: string, tabId: number, now = Date.now()): boolean {
    this.purge(now)
    const request = this.requestGrant.get(requestId)
    if (request) {
      const grant = this.grants.get(request.grantId)
      return (
        !!grant && request.tabId === tabId && !request.blocked && isApprovedBaiduDownloadUrl(url)
      )
    }
    const continuedGrant = [...this.grants.values()].find(
      (grant) => grant.tabId === tabId && grant.dlink === url,
    )
    if (!continuedGrant) return false
    this.requestGrant.set(requestId, { grantId: continuedGrant.id, tabId, blocked: false })
    return true
  }

  shouldCancel(url: string, requestId: string, tabId: number, now = Date.now()): boolean {
    this.purge(now)
    const request = this.requestGrant.get(requestId)
    if (!request || request.tabId !== tabId) return false
    if (request.blocked) return true
    if (!isApprovedBaiduDownloadUrl(url)) {
      request.blocked = true
      return true
    }
    return false
  }

  completeRequest(requestId: string): void {
    this.requestGrant.delete(requestId)
  }

  remove(id: string): void {
    this.grants.delete(id)
    for (const [requestId, request] of this.requestGrant) {
      if (request.grantId === id) this.requestGrant.delete(requestId)
    }
  }

  clear(): void {
    this.grants.clear()
    this.requestGrant.clear()
  }

  purge(now = Date.now()): void {
    for (const [id, grant] of this.grants) {
      if (grant.expiresAt <= now) this.remove(id)
    }
  }
}

export function withBaiduUserAgent(
  headers: Array<{ name: string; value?: string }> = [],
): Array<{ name: string; value?: string }> {
  const next = headers.filter((header) => header.name.toLowerCase() !== "user-agent")
  next.push({ name: "User-Agent", value: "pan.baidu.com" })
  return next
}

export function withBaiduGrantHeaders(
  headers: Array<{ name: string; value?: string }> = [],
): Array<{ name: string; value?: string }> {
  return withBaiduUserAgent(headers.filter((header) => header.name.toLowerCase() !== "referer"))
}
