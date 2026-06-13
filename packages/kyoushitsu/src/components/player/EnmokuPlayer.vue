<script setup lang="ts">
import Artplayer from "artplayer"
import Hls from "hls.js"
import type { Enmoku, Shinkou } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref } from "vue"

// The ArtPlayer instance is imperative third-party state — this single component
// owns its lifecycle (create onMounted, destroy onUnmounted), per
// component-guidelines. All art.seek/play/pause calls stay here; sync decisions
// live in composables/useShinkou.ts.
const props = defineProps<{ url: string; type: Enmoku["type"] }>()

// Local playback changes (host drives → useShinkou broadcasts); `ready` lets the
// parent run catch-up once the instance exists.
const emit = defineEmits<{ shinkou: [Shinkou]; ready: [] }>()

// Sub-threshold position diffs are ignored on apply to avoid a seek→echo→seek
// loop (design §5 ≤0.3s ignore tier).
const SEEK_EPSILON = 0.3

const container = ref<HTMLDivElement | null>(null)
let art: Artplayer | null = null

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
  if (s.isPlaying && !art.playing) art.play()
  else if (!s.isPlaying && art.playing) art.pause()
}

// Align play/pause/rate to authority without seeking — used by the GENJOU
// heartbeat so the time component can be left to zureHosei (no seek every tick).
function alignTransport(s: Shinkou): void {
  if (!art) return
  art.playbackRate = s.playbackRate
  if (s.isPlaying && !art.playing) art.play()
  else if (!s.isPlaying && art.playing) art.pause()
}

// Temporarily override the playback rate for a soft drift nudge (design §5 中档).
// The authority rate is restored by useShinkou on the next ignore-tier tick.
function setRate(rate: number): void {
  if (art) art.playbackRate = rate
}

defineExpose({ apply, alignTransport, setRate, snapshot })

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
})
</script>

<template>
  <div ref="container" class="enmoku-player" />
</template>

<style scoped>
.enmoku-player {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}
</style>
