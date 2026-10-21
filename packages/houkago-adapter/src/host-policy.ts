export { isApprovedBaiduDlinkCapability as isApprovedBaiduDownloadUrl } from "houkago-eisha/baidu"

export function extensionOriginPattern(value: string): string {
  const url = new URL(value)
  return `${url.protocol}//${url.hostname}/*`
}

declare const __HOUKAGO_ADAPTER_PAGE_ORIGIN__: string | undefined
declare const __HOUKAGO_ADAPTER_SERVER_ORIGIN__: string | undefined

export function configuredPageOrigin(): string | undefined {
  return typeof __HOUKAGO_ADAPTER_PAGE_ORIGIN__ === "string"
    ? __HOUKAGO_ADAPTER_PAGE_ORIGIN__
    : undefined
}

export function configuredServerOrigin(): string | undefined {
  return typeof __HOUKAGO_ADAPTER_SERVER_ORIGIN__ === "string"
    ? __HOUKAGO_ADAPTER_SERVER_ORIGIN__
    : undefined
}

export function isAllowedPageOrigin(
  value: string,
  expectedPageOrigin = configuredPageOrigin(),
): boolean {
  try {
    const url = new URL(value)
    if (expectedPageOrigin) return url.origin === expectedPageOrigin
    return isHttpProtocol(url.protocol)
  } catch {
    return false
  }
}

export function validatedServerBase(
  value: string,
  pageOrigin: string,
  expectedPageOrigin = configuredPageOrigin(),
  expectedServerOrigin = configuredServerOrigin(),
): string | null {
  try {
    const server = new URL(value)
    const page = new URL(pageOrigin)
    if (
      !isHttpProtocol(server.protocol) ||
      server.username ||
      server.password ||
      server.search ||
      server.hash ||
      (value !== `${server.origin}/api` && value !== `${server.origin}/api/`)
    )
      return null
    if (expectedPageOrigin || expectedServerOrigin) {
      if (!expectedPageOrigin || !expectedServerOrigin) return null
      if (!isAllowedPageOrigin(page.origin, expectedPageOrigin)) return null
      if (server.origin !== expectedServerOrigin) return null
      return `${server.origin}/api`
    }
    if (!isHttpProtocol(page.protocol) || !isHttpProtocol(server.protocol)) return null
    return `${server.origin}/api`
  } catch {
    return null
  }
}

export function isAllowedSentinelUrl(
  value: string,
  expectedServerOrigin = configuredServerOrigin(),
): boolean {
  try {
    const url = new URL(value)
    if (
      !isHttpProtocol(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      !/^\/api\/baidu\/media\/[^/]+$/.test(url.pathname)
    )
      return false
    if (expectedServerOrigin) return url.origin === expectedServerOrigin
    return true
  } catch {
    return false
  }
}

function isHttpProtocol(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:"
}
