import type { AdapterStorage, FirefoxBrowser } from "./types"

export function browserStorage(browserApi: FirefoxBrowser): AdapterStorage {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const values = await browserApi.storage.local.get(key)
      return values[key] as T | undefined
    },
    async set<T>(key: string, value: T): Promise<void> {
      await browserApi.storage.local.set({ [key]: value })
    },
    async remove(key: string): Promise<void> {
      await browserApi.storage.local.remove(key)
    },
  }
}
