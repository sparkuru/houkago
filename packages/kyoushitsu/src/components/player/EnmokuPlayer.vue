<script setup lang="ts">
import Artplayer from "artplayer"
import Hls from "hls.js"
import type { Enmoku, Shinkou } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref } from "vue"

// The ArtPlayer instance is imperative third-party state — this single component
// owns its lifecycle (create onMounted, destroy onUnmounted), per
// component-guidelines. All art.seek/play/pause calls stay here; sync decisions
// live in composables/useShinkou.ts.
// showJoinGate: follower がまだ未参加のとき、ブラウザの autoplay 制約で音付き
// 再生にユーザー操作が要る。親が `!isBuchou && !joined` を渡し、true の間だけ
// 「クリックして参加」遮罩を表示する。
const props = defineProps<{ url: string; type: Enmoku["type"]; showJoinGate?: boolean }>()

// Local playback changes (host drives → useShinkou broadcasts); `ready` lets the
// parent run catch-up once the instance exists. `join`：部員 pressed the gate —
// the parent flips joined + catchUp in the same gesture stack.
const emit = defineEmits<{ shinkou: [Shinkou]; ready: []; join: [] }>()

// Sub-threshold position diffs are ignored on apply to avoid a seek→echo→seek
// loop (design §5 ≤0.3s ignore tier).
const SEEK_EPSILON = 0.3

const container = ref<HTMLDivElement | null>(null)
// ArtPlayer の主播放器容器（$player）：原生全屏の対象元素。父级用它做 Teleport
// target，让弹幕 overlay 进入全屏子树。ArtPlayer 类型不全 → 局部窄接口收窄，禁 any。
const playerEl = ref<HTMLElement | null>(null)
let art: Artplayer | null = null

type ArtTemplate = { $player: HTMLElement }

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
  if (Math.abs(art.currentTime - s.currentTime) > SEEK_EPSILON) art.seek = s.currentTime
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
  const onChange = () => emit("shinkou", snapshot())
  art.on("play", onChange)
  art.on("pause", onChange)
  art.on("seek", onChange)
  art.on("video:ratechange", onChange)
  art.on("ready", () => emit("ready"))
})

onBeforeUnmount(() => {
  art?.destroy()
  art = null
  playerEl.value = null
})
</script>

<template>
  <div ref="container" class="enmoku-player">
    <button
      v-if="showJoinGate"
      type="button"
      class="join-gate"
      aria-label="クリックして参加（再生に音声付きで合流）"
      @click="onJoin"
    >
      ▶ クリックして参加
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
/* 参加遮罩：画面領域を覆うが native コントロール(下部)は塞がない高さに留める。
   color のみで状態を伝えないようテキスト+アイコンを併記（accessibility）。 */
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
