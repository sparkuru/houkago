import { requestBaiduAdapterPairing } from "@/api/baidu"
import {
  type BaiduAdapterDetection,
  type BaiduAdapterDetectionDependencies,
  detectBaiduAdapter,
} from "@/lib/baidu-adapter-detection"
import { houkagoAdapter } from "@/lib/houkago-adapter"
import { housouUrl } from "@/lib/housou-url"

export type { BaiduAdapterDetection } from "@/lib/baidu-adapter-detection"

const defaultDependencies: BaiduAdapterDetectionDependencies = {
  hello: () => houkagoAdapter.hello(),
  pair: (serverBase, pairingCode) => houkagoAdapter.pair(serverBase, pairingCode),
  requestPairing: requestBaiduAdapterPairing,
  serverBase: housouUrl,
}

export function detectAndPairBaiduAdapter(
  dependencies: BaiduAdapterDetectionDependencies = defaultDependencies,
): Promise<BaiduAdapterDetection> {
  return detectBaiduAdapter(dependencies)
}
