import { beforeEach, expect, test } from "bun:test"
import { loadFileDanmakuEnabled, saveFileDanmakuEnabled } from "../src/lib/file-danmaku-pref"

const mem = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

beforeEach(() => {
  mem.clear()
})

test("file danmaku display defaults off", () => {
  expect(loadFileDanmakuEnabled()).toBe(false)
})

test("file danmaku display preference is remembered", () => {
  saveFileDanmakuEnabled(true)
  expect(loadFileDanmakuEnabled()).toBe(true)

  saveFileDanmakuEnabled(false)
  expect(loadFileDanmakuEnabled()).toBe(false)
})
