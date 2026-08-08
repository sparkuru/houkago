import { chromiumDlinkResolver } from "../dlink-exchange"
import { ChromiumGrantPort } from "../network/chromium"
import { installChromiumPolling } from "../polling"
import { createAdapterRuntime } from "../runtime"
import type {
  AdapterStorage,
  ChromiumAlarms,
  ChromiumBrowser,
  ChromiumDlinkBrowser,
  ChromiumGrantBrowser,
} from "../types"

declare const chrome: ChromiumBrowser &
  ChromiumDlinkBrowser & {
    declarativeNetRequest: ChromiumGrantBrowser["declarativeNetRequest"]
    runtime: {
      onMessage: {
        addListener(
          listener: (
            message: unknown,
            sender: { url?: string; tab?: { id?: number } },
            sendResponse: (response: unknown) => void,
          ) => boolean,
        ): void
      }
    }
    storage: {
      local: {
        get(key: string): Promise<Record<string, unknown>>
        set(values: Record<string, unknown>): Promise<void>
        remove(key: string): Promise<void>
      }
      session: ChromiumGrantBrowser["storage"]["session"]
    }
    permissions: {
      contains(permissions: { origins: string[] }): Promise<boolean>
      request(permissions: { origins: string[] }): Promise<boolean>
    }
    alarms: ChromiumAlarms
  }

const storage: AdapterStorage = {
  async get<T>(key: string): Promise<T | undefined> {
    return (await chrome.storage.local.get(key))[key] as T | undefined
  },
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },
  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },
}
const grants = new ChromiumGrantPort(chrome)
const runtime = createAdapterRuntime({
  browser: "chromium",
  storage,
  async requestServerOrigin(pattern) {
    if (await chrome.permissions.contains({ origins: [pattern] })) return true
    return chrome.permissions.request({ origins: [pattern] })
  },
  onPaired() {},
  async installGrant(grant) {
    await grants.install(grant)
  },
  async revokeGrants() {
    await grants.clear()
  },
  resolveDlink: chromiumDlinkResolver(chrome),
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void runtime.handle(message, sender.url, sender.tab?.id).then(sendResponse)
  return true
})

installChromiumPolling(chrome.alarms, runtime, console.warn, () => grants.reconcile())
