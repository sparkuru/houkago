// 参加ゲート（join gate, design §5 follower autoplay 制約）の純粋判定。
// ブラウザの autoplay ポリシーで、ユーザー操作の無い部員(follower)は art.play()
// が拒否される。よって follower かつ未参加のときだけ「クリックして参加」遮罩を出す。
// 部長(host)は自分の操作で起動するため遮罩は不要。view 態のみ・store 不要・DOM 不要
// に保ち、framework-free で単体テストできるよう関数化する（quality-guidelines）。
export function showJoinGate(isBuchou: boolean, joined: boolean): boolean {
  return !isBuchou && !joined
}
