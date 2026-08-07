import type { BaiduClientState } from "@/lib/baidu-provider"
import { AdapterBridgeError, adapterCapabilityReady } from "@/lib/houkago-adapter"
import {
  type AdapterHello,
  BAIDU_MEDIA_HEADERS_CAPABILITY,
  HOUKAGO_ADAPTER_PROTOCOL_VERSION,
} from "houkago-kousoku"

type PairingDecision =
  | { state: "paired" }
  | { state: "pairing-required"; pairingCode: string; expiresAt: number }

export type BaiduAdapterDetection = {
  hello: AdapterHello | null
  state: Exclude<BaiduClientState, "mobile">
  pairingFailed: boolean
}

export type BaiduAdapterDetectionDependencies = {
  hello: () => Promise<AdapterHello>
  pair: (serverBase: string, pairingCode: string) => Promise<void>
  requestPairing: (
    deviceId: string,
    localPaired: boolean,
  ) => Promise<{ data: PairingDecision | null }>
  serverBase: () => string
}

export async function detectBaiduAdapter(
  dependencies: BaiduAdapterDetectionDependencies,
): Promise<BaiduAdapterDetection> {
  try {
    let hello = await dependencies.hello()
    if (hello.protocolVersion !== HOUKAGO_ADAPTER_PROTOCOL_VERSION) {
      return { hello, state: "incompatible", pairingFailed: false }
    }
    const localPaired = adapterCapabilityReady(hello, BAIDU_MEDIA_HEADERS_CAPABILITY)
    const { data } = await dependencies.requestPairing(hello.deviceId, localPaired)
    if (data?.state === "pairing-required") {
      await dependencies.pair(dependencies.serverBase(), data.pairingCode)
      hello = await dependencies.hello()
    } else if (data?.state !== "paired") {
      throw new AdapterBridgeError("PAIRING_FAILED", "Invalid adapter pairing response")
    }
    return {
      hello,
      state: adapterCapabilityReady(hello, BAIDU_MEDIA_HEADERS_CAPABILITY)
        ? "ready"
        : "incompatible",
      pairingFailed: false,
    }
  } catch (error) {
    return {
      hello: null,
      state: "missing",
      pairingFailed: error instanceof AdapterBridgeError && error.code === "PAIRING_FAILED",
    }
  }
}
