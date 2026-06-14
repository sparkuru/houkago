<script setup lang="ts">
import { shouldRetryMuted, showUnmuteOverlay } from "@/lib/autoplay"
import Artplayer from "artplayer"
import Hls from "hls.js"
import type { Enmoku, Shinkou } from "houkago-kousoku"
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

// The ArtPlayer instance is imperative third-party state — this single component
// owns its lifecycle (create onMounted, destroy onUnmounted), per
// component-guidelines. All art.seek/play/pause calls stay here; sync decisions
// live in composables/useShinkou.ts.
// `muted`: 部員(follower)は初期ミュートで起動し、手势なしでも program的 play() が
// ブラウザ autoplay 策略に許可されるようにする。房主は muted=false で従来通り。
const props = defineProps<{ url: string; type: Enmoku["type"]; muted?: boolean }>()

// Local playback changes (host drives → useShinkou broadcasts); `ready` lets the
// parent run catch-up once the instance exists.
const emit = defineEmits<{ shinkou: [Shinkou]; ready: [] }>()

// Sub-threshold position diffs are ignored on apply to avoid a seek→echo→seek
// loop (design §5 ≤0.3s ignore tier).
const SEEK_EPSILON = 0.3

const container = ref<HTMLDivElement | null>(null)
// ArtPlayer の主播放器容器（$player）：原生全屏の対象元素。父级用它做 Teleport
// target，让弹幕 overlay 进入全屏子树。ArtPlayer 类型不全 → 局部窄接口收窄，禁 any。
const playerEl = ref<HTMLElement | null>(null)
let art: Artplayer | null = null

type ArtTemplate = { $player: HTMLElement }

// 実 art.muted を映す view 態（store には載せない）。遮罩の表示と解除に使う。
const artMuted = ref(false)
const unmuteOverlayMieru = computed(() => showUnmuteOverlay(props.muted === true, artMuted.value))

// art.play() は Promise を返す。autoplay 策略で拒否されたら（まだ非ミュートなら）
// ミュートして一度だけ再試行し、なお失敗すれば吞んで Unhandled rejection を出さない。
// seek/transport の三箇所はすべてこの helper 経由で再生する。
async function safePlay(): Promise<void> {
  if (!art) return
  try {
    await art.play()
  } catch {
    if (!shouldRetryMuted(art.muted)) return
    art.muted = true
    artMuted.value = true
    try {
      await art.play()
    } catch {}
  }
}

// 遮罩クリック → ミュート解除（この click 自体が手势なので以後 program的 play は通る）。
function unmute(): void {
  if (!art) return
  art.muted = false
  artMuted.value = false
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
    muted: props.muted === true,
  })

  artMuted.value = art.muted
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
  <div class="enmoku-player">
    <div ref="container" class="enmoku-art" />
    <button
      v-if="unmuteOverlayMieru"
      type="button"
      class="unmute-overlay"
      aria-label="音声を開く"
      @click="unmute"
    >
      🔊 クリックで音声を開く
    </button>
  </div>
</template>

<style scoped>
/* 宽高比由父级 .player-wrap 决定（普通=16:9，网页全屏=填满左列）；
   播放器只负责填满父容器，ArtPlayer 内部 object-fit contain 做 letterbox。
   遮罩を重ねるため wrapper を positioned に。 */
.enmoku-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}
.enmoku-art {
  width: 100%;
  height: 100%;
}
/* 部員ミュート時の「音声を開く」遮罩。画面を覆ってクリックを受けるが、
   ArtPlayer 自体の native fullscreen ボタン等(高 z-index)より下に置く。 */
.unmute-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
}
</style>
