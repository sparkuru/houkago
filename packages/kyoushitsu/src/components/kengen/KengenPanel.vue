<script setup lang="ts">
import { t } from "@/i18n"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { Kengen, NyuushitsuMode } from "houkago-kousoku"

// 権限設定パネル: host-only switch panel for the three guest permissions
// (prd §4). Thin presentation — it reads the store's current kengen and emits the
// romaji domain verb `settei` with the next snapshot; the parent owns the WS send.
// Mounted only when isBuchou (the parent v-if guards it), so it never shows to a
// guest. Real <button> toggles, keyboard-operable, label + aria-pressed (not color
// alone) per accessibility guidelines.
const bushitsu = useBushitsuStore()
const emit = defineEmits<{
  settei: [kengen: Kengen]
  nyuushitsuSettei: [mode: NyuushitsuMode]
  nyuushitsuHantei: [senderId: string, approved: boolean]
}>()

function toggle(action: keyof Kengen) {
  emit("settei", { ...bushitsu.kengen, [action]: !bushitsu.kengen[action] })
}

function setNyuushitsu(mode: NyuushitsuMode) {
  emit("nyuushitsuSettei", mode)
}
</script>

<template>
  <div class="kengen-panel">
    <div class="kengen-group" role="group" :aria-label="t('guestKengenGroupAria')">
      <button
        type="button"
        :aria-pressed="bushitsu.kengen.playback"
        @click="toggle('playback')"
      >
        {{ t("playbackControl") }} {{ bushitsu.kengen.playback ? t("allowed") : t("blocked") }}
      </button>
      <button
        type="button"
        :aria-pressed="bushitsu.kengen.chat"
        @click="toggle('chat')"
      >
        {{ t("chatPermission") }} {{ bushitsu.kengen.chat ? t("allowed") : t("blocked") }}
      </button>
      <button
        type="button"
        :aria-pressed="bushitsu.kengen.playlist"
        @click="toggle('playlist')"
      >
        {{ t("playlistPermission") }} {{ bushitsu.kengen.playlist ? t("allowed") : t("blocked") }}
      </button>
    </div>
    <div class="kengen-group" role="group" :aria-label="t('nyuushitsuSettingGroupAria')">
      <button
        type="button"
        :aria-pressed="bushitsu.nyuushitsuMode === 'open'"
        @click="setNyuushitsu('open')"
      >
        {{ t("nyuushitsuOpen") }}
      </button>
      <button
        type="button"
        :aria-pressed="bushitsu.nyuushitsuMode === 'approval'"
        @click="setNyuushitsu('approval')"
      >
        {{ t("nyuushitsuApproval") }}
      </button>
      <button
        type="button"
        :aria-pressed="bushitsu.nyuushitsuMode === 'closed'"
        @click="setNyuushitsu('closed')"
      >
        {{ t("nyuushitsuClosedMode") }}
      </button>
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
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.kengen-group {
  display: flex;
  gap: 6px;
}
.kengen-panel button {
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
/* state shown by text + a left bar, not color alone (accessibility) */
.kengen-panel button[aria-pressed="true"] {
  border-left: 3px solid #2a7;
}
.kengen-panel button[aria-pressed="false"] {
  border-left: 3px solid #c44;
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
