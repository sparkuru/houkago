<script setup lang="ts">
import { t } from "@/i18n"
import { type ChatTheme, nextChatTheme } from "@/lib/chat-theme"
import { formatLastSeen, formatOnlineDuration } from "@/lib/member-presence"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { Yakuwari } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref, watch } from "vue"

// B-station-live-style chat side panel (scaffold shell). Emits the romaji domain
// verb so the parent decides how to send; this component does not own the WS.
const props = defineProps<{ chatTheme: ChatTheme }>()
const bushitsu = useBushitsuStore()
// toggle：折叠要求。親（BushitsuView）が chatHiraku を畳む。ChatPanel は WS も
// 折叠態も自管せず emit で親へ委ねる（component-guidelines）。
const emit = defineEmits<{
  oshaberi: [content: string]
  danmaku: [content: string, options?: { color?: string }]
  toggle: []
  chatTheme: [theme: ChatTheme]
}>()

const panelEl = ref<HTMLElement | null>(null)
const draft = ref("")
const memberPanelOpen = ref(false)
const now = ref(Date.now())
const composerSettingsOpen = ref(false)
const composerFontSize = ref(16)
const composerColor = ref(defaultComposerColor(props.chatTheme))
const composerHeight = ref(168)
let resizeStartY = 0
let resizeStartHeight = 0
let clockTimer: ReturnType<typeof setInterval> | null = null

function defaultComposerColor(theme: "light" | "dark"): string {
  return theme === "dark" ? "#ffffff" : "#222222"
}

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

function toggleChatTheme() {
  const next = nextChatTheme(props.chatTheme)
  if (composerColor.value === defaultComposerColor(props.chatTheme)) {
    composerColor.value = defaultComposerColor(next)
  }
  emit("chatTheme", next)
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

watch(() => props.chatTheme, syncComposerHeightToBounds)

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
  <aside ref="panelEl" class="chat-panel" :class="`theme-${props.chatTheme}`">
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
          class="chat-theme"
          :aria-label="t('chatThemeToggleAria')"
          :aria-pressed="props.chatTheme === 'dark'"
          @click="toggleChatTheme"
        >
          {{ props.chatTheme === "dark" ? "☾" : "☀" }}
        </button>
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
  position: relative;
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  width: 320px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid #ddd;
  background: #fff;
  color: #222;
}
.chat-panel.theme-dark {
  border-left-color: #222;
  background: #111;
  color: #eee;
}
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
}
.theme-dark .chat-head {
  border-bottom-color: #262626;
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
.chat-theme,
.chat-collapse {
  min-width: 24px;
  min-height: 24px;
  padding: 0 6px;
  font-size: 16px;
  line-height: 1;
  color: #888;
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
  color: #222;
}
.theme-dark .member-info-button:hover,
.theme-dark .chat-theme:hover,
.theme-dark .chat-collapse:hover {
  color: #fff;
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
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 10px 26px rgb(0 0 0 / 16%);
}
.theme-dark .member-popover {
  background: #151515;
  border-color: #333;
  box-shadow: 0 12px 28px rgb(0 0 0 / 40%);
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
  color: #888;
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
  border: 1px solid #ccc;
  border-radius: 3px;
}
.member-role.buchou {
  color: #2a7;
  border-color: #2a7;
}
.member-role.kengaku {
  color: #888;
}
.member-empty {
  min-height: 28px;
  color: #888;
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
  background: #fff7e6;
  border: 1px solid #ffd591;
}
.theme-dark .chat-log li.danmaku {
  background: #2a2110;
  border-color: #6a4a18;
}
.chat-meta {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}
.sender {
  color: #888;
}
/* 役割バッジ: 部長/ゲストを軽量に区別。色だけでなくテキストで状態を伝える。 */
.yakuwari {
  margin-left: 4px;
  padding: 0 4px;
  font-size: 11px;
  border-radius: 3px;
  border: 1px solid #ccc;
}
.yakuwari.buchou {
  border-color: #2a7;
  color: #2a7;
}
.yakuwari.kengaku {
  color: #888;
}
.chat-kind {
  padding: 0 5px;
  font-size: 11px;
  color: #ad6800;
  background: #fff1b8;
  border: 1px solid #ffd666;
  border-radius: 999px;
}
.theme-dark .chat-kind {
  color: #ffd666;
  background: #3a2a0c;
  border-color: #805b10;
}
.chat-content {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.chat-readonly {
  margin: 0;
  padding: 8px;
  color: #888;
  border-top: 1px solid #eee;
}
.theme-dark .chat-readonly {
  border-top-color: #262626;
}
.chat-input {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid #eee;
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
  background: #d0d0d0;
  border-radius: 999px;
}
.theme-dark .composer-resizer::before {
  background: #444;
}
.theme-dark .chat-input {
  border-top-color: #262626;
}
.chat-input textarea {
  width: 100%;
  min-height: 0;
  resize: none;
  padding: 8px;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.theme-dark .chat-input textarea {
  background: #191919;
  border-color: #333;
}
.composer-settings {
  display: grid;
  gap: 6px;
  padding: 8px;
  background: #f7f7f7;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
}
.theme-dark .composer-settings {
  background: #181818;
  border-color: #333;
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
</style>
