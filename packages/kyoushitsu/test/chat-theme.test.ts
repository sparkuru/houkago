import { beforeEach, expect, test } from "bun:test"
import { loadChatTheme, nextChatTheme, saveChatTheme } from "../src/lib/chat-theme"

const mem = new Map<string, string>()

beforeEach(() => {
  mem.clear()
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

test("chat theme follows system preference until saved", () => {
  ;(globalThis as { matchMedia?: (query: string) => { matches: boolean } }).matchMedia = () => ({
    matches: true,
  })

  expect(loadChatTheme()).toBe("dark")
})

test("saved chat theme overrides system preference", () => {
  ;(globalThis as { matchMedia?: (query: string) => { matches: boolean } }).matchMedia = () => ({
    matches: true,
  })
  saveChatTheme("light")

  expect(loadChatTheme()).toBe("light")
})

test("chat theme toggles between light and dark", () => {
  expect(nextChatTheme("light")).toBe("dark")
  expect(nextChatTheme("dark")).toBe("light")
})
