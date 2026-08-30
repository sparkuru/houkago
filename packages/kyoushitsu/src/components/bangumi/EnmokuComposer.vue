<script setup lang="ts">
import BaiduConnectionDialog from "@/components/baidu/BaiduConnectionDialog.vue"
import BaiduFileDialog from "@/components/baidu/BaiduFileDialog.vue"
import { useBaiduSource } from "@/composables/useBaiduSource"
import { useEnmokuPreview } from "@/composables/useEnmokuPreview"
import { t } from "@/i18n"
import type { BaiduRetentionMode } from "houkago-kousoku"
import { computed, nextTick, ref, watch } from "vue"

const props = defineProps<{ bushitsuId: string; canPlaylist: boolean }>()
const emit = defineEmits<{ jouei: [enmokuId: string] }>()

const open = ref(false)
const baiduConnectionDialog = ref<{ open: () => void; close: () => void } | null>(null)
const baiduFileDialog = ref<{ open: () => void; close: () => void } | null>(null)
const { sourceUrl, title, preview, error, resolving, submitting, resolve, add, reset, edit } =
  useEnmokuPreview(props.bushitsuId)
const baidu = useBaiduSource(props.bushitsuId)
const errorMessage = computed(() => (error.value ? t(error.value) : ""))

function close(): void {
  open.value = false
  reset()
}

function collapse(): void {
  open.value = false
}

async function queue(): Promise<void> {
  if (!props.canPlaylist) return
  const enmoku = await add()
  if (enmoku) close()
}

async function queueAndJouei(): Promise<void> {
  if (!props.canPlaylist) return
  const enmoku = await add()
  if (!enmoku) return
  emit("jouei", enmoku.id)
  close()
}

async function openBaiduSource(): Promise<void> {
  if (!props.canPlaylist) return
  await baidu.refresh()
  if (baidu.status.value?.connected && baidu.clientState.value === "ready") {
    baiduFileDialog.value?.open()
    await baidu.loadDirectory("/")
    return
  }
  baiduConnectionDialog.value?.open()
}

async function authorizeBaidu(mode: BaiduRetentionMode): Promise<void> {
  await baidu.authorize(mode)
}

async function refreshBaiduConnection(): Promise<void> {
  await baidu.refresh()
}

async function revokeBaidu(): Promise<void> {
  await baidu.revoke()
}

async function reconnectBaidu(): Promise<void> {
  baiduFileDialog.value?.close()
  await baidu.refresh()
  baiduConnectionDialog.value?.open()
}

async function manageBaiduConnection(): Promise<void> {
  baiduFileDialog.value?.close()
  await nextTick()
  await baidu.refresh()
  baiduConnectionDialog.value?.open()
}

watch(
  () => props.canPlaylist,
  (allowed) => {
    if (allowed) return
    open.value = false
    baiduFileDialog.value?.close()
  },
)
</script>

<template>
  <section
    class="enmoku-composer"
    :class="{ open }"
    :aria-busy="resolving || submitting ? 'true' : undefined"
  >
    <div v-if="!open" class="composer-launchers">
      <button
        v-if="canPlaylist"
        type="button"
        class="composer-launch primary"
        :aria-expanded="open"
        @click="open = true"
      >
        {{ t("sourceAddLink") }}
      </button>
      <button
        v-if="canPlaylist"
        type="button"
        class="composer-launch secondary"
        @click="openBaiduSource"
      >
        {{ t("baiduBrowse") }}
      </button>
      <button type="button" class="composer-launch quiet" @click="manageBaiduConnection">
        {{ t("baiduConnectionManager") }}
      </button>
    </div>
    <form v-else @submit.prevent="resolve" @keydown.esc.prevent="collapse">
      <div class="composer-head">
        <h4>{{ t("sourceAddHeading") }}</h4>
        <button
          type="button"
          class="composer-close quiet"
          :aria-label="t('sourceComposerCloseAria')"
          @click="close"
        >
          ×
        </button>
      </div>
      <label>
        <span>{{ t("sourceUrlLabel") }}</span>
        <input
          v-model="sourceUrl"
          type="url"
          inputmode="url"
          autocomplete="url"
          :placeholder="t('sourceUrlPlaceholder')"
          :readonly="Boolean(preview)"
          :disabled="resolving || submitting"
          required
        />
      </label>
      <label>
        <span>{{ t("sourceTitleLabel") }}</span>
        <input
          v-model="title"
          type="text"
          :placeholder="t('sourceTitlePlaceholder')"
          :readonly="Boolean(preview)"
          :disabled="resolving || submitting"
        />
      </label>
      <p class="composer-hint">{{ t("sourcePublicHint") }}</p>
      <p v-if="errorMessage" class="composer-error" role="alert">{{ errorMessage }}</p>
      <section v-if="preview" class="source-preview" :aria-label="t('sourcePreviewHeading')">
        <strong>{{ preview.title }}</strong>
        <span>{{ preview.type.toUpperCase() }}</span>
        <small v-if="preview.provider">{{ t("sourceProviderPrefix") }} {{ preview.provider.kind }}</small>
      </section>
      <div class="composer-actions">
        <button
          v-if="!preview"
          type="submit"
          class="primary"
          :disabled="resolving || !sourceUrl.trim()"
        >
          {{ resolving ? t("sourceResolving") : t("sourceResolve") }}
        </button>
        <template v-else>
          <button type="button" class="primary" :disabled="submitting" @click="queue">
            {{ submitting ? t("sourceAdding") : t("sourceAddQueue") }}
          </button>
          <button type="button" class="secondary" :disabled="submitting" @click="queueAndJouei">
            {{ t("sourceAddAndSwitch") }}
          </button>
          <button type="button" class="quiet" :disabled="submitting" @click="edit">
            {{ t("sourceEdit") }}
          </button>
        </template>
      </div>
    </form>
    <BaiduConnectionDialog
      ref="baiduConnectionDialog"
      :client-state="baidu.clientState.value"
      :status="baidu.status.value"
      :loading="baidu.connectionLoading.value"
      :error="baidu.connectionError.value"
      @detect="baidu.detectAdapter"
      @authorize="authorizeBaidu"
      @revoke="revokeBaidu"
      @refresh="refreshBaiduConnection"
    />
    <BaiduFileDialog
      ref="baiduFileDialog"
      :state="baidu.browserState.value"
      :page="baidu.directoryPage.value"
      :path="baidu.directoryPath.value"
      :selected="baidu.selectedFile.value"
      :adding="baidu.adding.value"
      :error="baidu.browserError.value"
      @navigate="baidu.loadDirectory"
      @select="baidu.selectFile"
      @add="baidu.addSelected"
      @retry="baidu.loadDirectory()"
      @reconnect="reconnectBaidu"
      @manage="manageBaiduConnection"
    />
  </section>
</template>

<style scoped>
.enmoku-composer {
  flex: none;
  min-width: 0;
  border-bottom: 1px solid var(--room-composer-border);
}
.composer-launch,
.composer-actions button,
.composer-close {
  min-width: 44px;
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  color: var(--color-text);
  background: var(--room-queue-control-surface);
  border: 1px solid var(--room-composer-border);
  border-radius: var(--radius-sm);
  transition:
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}
.composer-launch {
  flex: 1 1 180px;
}
.composer-launchers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3);
}
form {
  display: grid;
  min-width: 0;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--room-composer-surface);
}
.composer-head,
.composer-actions,
.source-preview {
  display: flex;
  gap: 8px;
  align-items: center;
}
.composer-head h4 {
  flex: 1;
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: 16px;
  line-height: var(--line-height-compact);
}
.composer-close {
  width: 44px;
  padding: 0;
  font-size: 22px;
}
label {
  display: grid;
  min-width: 0;
  gap: var(--space-1);
  color: var(--color-text);
  font-size: var(--type-label-size);
  font-weight: 600;
}
input {
  min-width: 0;
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  color: var(--color-text);
  background: var(--room-composer-field-surface);
  border: 1px solid var(--room-composer-border);
  border-radius: var(--radius-sm);
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}
.composer-hint,
.composer-error {
  margin: 0;
  font-size: var(--type-label-size);
  line-height: var(--line-height-compact);
}
.composer-hint {
  color: var(--color-text-muted);
}
.composer-error {
  padding: var(--space-2) var(--space-3);
  color: var(--color-danger);
  background: var(--room-queue-danger-surface);
  border: 1px solid var(--room-queue-danger-border);
  border-radius: var(--radius-sm);
}
.source-preview {
  flex-wrap: wrap;
  min-width: 0;
  padding: var(--space-3);
  background: var(--room-composer-preview-surface);
  border: 1px solid var(--room-composer-border);
  border-radius: var(--radius-sm);
}
.source-preview strong {
  min-width: 0;
  flex-basis: 100%;
  overflow-wrap: anywhere;
}
.source-preview span {
  color: var(--color-accent-strong);
  font-size: var(--type-label-size);
  font-weight: 700;
}
.composer-actions {
  flex-wrap: wrap;
}
.composer-actions button {
  flex: 1 1 140px;
}
.primary:not(:disabled) {
  color: var(--room-queue-primary-text);
  background: var(--room-queue-primary-surface);
  border-color: var(--room-queue-primary-surface);
}
.secondary {
  background: var(--room-queue-control-surface);
}
.quiet {
  background: transparent;
}
button:not(:disabled):hover,
input:focus-visible {
  background: var(--room-queue-control-hover);
  border-color: var(--room-queue-current-border);
}
.primary:not(:disabled):hover {
  background: var(--room-queue-primary-hover);
  border-color: var(--room-queue-primary-hover);
}
input:focus-visible {
  background: var(--room-composer-field-surface);
}
button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}
@media (prefers-reduced-motion: no-preference) {
  .enmoku-composer.open form {
    animation: composer-in var(--duration-normal) var(--ease-standard);
  }
}
@keyframes composer-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 800px) and (orientation: portrait) {
  .composer-launchers,
  .composer-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }
  .composer-launch,
  .composer-actions button {
    width: 100%;
  }
}
</style>
