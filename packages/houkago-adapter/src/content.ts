import { Value } from "@sinclair/typebox/value"
import {
  type AdapterPageRequest,
  AdapterPageRequestSchema,
  AdapterPageResponseSchema,
  HOUKAGO_ADAPTER_CLIENT_SOURCE,
} from "houkago-kousoku"
import { fingerprintBaiduMedia, mediaFingerprintError } from "./media-fingerprint"
import type { FirefoxBrowser } from "./types"

declare const browser: FirefoxBrowser

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  if (!Value.Check(AdapterPageRequestSchema, event.data)) return
  const request = event.data as AdapterPageRequest
  void browser.runtime.sendMessage(request).then(async (response) => {
    if (!Value.Check(AdapterPageResponseSchema, response)) return
    if (request.type !== "BAIDU_MEDIA_FINGERPRINT" || response.type !== "RESULT") {
      window.postMessage(response, window.location.origin)
      return
    }
    try {
      const data = await fingerprintBaiduMedia(request.grantUrl, request.bytes)
      window.postMessage(
        {
          source: HOUKAGO_ADAPTER_CLIENT_SOURCE,
          protocolVersion: request.protocolVersion,
          nonce: request.nonce,
          type: "BAIDU_MEDIA_FINGERPRINT_RESULT",
          ok: true,
          data,
        },
        window.location.origin,
      )
    } catch {
      window.postMessage(mediaFingerprintError(request.nonce), window.location.origin)
    }
  })
})
