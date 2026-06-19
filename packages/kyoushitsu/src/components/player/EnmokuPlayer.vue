<script setup lang="ts">
import { t } from "@/i18n"
import { canSeekTo } from "@/lib/seekable"
import Artplayer from "artplayer"
import Hls from "hls.js"
import type { Enmoku, Shinkou } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref, watch } from "vue"

// The ArtPlayer instance is imperative third-party state — this single component
// owns its lifecycle (create onMounted, destroy onUnmounted), per
// component-guidelines. All art.seek/play/pause calls stay here; sync decisions
// live in composables/useShinkou.ts.
// showJoinGate: follower がまだ未参加のとき、ブラウザの autoplay 制約で音付き
// 再生にユーザー操作が要る。親が `!isBuchou && !joined` を渡し、true の間だけ
// 「クリックして参加」遮罩を表示する。
// controlLocked: a guest without 再生制御 permission. The parent passes
// `!canControl`; while true the root gets a `.control-locked` class. ArtPlayer の
// コントロール条 `.art-bottom`(z60, 進度条+再生/音量/全屏ボタン) と中央オーバーレイ
// `.art-mask`(z50, .art-state 大再生ボタン) を display:none で消し(display は
// pointer-events で覆せない — 前回 .art-video-player の pointer-events:none は控件
// 自身の可点性に勝てず再生ボタンが押せた)、video 本体 `.art-video` は
// pointer-events:none で点击を殺す。これで guest はあらゆる再生入力を失う。
// 程序化 art.play()/seek は JS 呼び出しで pointer-events/display に縛られないため
// follower 同期は通常通り。.control-lock 帯は純視覚提示 (pointer-events:none)。
// 弹幕 toggle は pointer-events:auto の子で依然押せ、join-gate は $player の兄弟で
// 影響を受けない。The server also rejects any SHINKOU (双保険・最終保険).
const props = defineProps<{
  url: string
  type: Enmoku["type"]
  showJoinGate?: boolean
  controlLocked?: boolean
}>()

// Local playback changes (host drives → useShinkou broadcasts); `ready` lets the
// parent run catch-up once the instance exists. `join`：部員 pressed the gate —
// the parent flips joined + catchUp in the same gesture stack. `control`：
// ArtPlayer コントロール条の显隐を親へ直送（emit）— 暴露 ref→親 computed の脆い
// 連鎖を避け、普通／网页全屏／原生全屏の三態で確実に響応させる（prd Bug1）。
// `time` feeds local file-danmaku rendering only; it never becomes playback
// authority and never emits SHINKOU. `playing` feeds local file-danmaku CSS
// animation state only; playback authority still comes from SHINKOU.
const emit = defineEmits<{
  shinkou: [Shinkou]
  ready: []
  join: []
  control: [boolean]
  time: [number]
  playing: [boolean]
}>()

// Sub-threshold position diffs are ignored on apply to avoid a seek→echo→seek
// loop (design §5 ≤0.3s ignore tier).
const SEEK_EPSILON = 0.3

const container = ref<HTMLDivElement | null>(null)
// ArtPlayer の主播放器容器（$player）：原生全屏の対象元素。父级用它做 Teleport
// target，让弹幕 overlay 进入全屏子树。ArtPlayer 类型不全 → 局部窄接口收窄，禁 any。
const playerEl = ref<HTMLElement | null>(null)
let art: Artplayer | null = null

// 中途加入の追平 seek が早すぎて落ちる問題への対策（prd Bug2）: hls.js がまだ
// メディアを読み込み切っておらず seek 不可（readyState 低 / video.seekable 空）の
// うちに art.seek = t を発行しても 0 に戻り、追平しない。要求された seek 先を
// pendingSeek に控え、メディアが seek 可能になった loadedmetadata/canplay で flush する。
// 通常（既に seek 可能）は即時 seek し pendingSeek は使わない。
let pendingSeek: number | null = null

type ArtTemplate = { $player: HTMLElement }

// art.video（HTMLVideoElement）への型安全な参照。ArtPlayer 型不全のため局部で収窄。
function videoEl(): HTMLVideoElement | null {
  return (art as unknown as { video?: HTMLVideoElement }).video ?? null
}

// 追平 seek を発行：今 seek 可能ならそのまま、まだならメディア準備完了後に
// flush するため pendingSeek に控える。seek 可否判定は純関数 canSeekTo に委譲。
function seekTo(target: number): void {
  if (!art) return
  const v = videoEl()
  if (v && canSeekTo(target, v.readyState, v.duration)) {
    art.seek = target
    pendingSeek = null
    return
  }
  pendingSeek = target
}

function playM3u8(video: HTMLVideoElement, url: string, artInstance: Artplayer) {
  if (Hls.isSupported()) {
    const hls = new Hls()
    hls.loadSource(url)
    hls.attachMedia(video)
    artInstance.on("destroy", () => hls.destroy())
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url
  }
}

// 唯一の art.play() 経路：autoplay ポリシーで未参加 follower の play() は拒否
// (NotAllowedError) されるのが想定動作。rejection を静かに握りつぶし、Unhandled
// にも黒画面にもしない。muted リトライはしない（音質/同期劣化のため revert 済み）。
function safePlay(): void {
  if (!art) return
  // art.play() の戻りは Promise（rejection あり）— catch して握りつぶす。
  Promise.resolve(art.play()).catch(() => {})
}

function snapshot(): Shinkou {
  return {
    isPlaying: art ? art.playing : false,
    currentTime: art?.currentTime ?? 0,
    playbackRate: art?.playbackRate ?? 1,
  }
}

// 進行を適用：imperatively drive the player to a remote authority state. The only
// place that mutates the ArtPlayer instance from outside its own events.
function apply(s: Shinkou): void {
  if (!art) return
  if (Math.abs(art.currentTime - s.currentTime) > SEEK_EPSILON) seekTo(s.currentTime)
  art.playbackRate = s.playbackRate
  if (s.isPlaying && !art.playing) safePlay()
  else if (!s.isPlaying && art.playing) art.pause()
}

// Align play/pause/rate to authority without seeking — used by the GENJOU
// heartbeat so the time component can be left to zureHosei (no seek every tick).
function alignTransport(s: Shinkou): void {
  if (!art) return
  art.playbackRate = s.playbackRate
  if (s.isPlaying && !art.playing) safePlay()
  else if (!s.isPlaying && art.playing) art.pause()
}

// Temporarily override the playback rate for a soft drift nudge (design §5 中档).
// The authority rate is restored by useShinkou on the next ignore-tier tick.
function setRate(rate: number): void {
  if (art) art.playbackRate = rate
}

// 参加ボタン押下：このクリックは同期イベント処理器内なのでユーザー操作が有効。
// ここで音付き play() を即発火（手势保留）し、親へ join を通知 → 親が catchUp で
// 房主の現在位置へ seek + 追従。apply 側は art.playing 済みなら play() を再発火
// しないので二重再生にはならない。手势確保のため emit より先に play する。
function onJoin(): void {
  safePlay()
  emit("join")
}

// 放権（解锁: controlLocked true→false）時にコントロール条を能動的に再表示する。
// 加锁中は CSS `.control-locked` が `.art-bottom`/`.art-mask` を display:none で消す
// が、解锁で display:none が外れても ArtPlayer 自身の显隐状態機は「隠れ」のまま
// （.art-bottom 既定 opacity:0、art-control-show / art-hover が付いて初めて opacity:1）
// なので hover/再構築まで条が戻らなかった（prd 根因）。`art.controls.show = true` は
// $player に `art-control-show` クラスを付け（条が opacity:1 で復帰）、同時に
// ArtPlayer 内部で 'control' イベントを emit する — 既存の art.on("control", …) が
// それを親へ転送し controlsShown(気泡跟随) も自然に整合する（追加 emit 不要）。
// 加锁(false→true)は CSS が即時隠すので JS 操作は不要。art が null（mount 前）なら guard。
watch(
  () => props.controlLocked,
  (locked, prev) => {
    if (prev && !locked && art) art.controls.show = true
  },
)

defineExpose({ apply, alignTransport, setRate, snapshot, playerEl })

onMounted(() => {
  if (!container.value) return
  const isHls = props.type === "hls" || props.type === "live" || props.url.endsWith(".m3u8")
  art = new Artplayer({
    container: container.value,
    url: props.url,
    type: isHls ? "m3u8" : undefined,
    customType: isHls
      ? { m3u8: (video, url, artInstance) => playM3u8(video, url, artInstance) }
      : undefined,
    autoSize: false,
    fullscreen: true,
    setting: true,
  })

  playerEl.value = (art.template as ArtTemplate).$player

  // Local playback events → Shinkou snapshots. useShinkou gates these by 部長 +
  // 追従中 before broadcasting, so emitting unconditionally here is safe.
  const emitPlaying = () => emit("playing", art?.playing ?? false)
  const onChange = () => {
    emit("shinkou", snapshot())
    emitPlaying()
  }
  art.on("play", onChange)
  art.on("pause", onChange)
  art.on("seek", onChange)
  art.on("video:ratechange", onChange)
  art.on("ready", () => {
    emit("ready")
    emitPlaying()
  })
  art.on("video:timeupdate", () => emit("time", art?.currentTime ?? 0))
  art.on("video:seeked", () => emit("time", art?.currentTime ?? 0))

  // コントロール条の显隐を親へ直送（prd Bug1）。ArtPlayer 'control' は state=条が
  // 可視か を渡す（typed event, 禁 any）。emit で送ることで暴露 ref→親 computed の
  // 脆い連鎖を排し、原生全屏含む三態で確実に響応する。art.destroy で listener 自清。
  art.on("control", (state) => emit("control", state))

  // 追平 seek の取りこぼし回収（prd Bug2）: catchUp/heartbeat が seek 可能になる前に
  // 控えた pendingSeek を、メディアが seek 可能になった時点で一度だけ flush する。
  // これにより中途加入は遮罩クリック後に房主の現在位置へ自動追平し、A の手動 toggle
  // に依存しない。flush 後 pendingSeek は seekTo 内で null に戻る。
  const flushPending = () => {
    if (pendingSeek !== null) seekTo(pendingSeek)
  }
  art.on("video:loadedmetadata", flushPending)
  art.on("video:canplay", flushPending)
})

onBeforeUnmount(() => {
  art?.destroy()
  art = null
  playerEl.value = null
})
</script>

<template>
  <div class="enmoku-player" :class="{ 'control-locked': controlLocked }">
    <!-- ArtPlayer 専属マウント点：第三方ライブラリが内部 DOM を全権管理する。
         Vue はこの div 内に一切ノードを置かない — そうしないと ArtPlayer の DOM
         再配置と Vue の v-if patch が同一容器を奪い合い、comment アンカーの
         insertBefore で parent=null クラッシュを起こす（prd 根因）。浮層は下の
         兄弟として .enmoku-player 直下に置き、Vue が完全掌握する。 -->
    <div ref="container" class="art-host"></div>
    <!-- 再生制御提示：guest に 再生制御 権限がない間だけ表示。遮断は CSS で
         .art-bottom/.art-mask を display:none + .art-video を pointer-events:none に
         して行い、この帯は純視覚 (pointer-events:none)。状態は文字併記で色だけに
         頼らない (accessibility)。art-host の兄弟なので ArtPlayer の DOM と交錯しない。 -->
    <div
      v-if="controlLocked"
      class="control-lock"
      role="status"
      :aria-label="t('controlLockedAria')"
    >
      <span>{{ t("controlLocked") }}</span>
    </div>
    <button
      v-if="showJoinGate"
      type="button"
      class="join-gate"
      :aria-label="t('joinGateAria')"
      @click="onJoin"
    >
      {{ t("joinGate") }}
    </button>
  </div>
</template>

<style scoped>
/* 宽高比由父级 .player-wrap 决定（普通=16:9，网页全屏=填满左列）；
   播放器只负责填满父容器，ArtPlayer 内部 object-fit contain 做 letterbox */
.enmoku-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}
/* ArtPlayer 専属マウント点：.enmoku-player を満铺する。ArtPlayer の DOM はこの
   中に生え、浮層(control-lock/join-gate)は兄弟として外層直下に置く。下の :deep
   後代選択器(.art-bottom/.art-mask/.art-video)は art-host を跨いでも依然命中する。 */
.art-host {
  width: 100%;
  height: 100%;
}
/* ArtPlayer 既定の .art-video は object-fit 未指定で、容器を満铺ストレッチする
   （dist CSS: width/height 100% のみ）。普通模式は wrap が 16:9 で容器=映像比のため
   目立たないが、网页全屏／原生全屏は容器比が映像比とズレ、映像が歪む／满铺して
   contain しない（prd Bug2）。contain を明示し、全状態で letterbox 居中させる。
   wrap の比が映像比と一致する普通模式では no-op。 */
.enmoku-player :deep(.art-video) {
  object-fit: contain;
}
/* 再生制御ロック：ArtPlayer のコントロール条と中央再生ボタンを display:none で
   消し、video 本体は pointer-events:none で点击を殺す。display:none は控件自身の
   可点性に覆されない（前回 .art-video-player の pointer-events:none では控件が勝ち
   再生ボタンが押せた）。.art-bottom=底部条(進度条+再生/音量/全屏)、.art-mask=中央
   オーバーレイ(.art-state 大再生ボタン)。$player の兄弟 join-gate と pointer-events:
   auto の弹幕 toggle は影響を受けない。程序化 art.play()/seek は JS 呼び出しのため
   follower 同期は妨げない。授権/房主時(control-locked なし)は控件が復帰する。 */
.enmoku-player.control-locked :deep(.art-bottom),
.enmoku-player.control-locked :deep(.art-mask) {
  display: none;
}
.enmoku-player.control-locked :deep(.art-video) {
  pointer-events: none;
}
/* 再生制御提示帯：純視覚（pointer-events:none で拦截はしない）。color のみで
   状態を伝えないようテキストを併記（accessibility）。 */
.control-lock {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
  color: #fff;
  font-size: 0.9rem;
  background: rgba(0, 0, 0, 0.15);
}
.control-lock span {
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
}
.join-gate {
  position: absolute;
  inset: 0 0 60px 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 1.25rem;
  cursor: pointer;
}
</style>
