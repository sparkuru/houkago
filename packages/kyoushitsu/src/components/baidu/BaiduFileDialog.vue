<script setup lang="ts">
import { t } from "@/i18n"
import {
  type BaiduBrowserState,
  baiduBreadcrumbs,
  baiduParentPath,
  formatBaiduFileSize,
} from "@/lib/baidu-provider"
import type { BaiduDirectoryPage, BaiduFileEntry } from "houkago-kousoku"
import { computed, nextTick, ref } from "vue"

const props = withDefaults(
  defineProps<{
    state: BaiduBrowserState
    page: BaiduDirectoryPage | null
    path: string
    selected: BaiduFileEntry | null
    adding?: boolean
    error?: string
  }>(),
  { adding: false, error: "" },
)

const emit = defineEmits<{
  navigate: [path: string]
  select: [entry: BaiduFileEntry]
  add: []
  retry: []
  reconnect: []
  manage: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
let returnFocus: HTMLElement | null = null
const breadcrumbs = computed(() => baiduBreadcrumbs(props.path))
const parentPath = computed(() => baiduParentPath(props.path))

function open(): void {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialog.value?.showModal()
  void nextTick(() => dialog.value?.querySelector<HTMLElement>("button:not(:disabled)")?.focus())
}

function close(): void {
  if (!props.adding) dialog.value?.close()
}

function manageConnection(): void {
  dialog.value?.close()
  emit("manage")
}

function restoreFocus(): void {
  returnFocus?.focus()
  returnFocus = null
}

function activate(entry: BaiduFileEntry): void {
  if (entry.isDirectory) {
    emit("navigate", entry.path)
    return
  }
  if (entry.mediaType === "video") emit("select", entry)
}

defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialog"
    class="baidu-file-dialog"
    aria-labelledby="baidu-files-title"
    @close="restoreFocus"
    @cancel.prevent="close"
  >
    <header>
      <div>
        <p>{{ t("baiduProvider") }}</p>
        <h2 id="baidu-files-title">{{ t("baiduFileBrowserTitle") }}</h2>
      </div>
      <button type="button" class="secondary icon-button" :aria-label="t('providerDialogClose')" @click="close">×</button>
    </header>

    <nav class="breadcrumbs" :aria-label="t('baiduBreadcrumbAria')">
      <button
        type="button"
        class="secondary back-button"
        :disabled="parentPath === null || state === 'loading'"
        @click="parentPath && emit('navigate', parentPath)"
      >
        {{ t("baiduBack") }}
      </button>
      <ol>
        <li v-for="crumb in breadcrumbs" :key="crumb.path">
          <button type="button" class="crumb" :disabled="crumb.path === path || state === 'loading'" @click="emit('navigate', crumb.path)">
            {{ crumb.label }}
          </button>
        </li>
      </ol>
    </nav>

    <main aria-live="polite">
      <div v-if="state === 'loading' || state === 'idle'" class="browser-state" role="status">
        <span class="spinner" aria-hidden="true" />
        <p>{{ t("baiduDirectoryLoading") }}</p>
      </div>
      <div v-else-if="state === 'disconnected'" class="browser-state">
        <h3>{{ t("baiduAdapterDisconnectedTitle") }}</h3>
        <p>{{ t("baiduAdapterDisconnected") }}</p>
        <button type="button" @click="emit('reconnect')">{{ t("baiduReconnect") }}</button>
      </div>
      <div v-else-if="state === 'expired'" class="browser-state">
        <h3>{{ t("baiduReconnectRequiredTitle") }}</h3>
        <p>{{ t("baiduReconnectRequired") }}</p>
        <button type="button" @click="emit('reconnect')">{{ t("baiduReconnect") }}</button>
      </div>
      <div v-else-if="state === 'error'" class="browser-state error" role="alert">
        <h3>{{ t("baiduDirectoryErrorTitle") }}</h3>
        <p>{{ error || t("baiduDirectoryError") }}</p>
        <button type="button" @click="emit('retry')">{{ t("retry") }}</button>
      </div>
      <div v-else-if="state === 'success'" class="browser-state" role="status">
        <h3>{{ t("baiduFileAdded") }}</h3>
        <p>{{ selected?.name }}</p>
        <button type="button" @click="close">{{ t("providerDialogClose") }}</button>
      </div>
      <div v-else-if="!page || page.entries.length === 0" class="browser-state">
        <h3>{{ t("baiduDirectoryEmptyTitle") }}</h3>
        <p>{{ t("baiduDirectoryEmpty") }}</p>
      </div>
      <ul v-else class="file-list" :aria-label="t('baiduDirectoryEntries')">
        <li v-for="entry in page.entries" :key="entry.id">
          <button
            type="button"
            class="file-row"
            :class="{ selected: selected?.id === entry.id }"
            :disabled="!entry.isDirectory && entry.mediaType !== 'video'"
            :aria-pressed="!entry.isDirectory ? selected?.id === entry.id : undefined"
            @click="activate(entry)"
          >
            <span class="file-kind" aria-hidden="true">{{ entry.isDirectory ? "▸" : "▶" }}</span>
            <span class="file-name">{{ entry.name }}</span>
            <span class="file-meta">
              <span v-if="entry.size !== undefined">{{ formatBaiduFileSize(entry.size) }}</span>
              <span v-if="!entry.isDirectory && entry.mediaType !== 'video'">{{ t("baiduUnsupportedFile") }}</span>
            </span>
          </button>
        </li>
      </ul>
    </main>

    <footer>
      <p class="selection" aria-live="polite">
        {{ selected ? `${t("baiduSelectedFile")}: ${selected.name}` : t("baiduNoFileSelected") }}
      </p>
      <div class="actions">
        <button type="button" class="secondary" @click="manageConnection">
          {{ t("baiduManageConnection") }}
        </button>
        <button type="button" class="secondary" :disabled="adding" @click="close">{{ t("cancel") }}</button>
        <button type="button" :disabled="!selected || adding || state !== 'ready'" @click="emit('add')">
          {{ adding ? t("sourceAdding") : t("baiduAddSelected") }}
        </button>
      </div>
    </footer>
  </dialog>
</template>

<style scoped>
.baidu-file-dialog { width: min(760px, calc(100vw - 32px)); height: min(720px, calc(100dvh - 32px)); padding: 0; overflow: hidden; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-border-strong); border-radius: var(--radius-lg); box-shadow: var(--shadow-floating); }
.baidu-file-dialog[open] { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; }
.baidu-file-dialog::backdrop { background: var(--color-overlay); }
header, footer { display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); }
header { border-bottom: 1px solid var(--color-border); }
header p, h2, h3, .browser-state p, .selection { margin: 0; }
header p { margin-bottom: var(--space-1); color: var(--color-accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
h2 { font-size: 22px; }
.icon-button { width: 44px; min-width: 44px; padding: 0; font-size: 22px; }
.breadcrumbs { display: flex; gap: var(--space-2); align-items: center; min-width: 0; padding: var(--space-2) var(--space-5); background: var(--color-surface-muted); border-bottom: 1px solid var(--color-border); }
.breadcrumbs ol { display: flex; gap: var(--space-1); min-width: 0; margin: 0; padding: 0; overflow-x: auto; list-style: none; }
.crumb { min-width: 44px; color: var(--color-accent); background: transparent; border-color: transparent; }
main { min-height: 0; overflow: auto; }
.browser-state { display: grid; gap: var(--space-3); place-items: center; align-content: center; min-height: 260px; padding: var(--space-5); text-align: center; color: var(--color-text-muted); }
.browser-state.error { color: var(--color-danger); }
.spinner { width: 28px; height: 28px; border: 3px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; }
.file-list { margin: 0; padding: var(--space-2); list-style: none; }
.file-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: var(--space-2); align-items: center; width: 100%; min-height: 48px; padding: var(--space-2) var(--space-3); color: var(--color-text); text-align: left; background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm); cursor: pointer; }
.file-row:hover:not(:disabled), .file-row.selected { background: var(--color-surface-muted); border-color: var(--color-border); }
.file-row.selected { border-color: var(--color-accent); }
.file-row:disabled { cursor: not-allowed; opacity: 0.5; }
.file-kind { color: var(--color-accent); text-align: center; }
.file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-meta { display: grid; gap: 2px; color: var(--color-text-muted); font-size: 12px; text-align: right; }
footer { align-items: flex-end; border-top: 1px solid var(--color-border); }
.selection { min-width: 0; overflow-wrap: anywhere; color: var(--color-text-muted); font-size: 13px; }
.actions { display: flex; flex: none; gap: var(--space-2); }
button { min-height: 44px; padding: 8px 14px; color: var(--color-on-accent); background: var(--color-accent); border: 1px solid var(--color-accent); border-radius: var(--radius-sm); cursor: pointer; }
button.secondary { color: var(--color-text); background: var(--color-surface); border-color: var(--color-border); }
button:disabled { cursor: not-allowed; opacity: 0.5; }
@media (prefers-reduced-motion: no-preference) { .spinner { animation: spin 800ms linear infinite; } }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 560px) {
  .baidu-file-dialog { width: calc(100vw - 16px); height: calc(100dvh - 16px); }
  header, footer, .breadcrumbs { padding-inline: var(--space-3); }
  footer { align-items: stretch; flex-direction: column; }
  .actions button { flex: 1; }
  .file-row { grid-template-columns: 28px minmax(0, 1fr); }
  .file-meta { grid-column: 2; text-align: left; }
}
</style>
