import type { BaiduFileEntry } from "houkago-kousoku"

export class BaiduSelectionRegistry {
  private readonly listedVideoHandles = new Set<string>()

  record(entries: BaiduFileEntry[]): void {
    for (const entry of entries) {
      if (!entry.isDirectory && entry.mediaType === "video") this.listedVideoHandles.add(entry.id)
    }
  }

  consume(upstreamHandle: string): boolean {
    return this.listedVideoHandles.delete(upstreamHandle)
  }

  clear(): void {
    this.listedVideoHandles.clear()
  }
}
