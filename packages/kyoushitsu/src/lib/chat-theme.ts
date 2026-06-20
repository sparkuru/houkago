export type ChatTheme = "light" | "dark"

const KEY = "houkago:chat-theme"

function isChatTheme(value: string | null): value is ChatTheme {
  return value === "light" || value === "dark"
}

function systemTheme(): ChatTheme {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function loadChatTheme(): ChatTheme {
  const saved = globalThis.localStorage?.getItem(KEY) ?? null
  return isChatTheme(saved) ? saved : systemTheme()
}

export function saveChatTheme(theme: ChatTheme): void {
  globalThis.localStorage?.setItem(KEY, theme)
}

export function nextChatTheme(theme: ChatTheme): ChatTheme {
  return theme === "dark" ? "light" : "dark"
}
