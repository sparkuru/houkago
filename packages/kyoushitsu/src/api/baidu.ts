import { housou } from "@/api"
import type { BaiduFileEntry, BaiduRetentionMode } from "houkago-kousoku"

export function fetchBaiduStatus() {
  return housou.baidu.status.get()
}

export function requestBaiduAdapterPairing(deviceId: string, localPaired: boolean) {
  return housou.baidu.adaptor.pairing.post({ deviceId, localPaired })
}

export function startBaiduOauth(retentionMode: BaiduRetentionMode, deviceId?: string) {
  return housou.baidu.oauth.start.post({
    retentionMode,
    ...(deviceId === undefined ? {} : { deviceId }),
  })
}

export function revokeBaiduConnection() {
  return housou.baidu.connection.delete()
}

export function listServerBaiduFiles(path: string, cursor?: string) {
  return housou.baidu.files.list.post({ path, ...(cursor === undefined ? {} : { cursor }) })
}

export function createBaiduSource(
  bushitsuId: string,
  entry: BaiduFileEntry,
  upstreamHandle?: string,
) {
  return housou.baidu.sources.post({
    bushitsuId,
    fileId: entry.id,
    fileName: entry.name,
    ...(entry.size === undefined ? {} : { size: entry.size }),
    ...(upstreamHandle === undefined ? {} : { upstreamHandle }),
  })
}

export function deleteBaiduEnmoku(bushitsuId: string, enmokuId: string) {
  return housou.bushitsu({ id: bushitsuId }).enmoku({ enmokuId }).delete()
}

export function createBaiduPlaybackGrant(sourceId: string, bushitsuId: string) {
  return housou.baidu.sources({ sourceId }).grants.post({ bushitsuId })
}

export function fetchBaiduSourceAvailability(sourceId: string, bushitsuId: string) {
  return housou.baidu.sources({ sourceId }).availability.get({ query: { bushitsuId } })
}

export function pollBaiduPlaybackGrant(requestId: string) {
  return housou.baidu.grants({ requestId }).get()
}
