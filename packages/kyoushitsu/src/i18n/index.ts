import { DEFAULT_LOCALE, type MessageKey, messages } from "./messages"

const currentMessages = messages[DEFAULT_LOCALE]

export function t(key: MessageKey): string {
  return currentMessages[key]
}

export { DEFAULT_LOCALE }
