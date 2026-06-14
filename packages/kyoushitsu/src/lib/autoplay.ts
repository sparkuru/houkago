// ブラウザ autoplay 策略の純ロジック。部員(B)は手势なしページで program的 play() が
// NotAllowedError で拒否される → ミュート再試行で回避する（design: autoplay ADR）。
// DOM/player 不要の純関数なので単体テストできる。

// play() が拒否された後に「ミュートして再試行すべきか」を決める。既にミュート済みなら
// 再試行しても無意味（ミュート以外の真因）なので諦める。
export function shouldRetryMuted(currentlyMuted: boolean): boolean {
  return !currentlyMuted
}

// follower かつ実 art がまだミュート中のときだけ「🔊 音声を開く」遮罩を出す。
// 房主(非 follower)や解除済みでは出さない。
export function showUnmuteOverlay(isFollower: boolean, artMuted: boolean): boolean {
  return isFollower && artMuted
}
