<script setup lang="ts">
import { t } from "@/i18n"
import { formatLastSeen, formatOnlineDuration } from "@/lib/member-presence"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { Yakuwari } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref } from "vue"

// B-station-live-style chat side panel (scaffold shell). Emits the romaji domain
// verb so the parent decides how to send; this component does not own the WS.
const bushitsu = useBushitsuStore()
// toggle：折叠要求。親（BushitsuView）が chatHiraku を畳む。ChatPanel は WS も
// 折叠態も自管せず emit で親へ委ねる（component-guidelines）。
const emit = defineEmits<{
  oshaberi: [content: string]
  danmaku: [content: string, options?: { color?: string }]
  toggle: []
}>()

const panelEl = ref<HTMLElement | null>(null)
const draft = ref("")
const memberPanelOpen = ref(false)
const now = ref(Date.now())
const composerSettingsOpen = ref(false)
const composerFontSize = ref(16)
const composerColor = ref("#8b5b2d")
const composerHeight = ref(168)
let resizeStartY = 0
let resizeStartHeight = 0
let clockTimer: ReturnType<typeof setInterval> | null = null

function sendOshaberi() {
  const content = draft.value.trim()
  if (!content) return
  emit("oshaberi", content)
  draft.value = ""
}

function sendDanmaku() {
  const content = draft.value.trim()
  if (!content) return
  emit("danmaku", content, { color: composerColor.value })
  draft.value = ""
}

function insertToken(token: string) {
  draft.value = `${draft.value}${draft.value ? " " : ""}${token}`
}

function roleLabel(yakuwari: Yakuwari) {
  return yakuwari === "buchou" ? t("buchouRole") : t("guestRole")
}

function onlineDurationLabel(startedAt: number) {
  return formatOnlineDuration(startedAt, now.value, {
    hour: t("durationHour"),
    minute: t("durationMinute"),
    second: t("durationSecond"),
  })
}

function composerBounds() {
  const panelHeight = panelEl.value?.clientHeight ?? 640
  const min = Math.max(112, Math.round(panelHeight * 0.2))
  const max = Math.max(min, Math.round(panelHeight * 0.4))
  return { min, max }
}

function clampComposerHeight(value: number) {
  const { min, max } = composerBounds()
  return Math.min(max, Math.max(min, value))
}

function syncComposerHeightToBounds() {
  composerHeight.value = clampComposerHeight(composerHeight.value)
}

function resizeComposer(event: PointerEvent) {
  composerHeight.value = clampComposerHeight(resizeStartHeight + resizeStartY - event.clientY)
}

function stopComposerResize() {
  window.removeEventListener("pointermove", resizeComposer)
  window.removeEventListener("pointerup", stopComposerResize)
}

function startComposerResize(event: PointerEvent) {
  resizeStartY = event.clientY
  resizeStartHeight = composerHeight.value
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  window.addEventListener("pointermove", resizeComposer)
  window.addEventListener("pointerup", stopComposerResize)
}

onMounted(() => {
  composerHeight.value = composerBounds().min
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  window.addEventListener("resize", syncComposerHeightToBounds)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  window.removeEventListener("resize", syncComposerHeightToBounds)
  stopComposerResize()
})
</script>

<template>
  <aside ref="panelEl" class="chat-panel">
    <header class="chat-head">
      <div class="chat-presence-summary">
        <span>{{ t("shusseki") }} {{ bushitsu.shusseki }}</span>
        <button
          type="button"
          class="member-info-button"
          :aria-label="t('memberInfoAria')"
          :aria-expanded="memberPanelOpen"
          @click="memberPanelOpen = !memberPanelOpen"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 11a4 4 0 1 0-8 0" />
            <path d="M4 20a6 6 0 0 1 16 0" />
            <path d="M18 8a3 3 0 0 1 2 5" />
          </svg>
        </button>
      </div>
      <div class="chat-head-actions">
        <button
          type="button"
          class="chat-collapse"
          :aria-label="t('chatCollapseAria')"
          @click="emit('toggle')"
        >
          ›
        </button>
      </div>
    </header>
    <section v-if="memberPanelOpen" class="member-popover" :aria-label="t('memberInfoAria')">
      <div class="member-section">
        <h4>{{ t("onlineMembersHeading") }}</h4>
        <div class="member-table member-table-head">
          <span>{{ t("memberName") }}</span>
          <span>{{ t("memberRole") }}</span>
          <span>{{ t("memberOnlineDuration") }}</span>
        </div>
        <div v-if="bushitsu.onlineBuinInfo.length === 0" class="member-empty">
          {{ t("noOnlineMembers") }}
        </div>
        <template v-else>
          <div v-for="member in bushitsu.onlineBuinInfo" :key="member.id" class="member-table">
            <span class="member-name">{{ member.nickname }}</span>
            <span class="member-role" :class="member.yakuwari">{{ roleLabel(member.yakuwari) }}</span>
            <span>{{ onlineDurationLabel(member.joinedAt) }}</span>
          </div>
        </template>
      </div>
      <div class="member-section">
        <h4>{{ t("historyMembersHeading") }}</h4>
        <div class="member-table member-table-head">
          <span>{{ t("memberName") }}</span>
          <span>{{ t("memberRole") }}</span>
          <span>{{ t("memberLastLogin") }}</span>
        </div>
        <div v-if="bushitsu.historyBuinInfo.length === 0" class="member-empty">
          {{ t("noHistoryMembers") }}
        </div>
        <template v-else>
          <div v-for="member in bushitsu.historyBuinInfo" :key="member.id" class="member-table">
            <span class="member-name">{{ member.nickname }}</span>
            <span class="member-role" :class="member.yakuwari">{{ roleLabel(member.yakuwari) }}</span>
            <span>{{ formatLastSeen(member.lastSeenAt) }}</span>
          </div>
        </template>
      </div>
    </section>
    <ul class="chat-log">
      <li v-for="(line, i) in bushitsu.chat" :key="i" :class="{ danmaku: line.kind === 'danmaku' }">
        <div class="chat-meta">
          <span class="sender">{{ bushitsu.nicknameOf(line.senderId) }}</span>
          <span class="yakuwari" :class="bushitsu.yakuwariOf(line.senderId)">
            {{ bushitsu.yakuwariOf(line.senderId) === "buchou" ? t("buchouRole") : t("guestRole") }}
          </span>
          <span v-if="line.kind === 'danmaku'" class="chat-kind">{{ t("chatDanmakuBadge") }}</span>
        </div>
        <p class="chat-content">{{ line.content }}</p>
      </li>
    </ul>
    <!-- 発言権限がない guest は input を隠し「閲覧のみ」を表示 (prd §4)。
         host は canChat 恒 true。服务端も越権 OSHABERI を拒否 (双保険)。 -->
    <form v-if="bushitsu.canChat" class="chat-input" @submit.prevent="sendOshaberi">
      <button
        type="button"
        class="composer-resizer"
        aria-hidden="true"
        tabindex="-1"
        @pointerdown="startComposerResize"
      />
      <textarea
        v-model="draft"
        :aria-label="t('oshaberiLabel')"
        :placeholder="t('messagePlaceholder')"
        :style="{ height: `${composerHeight}px`, fontSize: `${composerFontSize}px`, color: composerColor }"
      />
      <div v-if="composerSettingsOpen" class="composer-settings">
        <label>
          <span>{{ t("chatFontSize") }}</span>
          <input v-model.number="composerFontSize" type="range" min="13" max="22" />
          <output>{{ composerFontSize }}</output>
        </label>
        <label>
          <span>{{ t("chatTextColor") }}</span>
          <input v-model="composerColor" type="color" />
        </label>
      </div>
      <div class="chat-toolbar">
        <button
          type="button"
          :aria-pressed="composerSettingsOpen"
          @click="composerSettingsOpen = !composerSettingsOpen"
        >
          {{ t("chatComposerSettings") }}
        </button>
        <button type="button" @click="insertToken('🙂')">{{ t("chatEmoji") }}</button>
        <button type="button" @click="insertToken('(｡･ω･｡)')">{{ t("chatKaomoji") }}</button>
        <button type="button" class="secondary-send" @click="sendDanmaku">
          {{ t("sendDanmaku") }}
        </button>
        <button type="submit" class="primary-send">{{ t("send") }}</button>
      </div>
    </form>
    <p v-else class="chat-readonly">{{ t("chatReadonly") }}</p>
  </aside>
</template>

<style scoped>
.chat-panel {
  --chat-muted: var(--color-text-muted);
  --chat-border: var(--color-border);
  --chat-surface: var(--color-surface);
  --chat-surface-raised: var(--color-surface-raised);
  --chat-surface-muted: var(--color-surface-muted);
  --chat-accent: var(--color-accent);
  --chat-accent-strong: var(--color-accent-strong);
  --chat-accent-soft: color-mix(in srgb, var(--color-accent) 13%, var(--color-surface));
  position: relative;
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  width: 320px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--chat-border);
  background: var(--chat-surface);
  color: var(--color-text);
}
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  font-weight: bold;
  border-bottom: 1px solid var(--chat-border);
}
.chat-head-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
.chat-presence-summary {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
/* header 右端の小さな折叠ボタン（prd #4 展开態）。中間の粗竖条は廃止。 */
.member-info-button,
.chat-collapse {
  min-width: 24px;
  min-height: 24px;
  padding: 0 6px;
  font-size: 16px;
  line-height: 1;
  color: var(--chat-muted);
  background: transparent;
  border: none;
  cursor: pointer;
}
.member-info-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
.member-info-button:hover,
.chat-collapse:hover {
  color: var(--color-text);
}
.member-popover {
  position: absolute;
  top: 42px;
  right: 8px;
  left: 8px;
  z-index: 5;
  display: grid;
  gap: 10px;
  max-height: min(460px, calc(100% - 58px));
  padding: 10px;
  overflow: auto;
  background: var(--chat-surface);
  border: 1px solid var(--chat-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-floating);
}
.member-section {
  display: grid;
  gap: 6px;
}
.member-section h4 {
  margin: 0;
  font-size: 13px;
}
.member-table {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) 54px minmax(72px, 0.9fr);
  gap: 6px;
  align-items: center;
  min-height: 28px;
  font-size: 12px;
}
.member-table-head {
  color: var(--chat-muted);
}
.member-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-role {
  justify-self: start;
  padding: 0 4px;
  border: 1px solid var(--chat-border);
  border-radius: 3px;
}
.member-role.buchou {
  color: var(--chat-accent-strong);
  border-color: var(--chat-accent);
}
.member-role.kengaku {
  color: var(--chat-muted);
}
.member-empty {
  min-height: 28px;
  color: var(--chat-muted);
  font-size: 12px;
}
.chat-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 8px;
}
.chat-log li {
  padding: 7px 8px;
  border-radius: 8px;
}
.chat-log li + li {
  margin-top: 6px;
}
.chat-log li.danmaku {
  background: var(--chat-accent-soft);
  border: 1px solid color-mix(in srgb, var(--chat-accent) 45%, var(--chat-border));
}
.chat-meta {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}
.sender {
  color: var(--chat-muted);
}
/* 役割バッジ: 部長/ゲストを軽量に区別。色だけでなくテキストで状態を伝える。 */
.yakuwari {
  margin-left: 4px;
  padding: 0 4px;
  font-size: 11px;
  border-radius: 3px;
  border: 1px solid var(--chat-border);
}
.yakuwari.buchou {
  border-color: var(--chat-accent);
  color: var(--chat-accent-strong);
}
.yakuwari.kengaku {
  color: var(--chat-muted);
}
.chat-kind {
  padding: 0 5px;
  font-size: 11px;
  color: var(--chat-accent-strong);
  background: var(--chat-accent-soft);
  border: 1px solid color-mix(in srgb, var(--chat-accent) 50%, var(--chat-border));
  border-radius: 999px;
}
.chat-content {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.chat-readonly {
  margin: 0;
  padding: 8px;
  color: var(--chat-muted);
  border-top: 1px solid var(--chat-border);
}
.chat-input {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid var(--chat-border);
}
.composer-resizer {
  width: 44px;
  height: 10px;
  margin: -2px auto 0;
  padding: 0;
  cursor: ns-resize;
  background: transparent;
  border: none;
}
.composer-resizer::before {
  display: block;
  width: 44px;
  height: 4px;
  margin: 3px 0;
  content: "";
  background: var(--chat-border);
  border-radius: 999px;
}
.chat-input textarea {
  width: 100%;
  min-height: 0;
  resize: none;
  padding: 8px;
  color: var(--color-text);
  background: var(--chat-surface-raised, var(--chat-surface));
  border: 1px solid var(--chat-border);
  border-radius: var(--radius-sm);
}
.composer-settings {
  display: grid;
  gap: 6px;
  padding: 8px;
  background: var(--chat-surface-muted);
  border: 1px solid var(--chat-border);
  border-radius: var(--radius-sm);
}
.composer-settings label {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.composer-settings input[type="color"] {
  width: 42px;
  height: 24px;
  padding: 0;
}
.chat-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.chat-toolbar button {
  min-height: 28px;
  padding: 3px 8px;
}
.secondary-send {
  margin-left: auto;
}
.primary-send {
  font-weight: 600;
}

@media (max-width: 800px) and (orientation: portrait) {
  .chat-panel {
    flex: 0 0 auto;
    width: 100%;
    height: min(48dvh, 440px);
    border-top: 1px solid var(--chat-border);
    border-left: 0;
  }
}
</style>
