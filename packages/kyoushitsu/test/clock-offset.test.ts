import { expect, test } from "bun:test"
import { createOffsetEstimator, estimateOffset } from "../src/lib/clock-offset"

// NTP-lite 時計オフセット推定の純関数テスト（DOM/player 不要、zure.test と同方針）。
// offset = serverClock − clientClock。窓内最大サンプル（=最小単向遅延 = 過小評価最少）を採る。

test("サンプル無しは 0（従来の服务器钟直接信頼に退化）", () => {
  expect(estimateOffset([])).toBe(0)
})

test("窓内の最大サンプルを採る（最小単向遅延 = 最堅牢な一階推定）", () => {
  // 真の offset は約 +1000ms。各サンプルは offset − 単向遅延 でブレる。
  // 最大 = 遅延が最小だったサンプル = 最も真値に近い。
  expect(estimateOffset([980, 995, 1000, 970])).toBe(1000)
})

test("負の offset（client が server より進んでいる）も最大を採る", () => {
  expect(estimateOffset([-1000, -1010, -990, -1005])).toBe(-990)
})

test("単条の抖动（過小サンプル）は最大採用で振り落とされる", () => {
  // 一条だけ遅延スパイクで大きく過小評価されても、最大が拾うので推定は揺れない。
  expect(estimateOffset([1000, 1000, 200, 1000])).toBe(1000)
})

test("estimator: 推定が server↔client 偏差を再現し、投影が偏差を相殺する", () => {
  const est = createOffsetEstimator()
  const OFFSET = 1500 // server が client より 1.5s 進む状況を仮定
  // server 盖戳 ts と client 受信時刻から sample = serverTs − clientNow を投入。
  // 遅延 d を持つ複数条（d=最小のものが最大サンプル）。
  for (const d of [40, 12, 5, 30]) {
    const clientNow = 100000
    const serverTs = clientNow + OFFSET - d // 服务器盖戳時刻 ≈ clientNow+OFFSET、遅延 d 後に受信
    est.push(serverTs - clientNow)
  }
  // 最小遅延 d=5 のサンプル = OFFSET−5 が最大 → 推定。
  expect(est.estimate()).toBe(OFFSET - 5)

  // 投影での効果: serverNow = clientNow + offset は真の server 時刻に近づき、
  // 偏差 OFFSET が投影目標に丸ごと漏れなくなる（残差 = 最小単向遅延のみ）。
  const offset = est.estimate()
  const residual = OFFSET - offset
  expect(residual).toBeLessThanOrEqual(5) // 残差 ≤ 最小単向遅延（LAN では無視可）
})

test("estimator: 有限窓で古いサンプルを振り落とす", () => {
  const est = createOffsetEstimator(3)
  est.push(5000) // 古い偏差/スパイク
  est.push(10)
  est.push(20)
  est.push(30) // ここで 5000 は窓外に
  expect(est.estimate()).toBe(30)
})

test("estimator: 空なら 0", () => {
  expect(createOffsetEstimator().estimate()).toBe(0)
})
