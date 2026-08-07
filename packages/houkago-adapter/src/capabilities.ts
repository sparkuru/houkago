import type { AdapterCapability, AdapterHello } from "houkago-kousoku"
import {
  BAIDU_ACCOUNT_USER_HELD_CAPABILITY,
  BAIDU_FILES_READ_CAPABILITY,
  BAIDU_MEDIA_HEADERS_CAPABILITY,
  HOUKAGO_ADAPTER_PROTOCOL_VERSION,
} from "houkago-kousoku"
import type { AdapterBrowser } from "houkago-kousoku"

export const ADAPTER_CLIENT_VERSION = "0.1.0"

export function adapterHello(
  browser: AdapterBrowser,
  deviceId: string,
  paired: boolean,
): AdapterHello {
  const capabilities: AdapterCapability[] = [
    capability(BAIDU_ACCOUNT_USER_HELD_CAPABILITY, paired),
    capability(BAIDU_FILES_READ_CAPABILITY, paired),
    capability(BAIDU_MEDIA_HEADERS_CAPABILITY, paired),
  ]
  return {
    protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
    clientVersion: ADAPTER_CLIENT_VERSION,
    browser,
    deviceId,
    capabilities,
  }
}

function capability(id: string, ready: boolean): AdapterCapability {
  return ready
    ? { id, schemaVersion: 1, ready: true }
    : { id, schemaVersion: 1, ready: false, reason: "not-paired" }
}
