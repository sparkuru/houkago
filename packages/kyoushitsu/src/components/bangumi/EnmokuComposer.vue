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
  <section class="enmoku-composer" :class="{ open }">
    <div v-if="!open" class="composer-launchers">
      <button
        v-if="canPlaylist"
        type="button"
        class="composer-launch"
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
      <button type="button" class="composer-launch secondary" @click="manageBaiduConnection">
        {{ t("baiduConnectionManager") }}
      </button>
    </div>
    <form v-else @submit.prevent="resolve" @keydown.esc.prevent="collapse">
      <div class="composer-head">
        <h4>{{ t("sourceAddHeading") }}</h4>
        <button type="button" class="composer-close" :aria-label="t('sourceComposerCloseAria')" @click="close">
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
        <button v-if="!preview" type="submit" :disabled="resolving || !sourceUrl.trim()">
          {{ resolving ? t("sourceResolving") : t("sourceResolve") }}
        </button>
        <template v-else>
          <button type="button" :disabled="submitting" @click="queue">
            {{ submitting ? t("sourceAdding") : t("sourceAddQueue") }}
          </button>
          <button type="button" class="secondary" :disabled="submitting" @click="queueAndJouei">
            {{ t("sourceAddAndSwitch") }}
          </button>
          <button type="button" class="secondary" :disabled="submitting" @click="edit">
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
  border-bottom: 1px solid var(--row-border);
}
.composer-launch,
.composer-actions button,
.composer-close {
  min-height: 44px;
  border: 1px solid var(--row-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  background: var(--color-surface-muted);
}
.composer-launch {
  flex: 1 1 180px;
  color: var(--color-on-accent);
  background: var(--color-accent);
}
.composer-launchers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}
.composer-launch.secondary {
  color: var(--color-text);
  background: var(--color-surface);
}
form {
  display: grid;
  gap: 10px;
  padding: 12px;
  background: var(--color-surface-muted);
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
}
.composer-close {
  width: 44px;
  padding: 0;
  font-size: 22px;
}
label {
  display: grid;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}
input {
  min-width: 0;
  min-height: 44px;
  padding: 0 10px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--row-border);
  border-radius: var(--radius-sm);
}
.composer-hint,
.composer-error {
  margin: 0;
  font-size: 13px;
}
.composer-hint {
  color: var(--color-text-muted);
}
.composer-error {
  color: var(--danger-text);
}
.source-preview {
  flex-wrap: wrap;
  padding: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.source-preview strong {
  flex-basis: 100%;
}
.source-preview span {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-accent);
}
.composer-actions {
  flex-wrap: wrap;
}
.composer-actions button {
  flex: 1 1 140px;
  padding: 6px 10px;
}
.composer-actions .secondary {
  background: transparent;
}
button:not(:disabled):hover,
button:not(:disabled):focus-visible,
input:focus-visible {
  border-color: var(--color-accent);
  outline: 2px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
  outline-offset: 1px;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
@media (prefers-reduced-motion: no-preference) {
  .enmoku-composer.open form {
    animation: composer-in 180ms ease-out;
  }
}
@keyframes composer-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
