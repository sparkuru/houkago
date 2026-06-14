// 追平 seek の可否判定（純関数, prd Bug2）。中途加入の catch-up / heartbeat seek が
// hls.js のメディア読み込み前に発行されると 0 に戻って落ちる。プレイヤーが今この
// 瞬間に与えられた位置へ seek できるかを HTMLVideoElement の状態だけから判定し、
// 不可なら EnmokuPlayer 側で pendingSeek に控えて canplay/loadedmetadata で flush する。
//
// DOM/プレイヤー無しで単体テストできるよう、判定に必要な値だけを引数に取る。

// readyState は HTMLMediaElement.HAVE_METADATA = 1 以上で位置情報が揃う。
const HAVE_METADATA = 1
// duration はメディア末尾。浮動小数誤差ぶんの余裕。
const DURATION_SLACK = 0.5

export function canSeekTo(target: number, readyState: number, duration: number): boolean {
  if (readyState < HAVE_METADATA) return false
  if (!Number.isFinite(duration) || duration <= 0) return false
  return target <= duration + DURATION_SLACK
}
