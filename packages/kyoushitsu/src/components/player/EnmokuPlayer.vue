<script setup lang="ts">
import Artplayer from "artplayer"
import Hls from "hls.js"
import type { Enmoku } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref } from "vue"

// The ArtPlayer instance is imperative third-party state — this single component
// owns its lifecycle (create onMounted, destroy onUnmounted), per
// component-guidelines. No other component touches the player instance.
const props = defineProps<{ url: string; type: Enmoku["type"] }>()

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
