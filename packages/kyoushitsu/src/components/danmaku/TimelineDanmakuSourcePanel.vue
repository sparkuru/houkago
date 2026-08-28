<script setup lang="ts">
import type { RoomAction, TimelineDanmakuState } from "@/composables/useTimelineDanmaku"
import { t } from "@/i18n"
import type { DanmakuSelectionOrigin } from "@/lib/danmaku-selection"
import type { DanmakuCandidate, DanmakuDefault, DanmakuSourceClass } from "houkago-kousoku"

defineProps<{
  candidates: readonly DanmakuCandidate[]
  selectedCandidate: DanmakuCandidate | null
  selectionOrigin: DanmakuSelectionOrigin
  currentRoomDefault: DanmakuDefault | null
  hasViewerOverride: boolean
  sourceState: TimelineDanmakuState
  sourceError: string
  isBuchou: boolean
  roomAction: RoomAction
  roomActionMessage: string
  proposalAction: RoomAction
  proposalMessage: string
}>()

const emit = defineEmits<{
  select: [candidateId: string]
  clearViewer: []
  chooseFile: []
  setRoomDefault: [candidateId: string]
  clearRoomDefault: []
  submitProposal: [candidateId: string]
  retry: []
}>()

function sourceClassLabel(sourceClass: DanmakuSourceClass): string {
  switch (sourceClass) {
    case "server-stored":
      return t("danmakuSourceServerStored")
    case "provider-official":
      return t("danmakuSourceProviderOfficial")
    case "local":
      return t("danmakuSourceLocal")
    case "third-party":
      return t("danmakuSourceThirdParty")
  }
}

function originLabel(origin: DanmakuSelectionOrigin): string {
  switch (origin) {
    case "viewer-override":
      return t("danmakuSourceScopeViewer")
    case "room-default":
      return t("danmakuSourceScopeRoom")
    case "fallback":
      return t("danmakuSourceFallback")
    case "strategy":
      return t("danmakuSourceScopeGlobal")
    case "none":
      return t("danmakuNone")
  }
}

function provenanceLabel(candidate: DanmakuCandidate): string {
  const label = candidate.provenance?.label
  const provider = candidate.provenance?.provider
  return label || provider || t("danmakuSourceScopeGlobal")
}

function availabilityLabel(candidate: DanmakuCandidate): string {
  switch (candidate.availability) {
    case "disabled":
      return t("danmakuSourceDisabled")
    case "failed":
      return t("danmakuSourceFailed")
    case "unavailable":
      return t("danmakuSourceUnavailable")
    default:
      return ""
  }
}

function stateLabel(state: TimelineDanmakuState, sourceError: string): string {
  switch (state) {
    case "loading":
      return t("danmakuSourceLoading")
    case "error":
      return sourceError || t("danmakuSourceLoadFailed")
    case "fallback":
      return t("danmakuSourceFallback")
    case "empty":
      return t("danmakuSourceEmpty")
    case "ready":
      return t("danmakuSourceReady")
    default:
      return ""
  }
}
</script>

<template>
  <details class="timeline-danmaku-source" open>
    <summary :aria-label="t('danmakuSourcePanelAria')">
      <strong>{{ t("danmakuSourcePanel") }}</strong>
      <span v-if="selectedCandidate">{{ selectedCandidate.name }}</span>
    </summary>
    <div class="timeline-danmaku-source-body">
      <p
        v-if="sourceState !== 'ready' || sourceError"
        class="timeline-danmaku-state"
        :class="{ error: sourceState === 'error' }"
        role="status"
        aria-live="polite"
      >
        {{ stateLabel(sourceState, sourceError) }}
      </p>
      <p v-if="sourceState === 'fallback'" class="timeline-danmaku-hint">
        {{ t("danmakuSourceFallback") }}
      </p>
      <ul
        v-if="candidates.length > 0"
        class="timeline-danmaku-candidates"
        :aria-label="t('danmakuSourcePanelAria')"
      >
        <li v-for="candidate in candidates" :key="candidate.id">
          <button
            type="button"
            class="timeline-danmaku-candidate"
            :class="{ selected: selectedCandidate?.id === candidate.id }"
            :disabled="candidate.availability !== 'available'"
            :aria-pressed="selectedCandidate?.id === candidate.id"
            @click="emit('select', candidate.id)"
          >
            <span class="timeline-danmaku-candidate-heading">
              <strong>{{ candidate.name }}</strong>
              <span class="timeline-danmaku-badge">
                {{ selectedCandidate?.id === candidate.id ? originLabel(selectionOrigin) : t("danmakuSourceUsePersonally") }}
              </span>
            </span>
            <small>
              {{ sourceClassLabel(candidate.sourceClass) }} · {{ t("danmakuSourceProvenance") }}{{
                provenanceLabel(candidate)
              }}
            </small>
            <small v-if="candidate.availability !== 'available'" class="timeline-danmaku-disabled">
              {{ availabilityLabel(candidate) }}<span v-if="candidate.reason">：{{ candidate.reason }}</span>
            </small>
          </button>
        </li>
      </ul>
      <p v-else class="timeline-danmaku-empty">{{ t("danmakuSourceEmpty") }}</p>
      <div class="timeline-danmaku-actions">
        <button type="button" class="secondary" @click="emit('chooseFile')">
          {{ t("danmakuSourceChooseFile") }}
        </button>
        <button
          type="button"
          class="secondary"
          :disabled="!hasViewerOverride"
          @click="emit('clearViewer')"
        >
          {{ t("danmakuSourceClearPersonally") }}
        </button>
        <button
          v-if="isBuchou && selectedCandidate?.trackId"
          type="button"
          class="secondary"
          :disabled="roomAction === 'pending' || selectedCandidate.availability !== 'available'"
          @click="emit('setRoomDefault', selectedCandidate.id)"
        >
          {{ t("danmakuSourceSetRoomDefault") }}
        </button>
        <button
          v-if="isBuchou && currentRoomDefault"
          type="button"
          class="secondary"
          :disabled="roomAction === 'pending'"
          @click="emit('clearRoomDefault')"
        >
          {{ t("danmakuSourceClearRoomDefault") }}
        </button>
        <button
          v-if="selectedCandidate"
          type="button"
          class="secondary"
          :disabled="proposalAction === 'pending'"
          @click="emit('submitProposal', selectedCandidate.id)"
        >
          {{ t("danmakuSourceSubmitProposal") }}
        </button>
        <button
          v-if="sourceState === 'error' || sourceState === 'fallback'"
          type="button"
          class="secondary"
          @click="emit('retry')"
        >
          {{ t("danmakuSourceRetry") }}
        </button>
      </div>
      <p v-if="roomActionMessage" class="timeline-danmaku-feedback" role="status" aria-live="polite">
        {{ roomActionMessage }}
      </p>
      <p v-if="proposalMessage" class="timeline-danmaku-feedback" role="status" aria-live="polite">
        {{ proposalMessage }}
      </p>
    </div>
  </details>
</template>

<style scoped>
.timeline-danmaku-source {
  margin-top: var(--space-3);
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.timeline-danmaku-source summary {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
}

.timeline-danmaku-source summary span {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-danmaku-source-body {
  display: grid;
  gap: var(--space-3);
  padding: 0 var(--space-3) var(--space-3);
}

.timeline-danmaku-state,
.timeline-danmaku-hint,
.timeline-danmaku-empty,
.timeline-danmaku-feedback {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  background: var(--color-surface-muted);
  border-radius: var(--radius-sm);
}

.timeline-danmaku-state.error {
  color: var(--color-danger);
}

.timeline-danmaku-candidates {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline-danmaku-candidate {
  display: grid;
  gap: 3px;
  width: 100%;
  min-height: 56px;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text);
  text-align: left;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.timeline-danmaku-candidate:hover:not(:disabled),
.timeline-danmaku-candidate.selected {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface-raised));
}

.timeline-danmaku-candidate:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.timeline-danmaku-candidate-heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.timeline-danmaku-candidate small {
  overflow-wrap: anywhere;
  color: var(--color-text-muted);
}

.timeline-danmaku-badge {
  padding: 2px 6px;
  color: var(--color-on-accent);
  font-size: 12px;
  background: var(--color-accent);
  border-radius: 999px;
}

.timeline-danmaku-disabled {
  color: var(--color-danger) !important;
}

.timeline-danmaku-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.timeline-danmaku-actions button {
  min-height: 44px;
  padding: 8px 12px;
  color: var(--color-on-accent);
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.timeline-danmaku-actions button.secondary {
  color: var(--color-text);
  background: var(--color-surface-raised);
  border-color: var(--color-border);
}

.timeline-danmaku-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 520px) {
  .timeline-danmaku-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .timeline-danmaku-actions button {
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-danmaku-candidate {
    transition: none;
  }
}
</style>
