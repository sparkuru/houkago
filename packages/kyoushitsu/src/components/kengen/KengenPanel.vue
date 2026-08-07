<script setup lang="ts">
import { t } from "@/i18n"
import { KENGEN_PRESETS, kengenPresetId } from "@/lib/kengen-policy"
import { formatLastSeen, formatOnlineDuration } from "@/lib/member-presence"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { KousokuConnectionStatus } from "@/ws/client"
import type { Kengen, MeiboBuin, NyuushitsuMode, NyuushitsuStatus, Yakuwari } from "houkago-kousoku"
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

// 房間情報 + host-only settings. All viewers need the connection/status block;
// only the host sees controls that emit room-setting messages.
const props = defineProps<{
  roomName: string
  roomLink: string
  roomStatus: KousokuConnectionStatus
  kengenPending: boolean
  kengenError: string
  removeBuin: (seitoId: string) => Promise<boolean>
}>()
const emit = defineEmits<{
  settei: [kengen: Kengen]
  nyuushitsuSettei: [mode: NyuushitsuMode, password?: string]
  nyuushitsuHantei: [senderId: string, approved: boolean]
  reconnect: []
}>()
const bushitsu = useBushitsuStore()
const admissionPassword = ref("")
const passwordPlaceholder = ref(t("nyuushitsuModePasswordHint"))
const now = ref(Date.now())
let passwordPromptTimer: ReturnType<typeof setTimeout> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
const removeDialog = ref<HTMLDialogElement | null>(null)
const selectedBuin = ref<MeiboBuin | null>(null)
const removingBuin = ref(false)
const removeError = ref("")
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
const canRetryConnection = computed(
  () => props.roomStatus === "closed" || props.roomStatus === "error",
)

function nyuushitsuModeLabel(mode: NyuushitsuMode) {
  switch (mode) {
    case "open":
      return t("nyuushitsuModeOpen")
    case "approval":
      return t("nyuushitsuModeApproval")
    case "closed":
      return t("nyuushitsuModeClosed")
    case "password":
      return t("nyuushitsuModePassword")
  }
}

function nyuushitsuStatusLabel(status: NyuushitsuStatus | "idle") {
  switch (status) {
    case "idle":
      return t("nyuushitsuStatusIdle")
    case "entered":
      return t("nyuushitsuStatusEntered")
    case "waiting":
      return t("nyuushitsuStatusWaiting")
    case "rejected":
      return t("nyuushitsuStatusRejected")
    case "closed":
      return t("nyuushitsuStatusClosed")
    case "revoked":
      return t("nyuushitsuStatusRevoked")
  }
}

function roleLabel(yakuwari: Yakuwari) {
  return yakuwari === "buchou" ? t("buchouRole") : t("memberYakuwari")
}

function onlineDurationLabel(startedAt: number) {
  return formatOnlineDuration(startedAt, now.value, {
    hour: t("durationHour"),
    minute: t("durationMinute"),
    second: t("durationSecond"),
  })
}

function toggle(action: keyof Kengen) {
  if (props.kengenPending) return
  emit("settei", { ...bushitsu.kengen, [action]: !bushitsu.kengen[action] })
}

const selectedKengenPreset = computed(() => kengenPresetId(bushitsu.kengen))
const policySummaryLabel = computed(() => {
  switch (selectedKengenPreset.value) {
    case "chat":
      return t("kengenPresetChat")
    case "playback":
      return t("kengenPresetPlayback")
    case "playlist":
      return t("kengenPresetPlaylist")
    default:
      return t("kengenPresetCustom")
  }
})
const policySummaryDetail = computed(() =>
  [
    `${t("chatPermission")}：${bushitsu.kengen.chat ? t("allowed") : t("blocked")}`,
    `${t("playbackControl")}：${bushitsu.kengen.playback ? t("allowed") : t("blocked")}`,
    `${t("playlistPermission")}：${bushitsu.kengen.playlist ? t("allowed") : t("blocked")}`,
  ].join(" · "),
)

function selectKengenPreset(id: (typeof KENGEN_PRESETS)[number]["id"]) {
  if (props.kengenPending || selectedKengenPreset.value === id) return
  const preset = KENGEN_PRESETS.find((item) => item.id === id)
  if (preset) emit("settei", { ...preset.kengen })
}

function presetLabel(id: (typeof KENGEN_PRESETS)[number]["id"]) {
  switch (id) {
    case "chat":
      return t("kengenPresetChat")
    case "playback":
      return t("kengenPresetPlayback")
    case "playlist":
      return t("kengenPresetPlaylist")
  }
}

function presetDescription(id: (typeof KENGEN_PRESETS)[number]["id"]) {
  switch (id) {
    case "chat":
      return t("kengenPresetChatHint")
    case "playback":
      return t("kengenPresetPlaybackHint")
    case "playlist":
      return t("kengenPresetPlaylistHint")
  }
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

function requestRemove(member: MeiboBuin) {
  selectedBuin.value = member
  removeError.value = ""
  removeDialog.value?.showModal()
}

async function confirmRemove() {
  if (!selectedBuin.value || removingBuin.value) return
  removingBuin.value = true
  removeError.value = ""
  try {
    if (await props.removeBuin(selectedBuin.value.id)) {
      removeDialog.value?.close()
      selectedBuin.value = null
      return
    }
    removeError.value = t("removeMemberFailed")
  } catch {
    removeError.value = t("removeMemberFailed")
  } finally {
    removingBuin.value = false
  }
}

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (passwordPromptTimer) clearTimeout(passwordPromptTimer)
  if (clockTimer) clearInterval(clockTimer)
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
          <button
            v-if="canRetryConnection"
            type="button"
            class="copy-button"
            :aria-label="t('retryConnectionAria')"
            :data-tooltip="t('retryConnection')"
            @click="emit('reconnect')"
          >
            <svg class="retry-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.3-5.7" />
              <path d="M20 4v6h-6" />
            </svg>
          </button>
          <span v-else aria-hidden="true" />
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
    <div class="kengen-control-block admission">
      <div id="admission-info-heading" class="kengen-block-label vertical">
        <span v-for="(char, index) in t('roomAdmissionHeading')" :key="`${char}-${index}`">
          {{ char }}
        </span>
      </div>
      <section class="kengen-box room-info-box" :aria-labelledby="'admission-info-heading'">
        <div class="room-info-row">
          <span class="room-info-key">{{ t("roomInfoAdmissionMode") }}</span>
          <span class="room-info-value">{{ nyuushitsuModeLabel(bushitsu.nyuushitsuMode) }}</span>
          <span aria-hidden="true" />
        </div>
        <div class="room-info-row">
          <span class="room-info-key">{{ t("roomInfoAdmissionStatus") }}</span>
          <span class="room-info-value">{{ nyuushitsuStatusLabel(bushitsu.nyuushitsuStatus) }}</span>
          <span aria-hidden="true" />
        </div>
        <div v-if="bushitsu.isBuchou" class="room-info-row">
          <span class="room-info-key">{{ t("roomInfoPending") }}</span>
          <span class="room-info-value">{{ bushitsu.pendingNyuushitsu.length }}</span>
          <span aria-hidden="true" />
        </div>
      </section>
    </div>
    <div class="kengen-control-block members">
      <div id="member-info-heading" class="kengen-block-label vertical">
        <span v-for="(char, index) in t('roomMembersHeading')" :key="`${char}-${index}`">
          {{ char }}
        </span>
      </div>
      <section class="kengen-box member-info-box" :aria-labelledby="'member-info-heading'">
        <div class="member-list-block">
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
        <div class="member-list-block">
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
        <div v-if="bushitsu.isBuchou" class="member-list-block">
          <h4>{{ t("durableMembersHeading") }}</h4>
          <div v-if="bushitsu.meibo.length === 0" class="member-empty">{{ t("noDurableMembers") }}</div>
          <div v-for="member in bushitsu.meibo" :key="member.id" class="member-table member-table-action">
            <span class="member-name">{{ member.username }}</span>
            <span class="member-role" :class="member.yakuwari">{{ roleLabel(member.yakuwari) }}</span>
            <button
              v-if="member.yakuwari !== 'buchou'"
              type="button"
              class="remove-member"
              :aria-label="`${t('removeMemberAria')} ${member.username}`"
              :disabled="removingBuin"
              @click="requestRemove(member)"
            >{{ t("removeMember") }}</button>
          </div>
        </div>
      </section>
    </div>
    <div v-if="bushitsu.isBuchou" class="kengen-control-block mode">
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
    <div class="kengen-control-block policy">
      <div id="guest-kengen-heading" class="kengen-block-label vertical">
        <span v-for="(char, index) in t('guestKengenGroupAria')" :key="`${char}-${index}`">
          {{ char }}
        </span>
      </div>
      <section class="kengen-box" :aria-labelledby="'guest-kengen-heading'">
        <div class="kengen-policy-summary" aria-live="polite">
          <span class="kengen-policy-summary-label">{{ t("kengenPolicyCurrent") }}</span>
          <strong>{{ policySummaryLabel }}</strong>
          <span>{{ policySummaryDetail }}</span>
        </div>
        <template v-if="bushitsu.isBuchou">
          <p v-if="props.kengenPending" class="kengen-policy-notice" role="status">
            {{ t("kengenSaving") }}
          </p>
          <p v-if="props.kengenError" class="kengen-policy-error" role="alert">{{ props.kengenError }}</p>
          <div
            class="kengen-preset-options"
            role="radiogroup"
            :aria-label="t('kengenPresetGroupAria')"
            :aria-describedby="selectedKengenPreset === null ? 'kengen-policy-feedback' : undefined"
          >
            <button
              v-for="preset in KENGEN_PRESETS"
              :key="preset.id"
              type="button"
              class="kengen-preset-option"
              :class="{ selected: selectedKengenPreset === preset.id }"
              role="radio"
              :aria-checked="selectedKengenPreset === preset.id"
              :disabled="props.kengenPending"
              @click="selectKengenPreset(preset.id)"
            >
              <span class="kengen-preset-title">{{ presetLabel(preset.id) }}</span>
              <span class="kengen-preset-description">{{ presetDescription(preset.id) }}</span>
            </button>
          </div>
          <p
            v-if="selectedKengenPreset === null"
            class="kengen-policy-custom"
            id="kengen-policy-feedback"
          >
            {{ t("kengenPolicyCustomNotice") }}
          </p>
          <details class="kengen-advanced">
            <summary>{{ t("kengenAdvancedSettings") }}</summary>
            <div class="kengen-advanced-controls">
              <button
                type="button"
                class="kengen-switch-row"
                role="switch"
                :aria-checked="bushitsu.kengen.playback"
                :disabled="props.kengenPending"
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
                :disabled="props.kengenPending"
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
                :disabled="props.kengenPending"
                @click="toggle('playlist')"
              >
                <span class="kengen-label">{{ t("playlistPermission") }}</span>
                <span class="kengen-state-text">{{ bushitsu.kengen.playlist ? t("allowed") : t("blocked") }}</span>
                <span class="kengen-switch" :class="{ checked: bushitsu.kengen.playlist }" aria-hidden="true">
                  <span class="kengen-switch-knob" />
                </span>
              </button>
            </div>
          </details>
        </template>
      </section>
    </div>
    <div v-if="bushitsu.isBuchou && bushitsu.pendingNyuushitsu.length > 0" class="pending-list">
      <div v-for="p in bushitsu.pendingNyuushitsu" :key="p.senderId" class="pending-row">
        <span>{{ p.nickname }}</span>
        <button type="button" @click="emit('nyuushitsuHantei', p.senderId, true)">{{ t("approve") }}</button>
        <button type="button" @click="emit('nyuushitsuHantei', p.senderId, false)">{{ t("reject") }}</button>
      </div>
    </div>
  </div>
  <dialog ref="removeDialog" class="remove-dialog" :aria-label="t('removeMemberTitle')">
    <p>{{ t("removeMemberTitle") }}</p>
    <p>{{ selectedBuin?.username }}：{{ t("removeMemberNotice") }}</p>
    <p v-if="removeError" class="remove-error" role="alert">{{ removeError }}</p>
    <div class="remove-dialog-actions">
      <button type="button" class="secondary-button" :disabled="removingBuin" @click="removeDialog?.close()">{{ t("cancel") }}</button>
      <button type="button" class="remove-member" :disabled="removingBuin" @click="confirmRemove">{{ t("removeMemberConfirm") }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.kengen-panel {
  --kengen-muted: var(--color-text-muted);
  --kengen-text: var(--color-text);
  --kengen-accent: var(--color-accent);
  --kengen-danger: var(--color-danger);
  --kengen-separator: var(--color-border);
  --kengen-switch-off: var(--color-surface-muted);
  --kengen-switch-on: var(--color-accent);
  --kengen-knob: var(--color-on-accent);
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--kengen-text);
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
  color: var(--color-warning);
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
  color: var(--color-tooltip-text);
  font-size: 12px;
  pointer-events: none;
  content: attr(data-tooltip);
  background: var(--color-tooltip-surface);
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
.copy-icon,
.retry-icon {
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
.member-info-box {
  gap: 12px;
  min-width: 0;
}
.member-list-block {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.member-list-block h4 {
  margin: 0;
  color: var(--kengen-text);
  font-size: 13px;
  font-weight: 700;
}
.member-table {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px minmax(64px, auto);
  gap: 6px;
  align-items: center;
  min-width: 0;
  min-height: 22px;
  color: var(--kengen-text);
  font-size: 12px;
}
.member-table > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-table-head {
  color: var(--kengen-muted);
  font-weight: 700;
}
.member-table-action { grid-template-columns: minmax(0, 1fr) 42px auto; }
.remove-member { min-height: 44px; padding: 4px 8px; color: var(--color-on-accent); background: var(--color-danger); border: 0; border-radius: 6px; cursor: pointer; }
.remove-member:disabled { cursor: wait; opacity: 0.7; }
.remove-dialog { max-width: min(360px, calc(100vw - 32px)); color: var(--kengen-text); background: var(--color-surface); border: 1px solid var(--kengen-border); border-radius: 12px; }
.remove-dialog::backdrop { background: rgb(0 0 0 / 45%); }
.remove-dialog-actions { display: flex; justify-content: end; gap: 8px; }
.remove-error { color: var(--color-danger); }
.member-name {
  font-weight: 600;
}
.member-role {
  justify-self: start;
  color: var(--kengen-muted);
}
.member-role.buchou {
  color: var(--kengen-accent);
}
.member-empty {
  min-height: 22px;
  color: var(--kengen-muted);
  font-size: 12px;
}
.kengen-switch-row {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) 34px 38px;
  gap: 8px;
  align-items: center;
  min-height: 44px;
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
.kengen-policy-summary {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 10px;
  color: var(--kengen-muted);
  font-size: 13px;
  background: var(--color-surface-muted);
  border-radius: 8px;
}
.kengen-policy-summary-label {
  font-size: 12px;
}
.kengen-policy-summary strong {
  color: var(--kengen-text);
  font-size: 15px;
}
.kengen-policy-notice,
.kengen-policy-error,
.kengen-policy-custom {
  margin: 0;
  font-size: 13px;
}
.kengen-policy-notice,
.kengen-policy-custom {
  color: var(--kengen-muted);
}
.kengen-policy-error {
  color: var(--kengen-danger);
}
.kengen-preset-options {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.kengen-preset-option {
  display: grid;
  gap: 2px;
  min-width: 0;
  min-height: 44px;
  padding: 8px 10px;
  color: var(--kengen-text);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--kengen-separator);
  border-radius: 8px;
}
.kengen-preset-option.selected {
  border-color: var(--kengen-accent);
  box-shadow: inset 3px 0 0 var(--kengen-accent);
}
.kengen-preset-option:disabled,
.kengen-switch-row:disabled {
  cursor: wait;
  opacity: 0.65;
}
.kengen-preset-title {
  font-size: 14px;
  font-weight: 700;
}
.kengen-preset-description {
  overflow: hidden;
  color: var(--kengen-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kengen-advanced {
  min-width: 0;
  padding-top: 2px;
}
.kengen-advanced summary {
  min-height: 44px;
  color: var(--kengen-text);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  line-height: 44px;
}
.kengen-advanced-controls {
  display: grid;
  gap: 4px;
  padding-top: 4px;
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
.kengen-switch-row:focus-visible,
.kengen-preset-option:focus-visible,
.kengen-advanced summary:focus-visible {
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
  border-left: 1px solid var(--kengen-separator);
  font-size: 12px;
}
@media (max-width: 800px) and (orientation: portrait) {
  .kengen-policy-summary {
    overflow-wrap: anywhere;
  }
  .kengen-preset-description {
    overflow: visible;
    text-overflow: clip;
    white-space: normal;
  }
}
</style>
