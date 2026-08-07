<script setup lang="ts">
import { t } from "@/i18n"
import type { BaiduClientState } from "@/lib/baidu-provider"
import type { BaiduConnectionStatus, BaiduRetentionMode } from "houkago-kousoku"
import { computed, nextTick, ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    clientState: BaiduClientState
    status: BaiduConnectionStatus | null
    loading?: boolean
    error?: string
  }>(),
  { loading: false, error: "" },
)

const emit = defineEmits<{
  detect: []
  authorize: [mode: BaiduRetentionMode]
  revoke: []
  refresh: []
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const step = ref<1 | 2 | 3>(1)
const retentionMode = ref<BaiduRetentionMode | null>(null)
const revokeConfirmation = ref(false)
const revokeTrigger = ref<HTMLButtonElement | null>(null)
const revokeCancel = ref<HTMLButtonElement | null>(null)
let returnFocus: HTMLElement | null = null

const adapterReady = computed(() => props.clientState === "ready")
const integrationReady = computed(() => props.status?.enabled !== false)
const connectedModeLabel = computed(() => {
  if (props.status?.retentionMode === "server-saved") return t("baiduRetentionServerSaved")
  if (props.status?.retentionMode === "user-held") return t("baiduRetentionUserHeld")
  return ""
})

function open(): void {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  retentionMode.value = null
  revokeConfirmation.value = false
  step.value = props.status?.connected ? 3 : 1
  dialog.value?.showModal()
  void nextTick(() => dialog.value?.querySelector<HTMLElement>("button:not(:disabled)")?.focus())
}

function close(): void {
  dialog.value?.close()
}

function restoreFocus(): void {
  returnFocus?.focus()
  returnFocus = null
}

function cancelOrClose(): void {
  if (revokeConfirmation.value) {
    cancelRevoke()
    return
  }
  close()
}

function continueToRetention(): void {
  if (!adapterReady.value) return
  step.value = 2
}

function continueToAuthorization(): void {
  if (!retentionMode.value) return
  step.value = 3
}

function authorize(): void {
  if (retentionMode.value) emit("authorize", retentionMode.value)
}

function requestRevoke(): void {
  revokeConfirmation.value = true
  void nextTick(() => revokeCancel.value?.focus())
}

function cancelRevoke(): void {
  revokeConfirmation.value = false
  void nextTick(() => revokeTrigger.value?.focus())
}

watch(
  () => props.status?.connected,
  (connected, previous) => {
    if (previous !== true || connected !== false) return
    revokeConfirmation.value = false
    retentionMode.value = null
    step.value = adapterReady.value && integrationReady.value ? 2 : 1
    void nextTick(() =>
      dialog.value
        ?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)")
        ?.focus(),
    )
  },
)

defineExpose({ open, close })
</script>

<template>
  <dialog
    ref="dialog"
    class="baidu-dialog connection-dialog"
    aria-labelledby="baidu-connection-title"
    @close="restoreFocus"
    @cancel.prevent="cancelOrClose"
  >
    <header>
      <div>
        <p class="eyebrow">{{ t("baiduProvider") }}</p>
        <h2 id="baidu-connection-title">{{ t("baiduConnectionTitle") }}</h2>
      </div>
      <button type="button" class="icon-button" :aria-label="t('providerDialogClose')" @click="close">
        ×
      </button>
    </header>

    <ol class="step-list" :aria-label="t('baiduConnectionProgress')">
      <li :aria-current="step === 1 ? 'step' : undefined">1. {{ t("baiduStepAdapter") }}</li>
      <li :aria-current="step === 2 ? 'step' : undefined">2. {{ t("baiduStepRetention") }}</li>
      <li :aria-current="step === 3 ? 'step' : undefined">3. {{ t("baiduStepAuthorize") }}</li>
    </ol>

    <p v-if="error" class="feedback error" role="alert">{{ error }}</p>

    <section v-if="step === 1" class="dialog-step">
      <h3>{{ t("baiduAdapterCheckTitle") }}</h3>
      <p v-if="clientState === 'mobile'" class="state-copy">{{ t("baiduDesktopRequired") }}</p>
      <p v-else-if="clientState === 'missing'" class="state-copy">
        {{ t("baiduAdapterMissing") }}
      </p>
      <p v-else-if="clientState === 'incompatible'" class="state-copy">
        {{ t("baiduAdapterIncompatible") }}
      </p>
      <p v-else-if="!integrationReady" class="state-copy error" role="status">
        {{ t("baiduIntegrationUnavailable") }}
      </p>
      <p v-else class="state-copy success" role="status">{{ t("baiduAdapterReady") }}</p>
      <div class="actions">
        <button
          v-if="clientState === 'missing' || clientState === 'incompatible'"
          type="button"
          class="secondary"
          :disabled="loading"
          @click="emit('detect')"
        >
          {{ t("baiduCheckAgain") }}
        </button>
        <button
          type="button"
          :disabled="!adapterReady || !integrationReady || loading"
          @click="continueToRetention"
        >
          {{ t("baiduContinue") }}
        </button>
      </div>
    </section>

    <section v-else-if="step === 2" class="dialog-step">
      <fieldset>
        <legend>{{ t("baiduRetentionTitle") }}</legend>
        <label class="retention-card" :class="{ selected: retentionMode === 'server-saved' }">
          <span class="retention-heading">
            <input
              v-model="retentionMode"
              type="radio"
              name="baidu-retention"
              value="server-saved"
              :disabled="status?.serverSavedEnabled === false"
            />
            <strong>{{ t("baiduRetentionServerSaved") }}</strong>
            <small>{{ t("baiduRecommended") }}</small>
          </span>
          <span>{{ t("baiduRetentionServerSavedRisk") }}</span>
          <em v-if="status?.serverSavedEnabled === false">{{ t("baiduServerSavedUnavailable") }}</em>
        </label>
        <label class="retention-card" :class="{ selected: retentionMode === 'user-held' }">
          <span class="retention-heading">
            <input v-model="retentionMode" type="radio" name="baidu-retention" value="user-held" />
            <strong>{{ t("baiduRetentionUserHeld") }}</strong>
          </span>
          <span>{{ t("baiduRetentionUserHeldRisk") }}</span>
        </label>
      </fieldset>
      <div class="actions">
        <button type="button" class="secondary" :disabled="loading" @click="step = 1">
          {{ t("baiduBack") }}
        </button>
        <button type="button" :disabled="!retentionMode || loading" @click="continueToAuthorization">
          {{ t("baiduContinue") }}
        </button>
      </div>
    </section>

    <section v-else class="dialog-step">
      <template v-if="status?.connected">
        <h3>{{ t("baiduConnected") }}</h3>
        <dl class="connection-summary">
          <div v-if="status.accountName">
            <dt>{{ t("baiduAccount") }}</dt>
            <dd>{{ status.accountName }}</dd>
          </div>
          <div>
            <dt>{{ t("baiduRetentionTitle") }}</dt>
            <dd>{{ connectedModeLabel }}</dd>
          </div>
        </dl>
        <p v-if="status.reason === 'adaptor-offline'" class="feedback error" role="status">
          {{ t("baiduOwnerOffline") }}
        </p>
        <template v-if="revokeConfirmation">
          <section class="revoke-confirmation" role="alert" aria-labelledby="baidu-revoke-title">
            <h4 id="baidu-revoke-title">{{ t("baiduRevokeConfirmTitle") }}</h4>
            <p>{{ t("baiduRevokeConfirmIntro") }}</p>
            <ul>
              <li>{{ t("baiduRevokeEffectHoukago") }}</li>
              <li>{{ t("baiduRevokeEffectSources") }}</li>
              <li>{{ t("baiduRevokeEffectBaidu") }}</li>
            </ul>
          </section>
          <div class="actions">
            <button
              ref="revokeCancel"
              type="button"
              class="secondary"
              :disabled="loading"
              @click="cancelRevoke"
            >
              {{ t("cancel") }}
            </button>
            <button type="button" class="danger" :disabled="loading" @click="emit('revoke')">
              {{ loading ? t("baiduRevoking") : t("baiduRevokeConfirm") }}
            </button>
          </div>
        </template>
        <div v-else class="actions">
          <button type="button" class="secondary" :disabled="loading" @click="emit('refresh')">
            {{ t("retry") }}
          </button>
          <button
            ref="revokeTrigger"
            type="button"
            class="danger"
            :disabled="loading"
            @click="requestRevoke"
          >
            {{ t("baiduRevoke") }}
          </button>
        </div>
      </template>
      <template v-else>
        <h3>{{ t("baiduAuthorizeTitle") }}</h3>
        <p>{{ t("baiduAuthorizeNotice") }}</p>
        <p v-if="loading" class="feedback" role="status">{{ t("baiduAuthorizationPending") }}</p>
        <div class="actions">
          <button type="button" class="secondary" :disabled="loading" @click="step = 2">
            {{ t("baiduBack") }}
          </button>
          <button type="button" :disabled="!retentionMode || loading" @click="authorize">
            {{ t("baiduOpenAuthorization") }}
          </button>
        </div>
      </template>
    </section>
  </dialog>
</template>

<style scoped>
.baidu-dialog {
  width: min(620px, calc(100vw - 32px));
  max-height: min(760px, calc(100dvh - 32px));
  padding: 0;
  overflow: auto;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-floating);
}
.baidu-dialog::backdrop { background: var(--color-overlay); }
header { display: flex; gap: var(--space-3); align-items: flex-start; justify-content: space-between; padding: var(--space-5); border-bottom: 1px solid var(--color-border); }
h2, h3, p { margin-top: 0; }
h2 { margin-bottom: 0; font-size: 22px; }
.eyebrow { margin-bottom: var(--space-1); color: var(--color-accent); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.icon-button { width: 44px; min-width: 44px; height: 44px; font-size: 22px; }
.step-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); margin: 0; padding: var(--space-3) var(--space-5); color: var(--color-text-muted); list-style: none; border-bottom: 1px solid var(--color-border); }
.step-list li { padding: var(--space-2); font-size: 12px; text-align: center; border-radius: var(--radius-sm); }
.step-list li[aria-current="step"] { color: var(--color-on-accent); background: var(--color-accent); }
.dialog-step { display: grid; gap: var(--space-4); padding: var(--space-5); }
.state-copy, .feedback { margin-bottom: 0; padding: var(--space-3); color: var(--color-text-muted); background: var(--color-surface-muted); border-radius: var(--radius-sm); }
.success { color: var(--color-text); }
.error { color: var(--color-danger); background: var(--color-danger-surface); }
fieldset { display: grid; gap: var(--space-3); min-width: 0; margin: 0; padding: 0; border: 0; }
legend { margin-bottom: var(--space-3); font-weight: 700; }
.retention-card { display: grid; gap: var(--space-2); min-height: 44px; padding: var(--space-4); color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: var(--radius-md); cursor: pointer; }
.retention-card.selected { color: var(--color-text); border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface)); }
.retention-card:has(input:disabled) { cursor: not-allowed; opacity: 0.6; }
.retention-heading { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; color: var(--color-text); }
.retention-heading input { width: 20px; height: 20px; }
.retention-heading small { padding: 2px 6px; color: var(--color-on-accent); background: var(--color-accent); border-radius: 999px; }
.retention-card em { color: var(--color-danger); font-size: 12px; font-style: normal; }
.actions { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: flex-end; }
button { min-height: 44px; padding: 8px 14px; color: var(--color-on-accent); background: var(--color-accent); border: 1px solid var(--color-accent); border-radius: var(--radius-sm); cursor: pointer; }
button.secondary, button.icon-button { color: var(--color-text); background: var(--color-surface); border-color: var(--color-border); }
button.danger { background: var(--color-danger); border-color: var(--color-danger); }
button:disabled { cursor: not-allowed; opacity: 0.5; }
.connection-summary { display: grid; gap: var(--space-2); margin: 0; }
.connection-summary div { display: grid; grid-template-columns: minmax(110px, 0.35fr) 1fr; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
.connection-summary dt { color: var(--color-text-muted); }
.connection-summary dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
.revoke-confirmation { padding: var(--space-4); color: var(--color-danger); background: var(--color-danger-surface); border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border)); border-radius: var(--radius-md); }
.revoke-confirmation h4, .revoke-confirmation p { margin-top: 0; }
.revoke-confirmation ul { display: grid; gap: var(--space-2); margin-bottom: 0; padding-left: 1.25rem; color: var(--color-text); }
@media (max-width: 520px) {
  .step-list { grid-template-columns: 1fr; }
  .step-list li { text-align: left; }
  .dialog-step, header { padding: var(--space-4); }
  .actions button { flex: 1 1 140px; }
}
</style>
