// 弾幕気泡トラックの底辺位置（prd #3 / Bug1）の純粋判定。ArtPlayer コントロール条の
// 显隐に追従して気泡を上下させる：条が可視のときは条の高さ分だけ上げて遮られない
// よう CONTROLS_SHOWN、隐れたときは底に寄せて余白だけの CONTROLS_HIDDEN。
//
// Bug1: 絶対 px 56/16 は 4K 原生全屏で控制条相対に小さすぎ、移動が分からない／
// なお遮られた。控制条高は画面に応じて伸びるため、clamp(px, vh, px) で大屏ほど
// 大きく抬げ、普通サイズでは従来感を保つ。値は CSS length 文字列として返す。
//
// view 態のみ・DOM/player 不要に保ち framework-free で単体テストする（quality-guidelines）。
export const CONTROLS_SHOWN = "clamp(56px, 9vh, 140px)" // sit above the player control bar
export const CONTROLS_HIDDEN = "16px" // hug the bottom with a small margin

export function danmakuTrackBottom(controlsShown: boolean): string {
  return controlsShown ? CONTROLS_SHOWN : CONTROLS_HIDDEN
}
