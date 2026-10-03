import { Value } from "@sinclair/typebox/value"
import {
  type AdapterHello,
  type AdapterPageRequest,
  AdapterPageRequestSchema,
  type AdapterPageResponse,
  AdapterPageResponseSchema,
  BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
  type BaiduDirectoryPage,
  type BaiduMediaFingerprint,
  HOUKAGO_ADAPTER_PAGE_SOURCE,
  HOUKAGO_ADAPTER_PROTOCOL_VERSION,
} from "houkago-kousoku"

const HELLO_TIMEOUT_MS = 700
const REQUEST_TIMEOUT_MS = 10_000

type AdapterResponseType = AdapterPageResponse["type"]

type PendingRequest = {
  expectedType: AdapterResponseType
  resolve: (response: AdapterPageResponse) => void
  reject: (error: AdapterBridgeError) => void
  timeoutId: ReturnType<typeof setTimeout>
}

export class AdapterBridgeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "AdapterBridgeError"
  }
}

export function adapterMessageMatchesContext(
  source: unknown,
  pageWindow: unknown,
  origin: string,
  pageOrigin: string,
): boolean {
  return source === pageWindow && origin === pageOrigin
}

export function adapterResponseForNonce(value: unknown, nonce: string): AdapterPageResponse | null {
  const response = validatedAdapterResponse(value)
  return response?.nonce === nonce ? response : null
}

export function adapterCapabilityReady(
  hello: AdapterHello | null,
  capabilityId: string,
  schemaVersion = 1,
): boolean {
  const capability = hello?.capabilities.find((item) => item.id === capabilityId)
  return capability?.ready === true && capability.schemaVersion === schemaVersion
}

class HoukagoAdapterBridge {
  private readonly pending = new Map<string, PendingRequest>()
  private listening = false

  async hello(): Promise<AdapterHello> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "HELLO",
    }
    const response = await this.send(request, "HELLO", HELLO_TIMEOUT_MS)
    if (response.type !== "HELLO")
      throw new AdapterBridgeError("INVALID_RESPONSE", "Invalid hello response")
    return response.data
  }

  async pair(serverBase: string, pairingCode: string): Promise<void> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "PAIR",
      serverBase,
      pairingCode,
    }
    await this.result(request)
  }

  async redeemOauthHandoff(serverBase: string): Promise<void> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "OAUTH_HANDOFF",
      serverBase,
    }
    await this.result(request)
  }

  async listBaiduFiles(path: string, cursor?: string): Promise<BaiduDirectoryPage> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "BAIDU_LIST",
      path,
      ...(cursor === undefined ? {} : { cursor }),
    }
    const response = await this.send(request, "BAIDU_LIST_RESULT")
    if (response.type !== "BAIDU_LIST_RESULT") {
      throw new AdapterBridgeError("INVALID_RESPONSE", "Invalid Baidu directory response")
    }
    return response.data
  }

  async permitBaiduSource(
    sourceId: string,
    bushitsuId: string,
    upstreamHandle: string,
  ): Promise<void> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "BAIDU_PERMIT",
      sourceId,
      bushitsuId,
      upstreamHandle,
    }
    await this.result(request)
  }

  async prepareBaiduMedia(grantUrl: string, expiresAt: number): Promise<void> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "BAIDU_MEDIA_PREPARE",
      grantUrl,
      expiresAt,
    }
    await this.result(request)
  }

  async fingerprintBaiduMedia(
    sourceId: string,
    bushitsuId: string,
    grantUrl: string,
    expiresAt: number,
    bytes = BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
  ): Promise<BaiduMediaFingerprint> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "BAIDU_MEDIA_FINGERPRINT",
      sourceId,
      bushitsuId,
      grantUrl,
      expiresAt,
      bytes,
    }
    const response = await this.send(request, "BAIDU_MEDIA_FINGERPRINT_RESULT")
    if (response.type !== "BAIDU_MEDIA_FINGERPRINT_RESULT") {
      throw new AdapterBridgeError("INVALID_RESPONSE", "Invalid media fingerprint response")
    }
    return response.data
  }

  async revokeBaidu(): Promise<void> {
    const request: AdapterPageRequest = {
      source: HOUKAGO_ADAPTER_PAGE_SOURCE,
      protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
      nonce: createNonce(),
      type: "BAIDU_REVOKE",
    }
    await this.result(request)
  }

  private async result(request: AdapterPageRequest): Promise<void> {
    const response = await this.send(request, "RESULT")
    if (response.type !== "RESULT")
      throw new AdapterBridgeError("INVALID_RESPONSE", "Invalid adapter response")
  }

  private send(
    request: AdapterPageRequest,
    expectedType: AdapterResponseType,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<AdapterPageResponse> {
    if (typeof window === "undefined") {
      return Promise.reject(
        new AdapterBridgeError("ADAPTER_UNAVAILABLE", "Browser adapter is unavailable"),
      )
    }
    if (!Value.Check(AdapterPageRequestSchema, request)) {
      return Promise.reject(new AdapterBridgeError("INVALID_REQUEST", "Invalid adapter request"))
    }
    this.listen()
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(request.nonce)
        reject(new AdapterBridgeError("ADAPTER_TIMEOUT", "Browser adapter did not respond"))
      }, timeoutMs)
      this.pending.set(request.nonce, { expectedType, resolve, reject, timeoutId })
      window.postMessage(request, window.location.origin)
    })
  }

  private listen(): void {
    if (this.listening) return
    window.addEventListener("message", this.onMessage)
    this.listening = true
  }

  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    if (!adapterMessageMatchesContext(event.source, window, event.origin, window.location.origin))
      return
    const response = validatedAdapterResponse(event.data)
    if (!response) return
    const pending = this.pending.get(response.nonce)
    if (!pending) return
    if (response.type === "ERROR") {
      clearTimeout(pending.timeoutId)
      this.pending.delete(response.nonce)
      pending.reject(new AdapterBridgeError(response.error.code, response.error.message))
      return
    }
    if (response.type !== pending.expectedType) return
    clearTimeout(pending.timeoutId)
    this.pending.delete(response.nonce)
    pending.resolve(response)
  }
}

function validatedAdapterResponse(value: unknown): AdapterPageResponse | null {
  if (!Value.Check(AdapterPageResponseSchema, value)) return null
  return Value.Decode(AdapterPageResponseSchema, value)
}

function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export const houkagoAdapter = new HoukagoAdapterBridge()
