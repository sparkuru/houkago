import { housou } from "@/api"
import type {
  DanmakuCandidateResolution,
  DanmakuDefaultSnapshot,
  DanmakuEvidence,
} from "houkago-kousoku"

export function fetchDanmakuCandidates(bushitsuId: string, enmokuId: string) {
  return housou.danmaku.bushitsu({ bushitsuId }).enmoku({ enmokuId }).get()
}

export function setDanmakuRoomDefault(bushitsuId: string, enmokuId: string, trackId: string) {
  return housou.danmaku.bushitsu({ bushitsuId }).enmoku({ enmokuId }).default.put({ trackId })
}

export function clearDanmakuRoomDefault(bushitsuId: string, enmokuId: string) {
  return housou.danmaku.bushitsu({ bushitsuId }).enmoku({ enmokuId }).default.delete()
}

export function submitDanmakuPublicProposal(
  releaseId: string,
  evidence: readonly DanmakuEvidence[],
) {
  return housou.danmaku.proposals.post({ releaseId, evidence: [...evidence] })
}

export function confirmDanmakuPersonalMatch(
  releaseId: string,
  episodeId: string,
  evidence: readonly DanmakuEvidence[],
) {
  return housou.danmaku.matches.post({
    releaseId,
    episodeId,
    trustScope: "personal",
    evidence: [...evidence],
  })
}

export type { DanmakuCandidateResolution, DanmakuDefaultSnapshot }
