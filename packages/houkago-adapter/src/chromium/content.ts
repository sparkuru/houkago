import { Value } from "@sinclair/typebox/value"
import { AdapterPageRequestSchema, AdapterPageResponseSchema } from "houkago-kousoku"

declare const chrome: {
  runtime: {
    sendMessage(message: unknown, callback: (response: unknown) => void): void
  }
}

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  if (!Value.Check(AdapterPageRequestSchema, event.data)) return
  chrome.runtime.sendMessage(event.data, (response) => {
    if (!Value.Check(AdapterPageResponseSchema, response)) return
    window.postMessage(response, window.location.origin)
  })
})
