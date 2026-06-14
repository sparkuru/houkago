// 弾幕気泡トラックの底辺位置（prd #3）の純粋判定。ArtPlayer コントロール条の
// 显隐に追従して気泡を上下させる：条が可視のときは条の高さ分だけ上げて遮られない
// よう CONTROLS_SHOWN_PX、隐れたときは底に寄せて余白だけの CONTROLS_HIDDEN_PX。
// view 態のみ・DOM/player 不要に保ち framework-free で単体テストする（quality-guidelines）。
export const CONTROLS_SHOWN_PX = 56 // sit above the player control bar
export const CONTROLS_HIDDEN_PX = 16 // hug the bottom with a small margin

export function danmakuTrackBottom(controlsShown: boolean): number {
  return controlsShown ? CONTROLS_SHOWN_PX : CONTROLS_HIDDEN_PX
}
