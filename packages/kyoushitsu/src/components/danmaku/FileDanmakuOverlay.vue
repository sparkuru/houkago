<script setup lang="ts">
import {
  type FileDanmakuViewport,
  type VisibleDanmakuCue,
  fileDanmakuRenderKey,
  fileDanmakuViewport,
  visibleFileDanmakuCues,
} from "@/lib/file-danmaku"
import type { DanmakuCue } from "houkago-kokuban"
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"

const props = defineProps<{
  target?: HTMLElement | null
  cues: readonly DanmakuCue[]
  currentTime: number
  enabled: boolean
  size: number
  opacity: number
  speed: number
  timeOffset: number
  trackVersion: number
}>()

const visible = computed(() =>
  props.enabled
    ? visibleFileDanmakuCues(props.cues, props.currentTime + props.timeOffset, props.speed)
    : [],
)
const viewport = ref<FileDanmakuViewport>({ left: 0, top: 0, width: 0, height: 0 })

let resizeObserver: ResizeObserver | null = null
let observedVideo: HTMLVideoElement | null = null

function updateViewport(): void {
  const target = props.target
  if (!target) {
    viewport.value = { left: 0, top: 0, width: 0, height: 0 }
    return
  }

  const targetRect = target.getBoundingClientRect()
  const video = target.querySelector("video")
  if (!(video instanceof HTMLVideoElement)) {
    viewport.value = { left: 0, top: 0, width: targetRect.width, height: targetRect.height }
    return
  }

  const videoRect = video.getBoundingClientRect()
  const local = fileDanmakuViewport(
    videoRect.width,
    videoRect.height,
    video.videoWidth,
    video.videoHeight,
  )
  viewport.value = {
    left: videoRect.left - targetRect.left + local.left,
    top: videoRect.top - targetRect.top + local.top,
    width: local.width,
    height: local.height,
  }
}

function cleanupViewportObservers(): void {
  resizeObserver?.disconnect()
  resizeObserver = null
  observedVideo?.removeEventListener("loadedmetadata", updateViewport)
  observedVideo?.removeEventListener("resize", updateViewport)
  observedVideo = null
  if (typeof window !== "undefined") window.removeEventListener("resize", updateViewport)
}

async function observeViewport(): Promise<void> {
  cleanupViewportObservers()
  await nextTick()
  const target = props.target
  if (!target) return

  resizeObserver = new ResizeObserver(updateViewport)
  resizeObserver.observe(target)
  const video = target.querySelector("video")
  if (video instanceof HTMLVideoElement) {
    observedVideo = video
    resizeObserver.observe(video)
    video.addEventListener("loadedmetadata", updateViewport)
    video.addEventListener("resize", updateViewport)
  }
  if (typeof window !== "undefined") window.addEventListener("resize", updateViewport)
  updateViewport()
}

function cueTransform(cue: VisibleDanmakuCue): string {
  const amount = cue.progress * 100
  const distance = cue.progress * viewport.value.width
  if (cue.mode === "reverse") return `translate3d(calc(${distance}px + ${amount}%), 0, 0)`
  if (cue.mode === "top" || cue.mode === "bottom" || cue.mode === "special") {
    return "translate3d(-50%, 0, 0)"
  }
  return `translate3d(calc(-${distance}px - ${amount}%), 0, 0)`
}

watch(() => props.target, observeViewport, { immediate: true })
onBeforeUnmount(cleanupViewportObservers)
</script>

<template>
  <Teleport :to="props.target" :disabled="!props.target">
    <div
      v-if="enabled"
      class="file-danmaku-overlay"
      aria-hidden="true"
      :style="{
        '--danmaku-size': `${size}px`,
        '--danmaku-opacity': opacity,
        left: `${viewport.left}px`,
        top: `${viewport.top}px`,
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
      }"
    >
      <span
        v-for="cue in visible"
        :key="fileDanmakuRenderKey(cue, trackVersion)"
        class="file-danmaku-cue"
        :class="[`mode-${cue.mode}`]"
        :style="{
          '--lane': cue.lane,
          '--cue-opacity': cue.opacity,
          color: cue.color,
          transform: cueTransform(cue),
        }"
      >
        {{ cue.text }}
      </span>
    </div>
  </Teleport>
</template>

<style scoped>
.file-danmaku-overlay {
  position: absolute;
  z-index: 50;
  pointer-events: none;
  contain: layout style paint;
  overflow: hidden;
}
.file-danmaku-cue {
  position: absolute;
  left: 100%;
  top: calc(10px + var(--lane) * 30px);
  max-width: 80%;
  white-space: nowrap;
  font-size: var(--danmaku-size);
  line-height: 1.2;
  font-weight: 600;
  opacity: calc(var(--danmaku-opacity) * var(--cue-opacity, 1));
  text-shadow:
    1px 1px 2px #000,
    -1px -1px 2px #000,
    0 0 3px #000;
  will-change: transform, opacity;
}
.file-danmaku-cue.mode-top,
.file-danmaku-cue.mode-bottom {
  left: 50%;
}
.file-danmaku-cue.mode-top {
  top: calc(12px + var(--lane) * 30px);
}
.file-danmaku-cue.mode-bottom {
  top: auto;
  bottom: calc(72px + var(--lane) * 30px);
}
.file-danmaku-cue.mode-reverse {
  left: auto;
  right: 100%;
}
.file-danmaku-cue.mode-special {
  left: 50%;
  top: calc(20% + var(--lane) * 24px);
}
</style>
