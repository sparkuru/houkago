// NTP-lite 時計オフセット推定（design §5 で予約された一階補正、被動推定・零協議改動）。
//
// 跨機実跑で B 端が A より前に走る根因は、投影が B のローカル墙钟 Date.now() から
// 服务器墙钟 serverTime を引くこと。両钟に偏差 O があると投影目標が丸ごと O ずれ、
// zure の nudge 軟校正がその偏った目標を追い続けて B が系統的に超前する。
//
// 被動推定: 服务器が ts を盖した各 S→C メッセージから
//   sample = msg.ts(服务器墙钟) − clientRecvNow(受信時のローカル墙钟)
// を取る。誤差 = −（単向遅延）なので、窓内の **最大** サンプル（=最小遅延のあの一条、
// offset の過小評価が最も少ない）が最も堅牢な一階推定。LAN の残差(単向遅延 ~1ms)は無視可。
//
// 純関数として切り出してテスト可能にする（DOM/player 不要、zure.ts と同方針）。

// 窓サイズ: 直近 N サンプルだけ保持（古い偏差/遅延スパイクを振り落とす）。
const WINDOW = 16
// 推定を出すまでの最小サンプル数。足りなければ 0（=従来挙動に退化）を返し、
// 単条のネットワーク抖动で投影目標が跳ねて反復 seek するのを防ぐ。
const MIN_SAMPLES = 1

// 有限窓のサンプル列から offset = serverClock − clientClock を推定する。
// 窓内の最大サンプルを採る（最小単向遅延のサンプル = 過小評価最少 = 最堅牢な一階推定）。
// サンプル不足時は 0 を返す（従来の「服务器钟を直接信頼」挙動に等しい）。
export function estimateOffset(samples: readonly number[]): number {
  if (samples.length < MIN_SAMPLES) return 0
  return Math.max(...samples)
}

// 有限窓のサンプルリングを保持する小さな状態オブジェクト。
// useShinkou が server 盖戳メッセージ毎に push し、estimate() で投影に使う offset を読む。
export function createOffsetEstimator(window = WINDOW) {
  let samples: number[] = []
  return {
    // sample = serverTs − clientRecvNow。S→C（senderId === "server"）のみ供給すること。
    push(sample: number): void {
      samples.push(sample)
      if (samples.length > window) samples = samples.slice(-window)
    },
    // 現在の offset 推定（serverClock − clientClock, ms）。
    estimate(): number {
      return estimateOffset(samples)
    },
  }
}
