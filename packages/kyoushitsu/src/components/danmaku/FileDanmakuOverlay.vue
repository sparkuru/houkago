<script setup lang="ts">
import { visibleFileDanmakuCues } from "@/lib/file-danmaku"
import type { DanmakuCue } from "houkago-kokuban"
import { computed } from "vue"

const props = defineProps<{
  target?: HTMLElement | null
  cues: readonly DanmakuCue[]
  currentTime: number
  enabled: boolean
}>()

const visible = computed(() =>
  props.enabled ? visibleFileDanmakuCues(props.cues, props.currentTime) : [],
)
</script>

<template>
  <Teleport :to="props.target" :disabled="!props.target">
    <div v-if="enabled" class="file-danmaku-overlay" aria-hidden="true">
      <span
        v-for="cue in visible"
        :key="cue.key"
        class="file-danmaku-cue"
        :class="[`mode-${cue.mode}`]"
        :style="{
          '--lane': cue.lane,
          color: cue.color,
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
  inset: 0;
  z-index: 50;
  pointer-events: none;
  overflow: hidden;
}
.file-danmaku-cue {
  position: absolute;
  left: 100%;
  top: calc(10px + var(--lane) * 30px);
  max-width: 80%;
  white-space: nowrap;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 600;
  text-shadow:
    1px 1px 2px #000,
    -1px -1px 2px #000,
    0 0 3px #000;
  animation: file-danmaku-scroll 6s linear forwards;
}
.file-danmaku-cue.mode-top,
.file-danmaku-cue.mode-bottom {
  left: 50%;
  transform: translateX(-50%);
  animation: file-danmaku-fixed 6s linear forwards;
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
  animation-name: file-danmaku-reverse;
}
.file-danmaku-cue.mode-special {
  left: 50%;
  top: calc(20% + var(--lane) * 24px);
  transform: translateX(-50%);
  animation: file-danmaku-fixed 6s linear forwards;
}

@keyframes file-danmaku-scroll {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(calc(-100vw - 100%));
    opacity: 1;
  }
}

@keyframes file-danmaku-reverse {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(calc(100vw + 100%));
    opacity: 1;
  }
}

@keyframes file-danmaku-fixed {
  0% {
    opacity: 0;
  }
  8%,
  88% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
