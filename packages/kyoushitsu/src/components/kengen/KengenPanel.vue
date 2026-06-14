<script setup lang="ts">
import { useBushitsuStore } from "@/stores/bushitsu"
import type { Kengen } from "houkago-kousoku"

// 権限設定パネル: host-only switch panel for the three guest permissions
// (prd §4). Thin presentation — it reads the store's current kengen and emits the
// romaji domain verb `settei` with the next snapshot; the parent owns the WS send.
// Mounted only when isBuchou (the parent v-if guards it), so it never shows to a
// guest. Real <button> toggles, keyboard-operable, label + aria-pressed (not color
// alone) per accessibility guidelines.
const bushitsu = useBushitsuStore()
const emit = defineEmits<{ settei: [kengen: Kengen] }>()

function toggle(action: keyof Kengen) {
  emit("settei", { ...bushitsu.kengen, [action]: !bushitsu.kengen[action] })
}
</script>

<template>
  <div class="kengen-panel" role="group" aria-label="ゲスト権限">
    <button
      type="button"
      :aria-pressed="bushitsu.kengen.playback"
      @click="toggle('playback')"
    >
      再生制御 {{ bushitsu.kengen.playback ? "許可" : "禁止" }}
    </button>
    <button
      type="button"
      :aria-pressed="bushitsu.kengen.chat"
      @click="toggle('chat')"
    >
      発言 {{ bushitsu.kengen.chat ? "許可" : "禁止" }}
    </button>
    <button
      type="button"
      :aria-pressed="bushitsu.kengen.playlist"
      @click="toggle('playlist')"
    >
      ソース選択 {{ bushitsu.kengen.playlist ? "許可" : "禁止" }}
    </button>
  </div>
</template>

<style scoped>
.kengen-panel {
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
</style>
