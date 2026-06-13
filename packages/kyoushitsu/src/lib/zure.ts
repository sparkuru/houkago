// 漂移校正（ずれ補正）— design §5 の三档決策を表す純関数。
// 部員側で「ローカル再生位置」と「権威投影位置」の差（zure = |local − projected|,
// 絶対値）から、プレイヤーへ何をすべきかを決める。transport/player には触れない。

// design §5 の三档閾値（秒）：
//  zure ≤ IGNORE_ZURE        → 無視（人間に気づかれない、追従し続ける）
//  IGNORE_ZURE < zure ≤ HARD_SEEK_ZURE → 再生中は速率を ±NUDGE_FACTOR で軟校正、
//                                         停止中は速率を変えられないので seek へ退化
//  zure > HARD_SEEK_ZURE     → 硬 seek（OIKAKE 追平・大漂移はここで一発合わせ）
const IGNORE_ZURE = 0.3
const HARD_SEEK_ZURE = 1.5
const NUDGE_FACTOR = 0.05

export type ZureHosei = { kind: "ignore" } | { kind: "seek" } | { kind: "nudge"; rate: number }

// zure: 絶対漂移量 |local − projected|（秒, 非負）。
// behind: ローカルが権威より遅れている（local < projected）→ 追いつくため加速。
// isPlaying: 権威が再生中か。停止中は速率調整不可。
// authRate: 権威の playbackRate。nudge はこれを基準に ±NUDGE_FACTOR する。
export function zureHosei(
  zure: number,
  behind: boolean,
  isPlaying: boolean,
  authRate: number,
): ZureHosei {
  if (zure <= IGNORE_ZURE) return { kind: "ignore" }
  if (zure > HARD_SEEK_ZURE) return { kind: "seek" }
  // 中档：再生中のみ軟速率校正、停止中は seek へ退化
  if (!isPlaying) return { kind: "seek" }
  const rate = authRate * (behind ? 1 + NUDGE_FACTOR : 1 - NUDGE_FACTOR)
  return { kind: "nudge", rate }
}
