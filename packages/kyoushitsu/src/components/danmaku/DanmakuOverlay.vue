<script setup lang="ts">
import { t } from "@/i18n"
import { danmakuTrackBottom } from "@/lib/danmaku-track"
import { useBushitsuStore } from "@/stores/bushitsu"
import { computed, onUnmounted, ref, watch } from "vue"

// 弹幕姬 lite: faint realtime DANMAKU bubbles overlaid on the player corner.
// This is a self-owned Vue/CSS overlay, NOT a canvas flying-danmaku
// engine (design §7/§8 deferred). Bubble lifecycle (appear → ~5s → fade/remove)
// lives here as local view state; it never touches the store (state-management).
const bushitsu = useBushitsuStore()

// target = ArtPlayer の $player（原生全屏の対象元素）。指定时把 overlay teleport 进
// 该子树，使其在 原生全屏 / 网页全屏 / 普通模式 下均覆盖播放器；未就绪（mount 前）
// 时 :disabled 让其原地渲染做 fallback，不报错。
// controlsShown：ArtPlayer コントロール条の显隐（親が EnmokuPlayer から下す, prd #3）。
// 気泡トラックの bottom をこれに追従させ、条が出たら遮られないよう上へ、隐れたら底へ。
const props = withDefaults(
  defineProps<{ target?: HTMLElement | null; controlsShown?: boolean; showToggle?: boolean }>(),
  { showToggle: true },
)

// 条が可視のとき上げる／隐れたとき底に寄せる。純関数 danmakuTrackBottom に委譲
// （CSS length 文字列 — 大屏/原生全屏では clamp で控制条上まで抬げる, Bug1）。
// 未指定時は条あり扱い(true)で従来位置を保つ。
const trackBottom = computed(() => danmakuTrackBottom(props.controlsShown ?? true))

// 表示中の気泡: each visible bubble carries its own id + removal timer so we can
// clear them all on unmount.
type Bubble = { id: number; senderId: string; content: string }

const MAX_BUBBLES = 5 // 最近約 N 条
const LIFETIME_MS = 5000 // 約 5s で自動淡出
const FADE_MS = 600 // fade-out transition window before removal

// open/close is pure UI state, kept as a local ref (state-management).
const hyouji = ref(true) // 表示: overlay shown?

const bubbles = ref<Bubble[]>([])
const fading = ref<Set<number>>(new Set())
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let seq = 0

function scheduleRemoval(id: number): void {
  const fadeTimer = setTimeout(() => {
    fading.value.add(id)
    fading.value = new Set(fading.value)
    const dropTimer = setTimeout(() => removeBubble(id), FADE_MS)
    timers.set(id, dropTimer)
  }, LIFETIME_MS)
  timers.set(id, fadeTimer)
}

function removeBubble(id: number): void {
  bubbles.value = bubbles.value.filter((b) => b.id !== id)
  if (fading.value.has(id)) {
    fading.value.delete(id)
    fading.value = new Set(fading.value)
  }
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
}

function pushBubble(senderId: string, content: string): void {
  const id = ++seq
  bubbles.value = [...bubbles.value, { id, senderId, content }].slice(-MAX_BUBBLES)
  scheduleRemoval(id)
}

// New realtime DANMAKU lines surface as bubbles. store.danmaku is server truth
// (read-only); we react to its growth, not mutate it.
watch(
  () => bushitsu.danmaku.length,
  (len, prev) => {
    if (!hyouji.value) return
    for (let i = prev ?? 0; i < len; i++) {
      const line = bushitsu.danmaku[i]
      if (line) pushBubble(line.senderId, line.content)
    }
  },
)

function toggle(): void {
  hyouji.value = !hyouji.value
  if (!hyouji.value) clearAll()
}

function clearAll(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  bubbles.value = []
  fading.value = new Set()
}

onUnmounted(clearAll)
</script>

<template>
  <Teleport :to="props.target" :disabled="!props.target">
    <div class="danmaku-overlay">
      <button
        v-if="props.showToggle"
        type="button"
        class="danmaku-toggle"
        :aria-label="hyouji ? t('danmakuHideAria') : t('danmakuShowAria')"
        :aria-pressed="hyouji"
        @click="toggle"
      >
        {{ hyouji ? t("danmakuOn") : t("danmakuOff") }}
      </button>
      <ul v-if="hyouji" class="danmaku-track" :style="{ bottom: trackBottom }">
        <li
          v-for="b in bubbles"
          :key="b.id"
          class="danmaku-bubble"
          :class="{ fading: fading.has(b.id) }"
        >
          <span class="sender">{{ bushitsu.nicknameOf(b.senderId) }}</span>
          <span class="sep"> · </span>
          <span class="content">{{ b.content }}</span>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<style scoped>
/* pointer-events: none so bubbles never steal player clicks; the toggle re-enables
   itself (accessibility: a real keyboard-reachable button). */
.danmaku-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  /* ArtPlayer 内部控件 z-index 在数十量级；抬到其上，普通与网页全屏下气泡都可见 */
  z-index: 60;
}
.danmaku-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  pointer-events: auto;
  font-size: 11px;
  padding: 2px 8px;
  color: #fff;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
}
.danmaku-track {
  position: absolute;
  left: 12px;
  /* bottom は controlsShown に追従して inline で切替（prd #3）。条の显隐に合わせ
     平滑に上下する。 */
  transition: bottom 0.2s ease;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 60%;
}
.danmaku-bubble {
  /* 很淡: low-key, semi-transparent, small — must not 喧宾夺主 */
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.28);
  padding: 2px 8px;
  border-radius: 10px;
  opacity: 0.7;
  transition: opacity 0.6s ease;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.danmaku-bubble.fading {
  opacity: 0;
}
.sender {
  color: rgba(255, 255, 255, 0.6);
}
</style>
