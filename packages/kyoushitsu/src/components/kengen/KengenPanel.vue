<script setup lang="ts">
import { t } from "@/i18n"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { KousokuConnectionStatus } from "@/ws/client"
import type { Kengen, NyuushitsuMode } from "houkago-kousoku"
import { computed, onBeforeUnmount, ref } from "vue"

// 権限設定パネル: host-only switch panel for the three guest permissions
// (prd §4). Thin presentation — it reads the store's current kengen and emits the
// romaji domain verb `settei` with the next snapshot; the parent owns the WS send.
// Mounted only when isBuchou (the parent v-if guards it), so it never shows to a
// guest. Real <button> toggles, keyboard-operable, label + aria-pressed (not color
// alone) per accessibility guidelines.
const props = defineProps<{
  roomName: string
  roomLink: string
  roomStatus: KousokuConnectionStatus
}>()
const emit = defineEmits<{
  settei: [kengen: Kengen]
  nyuushitsuSettei: [mode: NyuushitsuMode, password?: string]
  nyuushitsuHantei: [senderId: string, approved: boolean]
}>()
const bushitsu = useBushitsuStore()
const admissionPassword = ref("")
const passwordPlaceholder = ref(t("nyuushitsuModePasswordHint"))
let passwordPromptTimer: ReturnType<typeof setTimeout> | null = null
const roomStatusLabel = computed(() => {
  switch (props.roomStatus) {
    case "connecting":
      return t("roomStatusConnecting")
    case "open":
      return t("roomStatusNormal")
    case "error":
      return t("roomStatusError")
    case "closed":
      return t("roomStatusClosed")
  }
})

function toggle(action: keyof Kengen) {
  emit("settei", { ...bushitsu.kengen, [action]: !bushitsu.kengen[action] })
}

function setNyuushitsu(mode: NyuushitsuMode, password?: string) {
  emit("nyuushitsuSettei", mode, password)
}

function setPasswordNyuushitsu() {
  const password = admissionPassword.value.trim()
  if (!password) {
    showPasswordRequired()
    return
  }
  setNyuushitsu("password", password)
}

function copyText(value: string) {
  const text = value.trim()
  if (!text) {
    showPasswordRequired()
    return
  }
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text))
    return
  }
  fallbackCopyText(text)
}

function fallbackCopyText(text: string) {
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.readOnly = true
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.append(textarea)
  textarea.select()
  document.execCommand("copy")
  textarea.remove()
}

function showPasswordRequired() {
  if (passwordPromptTimer) clearTimeout(passwordPromptTimer)
  passwordPlaceholder.value = t("nyuushitsuPasswordRequired")
  passwordPromptTimer = setTimeout(() => {
    passwordPlaceholder.value = t("nyuushitsuModePasswordHint")
    passwordPromptTimer = null
  }, 1800)
}

onBeforeUnmount(() => {
  if (passwordPromptTimer) clearTimeout(passwordPromptTimer)
})
</script>

<template>
  <div class="kengen-panel">
    <div class="kengen-control-block info">
      <div id="room-info-heading" class="kengen-block-label vertical">
        <span v-for="(char, index) in t('roomInfoHeading')" :key="`${char}-${index}`">
          {{ char }}
        </span>
      </div>
      <section class="kengen-box room-info-box" :aria-labelledby="'room-info-heading'">
        <div class="room-info-row">
          <span class="room-info-key">{{ t("roomInfoName") }}</span>
          <span class="room-info-value" :title="props.roomName">{{ props.roomName }}</span>
        </div>
        <div class="room-info-row">
          <span class="room-info-key">{{ t("roomInfoStatus") }}</span>
          <span class="room-status" :class="props.roomStatus">
            <span class="room-status-dot" aria-hidden="true" />
            <span>{{ roomStatusLabel }}</span>
          </span>
          <span aria-hidden="true" />
        </div>
        <div class="room-info-row">
          <span class="room-info-key">{{ t("roomInfoLink") }}</span>
          <span class="room-info-value link" :title="props.roomLink">{{ props.roomLink }}</span>
          <button
            type="button"
            class="copy-button"
            :aria-label="t('copyRoomLinkAria')"
            :data-tooltip="t('copy')"
            @click="copyText(props.roomLink)"
          >
            <svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="9" width="10" height="10" rx="2" />
              <path d="M5 15V7a2 2 0 0 1 2-2h8" />
            </svg>
          </button>
        </div>
      </section>
    </div>
    <div class="kengen-control-block mode">
      <div id="nyuushitsu-mode-heading" class="kengen-block-label vertical">
        <span v-for="(char, index) in t('nyuushitsuModeHeading')" :key="`${char}-${index}`">
          {{ char }}
        </span>
      </div>
      <section class="kengen-box" :aria-labelledby="'nyuushitsu-mode-heading'">
        <div class="nyuushitsu-options" role="radiogroup" :aria-label="t('nyuushitsuSettingGroupAria')">
          <button
            type="button"
            class="nyuushitsu-option"
            :class="{ selected: bushitsu.nyuushitsuMode === 'open' }"
            role="radio"
            :aria-checked="bushitsu.nyuushitsuMode === 'open'"
            @click="setNyuushitsu('open')"
          >
            <span class="nyuushitsu-mode-title">{{ t("nyuushitsuModeOpen") }}</span>
            <span class="nyuushitsu-mode-desc">{{ t("nyuushitsuModeOpenHint") }}</span>
          </button>
          <button
            type="button"
            class="nyuushitsu-option"
            :class="{ selected: bushitsu.nyuushitsuMode === 'approval' }"
            role="radio"
            :aria-checked="bushitsu.nyuushitsuMode === 'approval'"
            @click="setNyuushitsu('approval')"
          >
            <span class="nyuushitsu-mode-title">{{ t("nyuushitsuModeApproval") }}</span>
            <span class="nyuushitsu-mode-desc">{{ t("nyuushitsuModeApprovalHint") }}</span>
          </button>
          <button
            type="button"
            class="nyuushitsu-option"
            :class="{ selected: bushitsu.nyuushitsuMode === 'closed' }"
            role="radio"
            :aria-checked="bushitsu.nyuushitsuMode === 'closed'"
            @click="setNyuushitsu('closed')"
          >
            <span class="nyuushitsu-mode-title">{{ t("nyuushitsuModeClosed") }}</span>
            <span class="nyuushitsu-mode-desc">{{ t("nyuushitsuModeClosedHint") }}</span>
          </button>
          <div
            class="nyuushitsu-option password"
            :class="{ selected: bushitsu.nyuushitsuMode === 'password' }"
            role="radio"
            :aria-checked="bushitsu.nyuushitsuMode === 'password'"
          >
            <button type="button" class="nyuushitsu-password-trigger" @click="setPasswordNyuushitsu">
              <span class="nyuushitsu-mode-title">{{ t("nyuushitsuModePassword") }}</span>
            </button>
            <div class="nyuushitsu-password-field">
              <input
                v-model="admissionPassword"
                type="text"
                :placeholder="passwordPlaceholder"
                :aria-label="t('nyuushitsuPasswordLabel')"
                @keydown.enter.prevent="setPasswordNyuushitsu"
              />
              <button
                type="button"
                class="copy-button"
                :aria-label="t('copyNyuushitsuPasswordAria')"
                :data-tooltip="t('copy')"
                @click="copyText(admissionPassword)"
              >
                <svg class="copy-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="9" y="9" width="10" height="10" rx="2" />
                  <path d="M5 15V7a2 2 0 0 1 2-2h8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
    <div class="kengen-control-block">
      <div id="guest-kengen-heading" class="kengen-block-label vertical">
        <span v-for="(char, index) in t('guestKengenGroupAria')" :key="`${char}-${index}`">
          {{ char }}
        </span>
      </div>
      <section class="kengen-box" :aria-labelledby="'guest-kengen-heading'">
        <button
          type="button"
          class="kengen-switch-row"
          role="switch"
          :aria-checked="bushitsu.kengen.playback"
          @click="toggle('playback')"
        >
          <span class="kengen-label">{{ t("playbackControl") }}</span>
          <span class="kengen-state-text">{{ bushitsu.kengen.playback ? t("allowed") : t("blocked") }}</span>
          <span class="kengen-switch" :class="{ checked: bushitsu.kengen.playback }" aria-hidden="true">
            <span class="kengen-switch-knob" />
          </span>
        </button>
        <button
          type="button"
          class="kengen-switch-row"
          role="switch"
          :aria-checked="bushitsu.kengen.chat"
          @click="toggle('chat')"
        >
          <span class="kengen-label">{{ t("chatPermission") }}</span>
          <span class="kengen-state-text">{{ bushitsu.kengen.chat ? t("allowed") : t("blocked") }}</span>
          <span class="kengen-switch" :class="{ checked: bushitsu.kengen.chat }" aria-hidden="true">
            <span class="kengen-switch-knob" />
          </span>
        </button>
        <button
          type="button"
          class="kengen-switch-row"
          role="switch"
          :aria-checked="bushitsu.kengen.playlist"
          @click="toggle('playlist')"
        >
          <span class="kengen-label">{{ t("playlistPermission") }}</span>
          <span class="kengen-state-text">{{ bushitsu.kengen.playlist ? t("allowed") : t("blocked") }}</span>
          <span class="kengen-switch" :class="{ checked: bushitsu.kengen.playlist }" aria-hidden="true">
            <span class="kengen-switch-knob" />
          </span>
        </button>
      </section>
    </div>
    <div v-if="bushitsu.pendingNyuushitsu.length > 0" class="pending-list">
      <div v-for="p in bushitsu.pendingNyuushitsu" :key="p.senderId" class="pending-row">
        <span>{{ p.nickname }}</span>
        <button type="button" @click="emit('nyuushitsuHantei', p.senderId, true)">{{ t("approve") }}</button>
        <button type="button" @click="emit('nyuushitsuHantei', p.senderId, false)">{{ t("reject") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kengen-panel {
  --kengen-muted: #666;
  --kengen-text: #222;
  --kengen-accent: #2a7;
  --kengen-danger: #c44;
  --kengen-separator: #e5e5e5;
  --kengen-switch-off: #d9d9d9;
  --kengen-switch-on: #2a7;
  --kengen-knob: #fff;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--kengen-text);
}
:global(.theme-dark) .kengen-panel {
  --kengen-muted: #aaa;
  --kengen-text: #f0f0f0;
  --kengen-accent: #ff8a3d;
  --kengen-danger: #ff7474;
  --kengen-separator: #ff7a22;
  --kengen-switch-off: #0b0b0b;
  --kengen-switch-on: #ff8a3d;
  --kengen-knob: #fff;
}
.kengen-control-block {
  position: relative;
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  width: 100%;
}
.kengen-control-block.mode {
  align-items: start;
}
.kengen-control-block + .kengen-control-block {
  padding-top: 16px;
}
.kengen-control-block + .kengen-control-block::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  content: "";
  background: var(--kengen-separator);
  border-radius: 999px;
}
.kengen-block-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0;
  color: var(--kengen-muted);
  font-size: 12px;
  font-weight: 700;
  word-break: keep-all;
}
.kengen-block-label.vertical {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 0;
  padding: 2px 0;
  line-height: 1.05;
}
.kengen-box {
  display: grid;
  gap: 8px;
  width: 100%;
}
.kengen-box.compact {
  align-content: center;
  min-height: 28px;
}
.room-info-box {
  gap: 6px;
  min-width: 0;
}
.room-info-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 24px;
}
.room-info-key {
  color: var(--kengen-muted);
  font-size: 13px;
}
.room-info-value {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room-info-value.muted,
.room-info-value.link {
  color: var(--kengen-muted);
}
.room-status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  color: var(--kengen-muted);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.room-status.open {
  color: var(--kengen-accent);
}
.room-status.connecting {
  color: #b7791f;
}
.room-status.error,
.room-status.closed {
  color: var(--kengen-danger);
}
.room-status-dot {
  flex: none;
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 50%;
}
.copy-button {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 0;
  color: var(--kengen-muted);
  cursor: pointer;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--kengen-muted) 40%, transparent);
  border-radius: 4px;
}
.copy-button:hover,
.copy-button:focus-visible {
  color: var(--kengen-text);
  border-color: var(--kengen-accent);
}
.copy-button::after {
  position: absolute;
  right: 50%;
  bottom: calc(100% + 6px);
  z-index: 2;
  padding: 2px 6px;
  color: #fff;
  font-size: 12px;
  pointer-events: none;
  content: attr(data-tooltip);
  background: #222;
  border-radius: 4px;
  opacity: 0;
  transform: translateX(50%) translateY(2px);
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.copy-button:hover::after,
.copy-button:focus-visible::after {
  opacity: 1;
  transform: translateX(50%) translateY(0);
}
.copy-icon {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
.copy-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.kengen-switch-row {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) 34px 38px;
  gap: 8px;
  align-items: center;
  min-height: 28px;
  width: 100%;
  padding: 0;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}
.kengen-label {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kengen-state-text {
  justify-self: start;
  color: var(--kengen-muted);
  font-size: 13px;
}
.kengen-switch {
  position: relative;
  justify-self: end;
  box-sizing: border-box;
  width: 34px;
  height: 18px;
  background: var(--kengen-switch-off);
  border: 1px solid color-mix(in srgb, var(--kengen-muted) 28%, transparent);
  border-radius: 999px;
  transition: background-color 0.16s ease;
}
.kengen-switch.checked {
  background: var(--kengen-switch-on);
}
.kengen-switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  background: var(--kengen-knob);
  border-radius: 50%;
  box-shadow: 0 1px 2px rgb(0 0 0 / 20%);
  transition: transform 0.16s ease;
}
.kengen-switch.checked .kengen-switch-knob {
  transform: translateX(16px);
}
.nyuushitsu-options {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.nyuushitsu-option {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  position: relative;
  min-height: 24px;
  padding: 0;
  color: var(--kengen-text);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}
.nyuushitsu-option.disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.nyuushitsu-option.password {
  grid-template-columns: 34px minmax(0, 1fr);
  cursor: default;
}
.nyuushitsu-password-trigger {
  display: inline-flex;
  justify-self: start;
  padding: 0;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
}
.nyuushitsu-password-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  min-width: 0;
}
.nyuushitsu-password-field input {
  min-width: 0;
  height: 24px;
  padding: 2px 6px;
  color: var(--kengen-text);
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--kengen-muted) 40%, transparent);
  border-radius: 4px;
}
.nyuushitsu-mode-title {
  position: relative;
  width: max-content;
  padding-bottom: 4px;
  font-size: 14px;
}
.nyuushitsu-mode-title::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 3px;
  content: "";
  background: transparent;
  border-radius: 999px;
}
.nyuushitsu-option.selected .nyuushitsu-mode-title::after {
  background: var(--kengen-accent);
}
.nyuushitsu-mode-desc {
  min-width: 0;
  overflow: hidden;
  color: var(--kengen-muted);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nyuushitsu-option:focus-visible,
.kengen-switch-row:focus-visible {
  outline: 2px solid var(--kengen-accent);
  outline-offset: 3px;
}
.pending-list {
  display: flex;
  gap: 6px;
  align-items: center;
}
.pending-row {
  display: flex;
  gap: 4px;
  align-items: center;
  padding-left: 6px;
  border-left: 1px solid #ddd;
  font-size: 12px;
}
</style>
