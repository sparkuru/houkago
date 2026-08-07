import { Value } from "@sinclair/typebox/value"
import { AdapterPageRequestSchema, AdapterPageResponseSchema } from "houkago-kousoku"
import type { FirefoxBrowser } from "./types"

declare const browser: FirefoxBrowser

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  if (!Value.Check(AdapterPageRequestSchema, event.data)) return
  void browser.runtime.sendMessage(event.data).then((response) => {
    if (!Value.Check(AdapterPageResponseSchema, response)) return
    window.postMessage(response, window.location.origin)
  })
})
