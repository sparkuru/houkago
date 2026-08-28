import { housou } from "@/api"
import {
  clearDanmakuRoomDefault,
  fetchDanmakuCandidates,
  setDanmakuRoomDefault,
  submitDanmakuPublicProposal,
} from "@/api/danmaku"
import { t } from "@/i18n"
import {
  DANMAKU_OVERRIDE_VERSION,
  type DanmakuSelection,
  type DanmakuSelectionOrigin,
  type DanmakuViewerOverride,
  clearDanmakuOverride,
  isDanmakuCandidateUsable,
  loadDanmakuOverride,
  resolveDanmakuSelection,
  saveDanmakuOverride,
  stableReleaseIdentity,
} from "@/lib/danmaku-selection"
import { loadFileDanmakuEnabled, saveFileDanmakuEnabled } from "@/lib/file-danmaku-pref"
import { useBushitsuStore } from "@/stores/bushitsu"
import { type DanmakuCue, parseBilibiliXml } from "houkago-kokuban"
import type {
  DanmakuCandidate,
  DanmakuCandidateResolution,
  DanmakuDefault,
  DanmakuSourcePolicy,
  Enmoku,
} from "houkago-kousoku"
import { type Ref, computed, ref, watch } from "vue"

const DEFAULT_DANMAKU_POLICY: DanmakuSourcePolicy = {
  allowedClasses: ["server-stored", "provider-official", "local", "third-party"],
  order: ["server-stored", "provider-official", "local", "third-party"],
  updatedAt: 0,
}

export type TimelineDanmakuState = "idle" | "loading" | "ready" | "empty" | "error" | "fallback"

export type RoomAction = "idle" | "pending" | "success" | "error"

export function useTimelineDanmaku(bushitsuId: string, current: Ref<Enmoku | null>) {
  const bushitsu = useBushitsuStore()
  const fileInput = ref<HTMLInputElement | null>(null)
  const fileDanmakuEnabled = ref(loadFileDanmakuEnabled())
  const resolution = ref<DanmakuCandidateResolution | null>(null)
  const resolutionCache = new Map<string, DanmakuCandidateResolution>()
  const cueCache = new Map<string, DanmakuCue[]>()
  const localCandidates = ref<Record<string, DanmakuCandidate>>({})
  const overrides = ref<Record<string, DanmakuViewerOverride | null>>({})
  const failedCandidates = ref<Record<string, string>>({})
  const resolutionLoading = ref(false)
  const cueLoading = ref(false)
  const resolutionError = ref("")
  const cueError = ref("")
  const roomAction = ref<RoomAction>("idle")
  const roomActionMessage = ref("")
  const proposalAction = ref<RoomAction>("idle")
  const proposalMessage = ref("")
  const cueVersion = ref(0)
  const trackVersion = ref(0)
  let resolutionRequest = 0
  let cueRequest = 0

  const currentEnmokuId = computed(() => current.value?.id ?? null)
  const currentOverride = computed(() => {
    const id = currentEnmokuId.value
    return id ? (overrides.value[id] ?? null) : null
  })
  const currentPolicy = computed(() => resolution.value?.policy ?? DEFAULT_DANMAKU_POLICY)
  const hasAuthoritativeRoomDefaults = computed(
    () => bushitsu.danmakuDefaultsSnapshotRoomId === bushitsuId,
  )
  const currentRoomDefault = computed<DanmakuDefault | null>(() => {
    const id = currentEnmokuId.value
    if (!id) return null
    return hasAuthoritativeRoomDefaults.value
      ? (bushitsu.danmakuDefaults[id] ?? null)
      : (resolution.value?.roomDefault ?? null)
  })
  const candidates = computed(() => {
    const merged = new Map<string, DanmakuCandidate>()
    for (const candidate of resolution.value?.candidates ?? []) merged.set(candidate.id, candidate)
    const local = currentEnmokuId.value ? localCandidates.value[currentEnmokuId.value] : undefined
    if (local) merged.set(local.id, local)
    return [...merged.values()].map((candidate) => {
      const reason = failedCandidates.value[candidate.id]
      if (reason) return { ...candidate, availability: "failed" as const, reason }
      if (!currentPolicy.value.allowedClasses.includes(candidate.sourceClass)) {
        return {
          ...candidate,
          availability: "disabled" as const,
          reason: t("danmakuSourceDisabled"),
        }
      }
      return candidate
    })
  })
  const selection = computed<DanmakuSelection>(() =>
    resolveDanmakuSelection(
      candidates.value,
      currentOverride.value,
      currentRoomDefault.value,
      currentPolicy.value,
    ),
  )
  const selectedCandidate = computed(() => selection.value.candidate)
  const currentTimelineDanmaku = computed<readonly DanmakuCue[]>(() => {
    const candidate = selectedCandidate.value
    if (!candidate) return []
    if (candidate.cues) return candidate.cues
    return cueCache.get(candidate.id) ?? []
  })
  const currentTimelineDanmakuName = computed(() => selectedCandidate.value?.name ?? "")
  const timelineDanmakuTrackVersion = computed(() => trackVersion.value)
  const sourceState = computed<TimelineDanmakuState>(() => {
    if (!current.value) return "idle"
    if (resolutionLoading.value || cueLoading.value) return "loading"
    if (selection.value.origin === "fallback") return "fallback"
    if (resolutionError.value && !selectedCandidate.value) return "error"
    if (!selectedCandidate.value || currentTimelineDanmaku.value.length === 0) {
      return cueError.value ? "error" : "empty"
    }
    return "ready"
  })
  const sourceError = computed(() => cueError.value || resolutionError.value)
  const roomDefaultCandidate = computed(() => {
    const trackId = currentRoomDefault.value?.trackId
    return trackId
      ? (candidates.value.find((candidate) => candidate.trackId === trackId) ?? null)
      : null
  })
  const roomDefaultSelected = computed(() =>
    Boolean(
      currentRoomDefault.value &&
        selectedCandidate.value?.trackId === currentRoomDefault.value.trackId,
    ),
  )

  function fallbackResolution(enmoku: Enmoku): DanmakuCandidateResolution {
    const ref = enmoku.danmaku?.type === "fetch" ? enmoku.danmaku.ref.trim() : ""
    const legacy = ref
      ? ({
          id: `legacy:${enmoku.id}`,
          sourceClass: "provider-official",
          name: t("danmakuSourceRemote"),
          provenance: { reference: ref },
          legacyRef: ref,
          availability: "available",
        } satisfies DanmakuCandidate)
      : null
    return {
      bushitsuId,
      enmokuId: enmoku.id,
      policy: DEFAULT_DANMAKU_POLICY,
      candidates: legacy ? [legacy] : [],
      roomDefault: null,
    }
  }

  async function loadResolution(enmoku: Enmoku, force = false): Promise<void> {
    const request = ++resolutionRequest
    const cached = resolutionCache.get(enmoku.id)
    if (!force && cached) {
      resolution.value = {
        ...cached,
        roomDefault: hasAuthoritativeRoomDefaults.value
          ? (bushitsu.danmakuDefaults[enmoku.id] ?? null)
          : cached.roomDefault,
      }
      resolutionError.value = ""
      resolutionLoading.value = false
      return
    }
    resolutionLoading.value = true
    resolutionError.value = ""
    try {
      const response = await fetchDanmakuCandidates(bushitsuId, enmoku.id)
      if (request !== resolutionRequest || currentEnmokuId.value !== enmoku.id) return
      if (response.error || !response.data) throw new Error("candidate resolution failed")
      const next = {
        ...response.data,
        roomDefault: hasAuthoritativeRoomDefaults.value
          ? (bushitsu.danmakuDefaults[enmoku.id] ?? null)
          : response.data.roomDefault,
      }
      resolutionCache.set(enmoku.id, next)
      resolution.value = next
    } catch {
      if (request !== resolutionRequest || currentEnmokuId.value !== enmoku.id) return
      const fallback = fallbackResolution(enmoku)
      resolution.value = fallback
      resolutionCache.set(enmoku.id, fallback)
      resolutionError.value = t("danmakuSourceLoadFailed")
    } finally {
      if (request === resolutionRequest && currentEnmokuId.value === enmoku.id) {
        resolutionLoading.value = false
      }
    }
  }

  async function loadCandidateCues(candidate: DanmakuCandidate): Promise<void> {
    if (candidate.cues || cueCache.has(candidate.id) || !candidate.legacyRef) return
    const enmokuId = currentEnmokuId.value
    if (!enmokuId) return
    const request = ++cueRequest
    cueLoading.value = true
    cueError.value = ""
    try {
      const response = await housou.eisha.danmaku({ ref: candidate.legacyRef }).get()
      if (
        request !== cueRequest ||
        currentEnmokuId.value !== enmokuId ||
        selectedCandidate.value?.id !== candidate.id
      ) {
        return
      }
      if (response.error || !response.data) throw new Error("legacy danmaku unavailable")
      cueCache.set(candidate.id, response.data)
      cueVersion.value += 1
    } catch {
      if (request !== cueRequest || currentEnmokuId.value !== enmokuId) return
      failedCandidates.value = {
        ...failedCandidates.value,
        [candidate.id]: t("danmakuSourceLoadFailed"),
      }
      cueError.value = t("danmakuSourceLoadFailed")
      cueVersion.value += 1
    } finally {
      if (request === cueRequest) cueLoading.value = false
    }
  }

  function toggleFileDanmaku(): void {
    fileDanmakuEnabled.value = !fileDanmakuEnabled.value
    saveFileDanmakuEnabled(fileDanmakuEnabled.value)
  }

  function chooseFileDanmaku(): void {
    fileInput.value?.click()
  }

  async function onFileDanmakuSelected(event: Event): Promise<void> {
    const target = event.target
    if (!(target instanceof HTMLInputElement)) return
    const file = target.files?.[0]
    target.value = ""
    const enmoku = current.value
    if (!file || !enmoku) return
    const cues = parseBilibiliXml(await file.text())
    const id = `local:${stableReleaseIdentity(enmoku)}`
    localCandidates.value = {
      ...localCandidates.value,
      [enmoku.id]: {
        id,
        sourceClass: "local",
        name: cues.length > 0 ? file.name : t("fileDanmakuEmpty"),
        availability: cues.length > 0 ? "available" : "unavailable",
        ...(cues.length > 0 ? { cues } : { reason: t("fileDanmakuEmpty") }),
      },
    }
    if (cues.length > 0) {
      overrides.value = {
        ...overrides.value,
        [enmoku.id]: saveDanmakuOverride(enmoku, id),
      }
    }
    cueVersion.value += 1
    trackVersion.value += 1
  }

  function selectCandidate(candidateId: string): boolean {
    const enmoku = current.value
    const candidate = candidates.value.find((item) => item.id === candidateId)
    if (!enmoku || !candidate || !isDanmakuCandidateUsable(candidate)) return false
    overrides.value = {
      ...overrides.value,
      [enmoku.id]: saveDanmakuOverride(enmoku, candidate.id, candidate.trackId),
    }
    roomActionMessage.value = t("danmakuSourceSaved")
    return true
  }

  function clearViewerOverride(): void {
    const enmoku = current.value
    if (!enmoku) return
    clearDanmakuOverride(enmoku)
    overrides.value = { ...overrides.value, [enmoku.id]: null }
    roomActionMessage.value = ""
  }

  async function setRoomDefault(candidateId = selectedCandidate.value?.id): Promise<boolean> {
    const enmoku = current.value
    const candidate = candidates.value.find((item) => item.id === candidateId)
    if (!enmoku || !candidate?.trackId || !isDanmakuCandidateUsable(candidate)) return false
    roomAction.value = "pending"
    roomActionMessage.value = ""
    const response = await setDanmakuRoomDefault(bushitsuId, enmoku.id, candidate.trackId)
    if (response.error) {
      roomAction.value = "error"
      roomActionMessage.value = t("danmakuSourceActionFailed")
      return false
    }
    roomAction.value = "success"
    roomActionMessage.value = t("danmakuSourceRoomDefaultSaved")
    return true
  }

  async function clearRoomDefault(): Promise<boolean> {
    const enmoku = current.value
    if (!enmoku) return false
    roomAction.value = "pending"
    roomActionMessage.value = ""
    const response = await clearDanmakuRoomDefault(bushitsuId, enmoku.id)
    if (response.error) {
      roomAction.value = "error"
      roomActionMessage.value = t("danmakuSourceActionFailed")
      return false
    }
    roomAction.value = "success"
    roomActionMessage.value = t("danmakuSourceRoomDefaultCleared")
    return true
  }

  async function submitPublicProposal(candidateId = selectedCandidate.value?.id): Promise<boolean> {
    const candidate = candidates.value.find((item) => item.id === candidateId)
    if (!candidate?.releaseId || !candidate.evidence?.length) {
      proposalAction.value = "error"
      proposalMessage.value = t("danmakuSourceProposalUnavailable")
      return false
    }
    proposalAction.value = "pending"
    proposalMessage.value = ""
    const response = await submitDanmakuPublicProposal(candidate.releaseId, candidate.evidence)
    if (response.error) {
      proposalAction.value = "error"
      proposalMessage.value = t("danmakuSourceActionFailed")
      return false
    }
    proposalAction.value = "success"
    proposalMessage.value = t("danmakuSourceProposalSubmitted")
    return true
  }

  function retry(): void {
    const enmoku = current.value
    if (!enmoku) return
    failedCandidates.value = {}
    cueError.value = ""
    void loadResolution(enmoku, true)
  }

  watch(
    currentEnmokuId,
    (id) => {
      resolutionRequest += 1
      cueRequest += 1
      resolution.value = id ? (resolutionCache.get(id) ?? null) : null
      resolutionError.value = ""
      cueError.value = ""
      cueLoading.value = false
      failedCandidates.value = {}
      const enmoku = current.value
      if (!id || !enmoku) return
      overrides.value = { ...overrides.value, [id]: loadDanmakuOverride(enmoku) }
      void loadResolution(enmoku)
    },
    { immediate: true },
  )

  watch(
    () => bushitsu.danmakuDefaults,
    () => {
      const enmoku = current.value
      if (!enmoku) return
      const cached = resolutionCache.get(enmoku.id)
      if (cached) {
        resolution.value = {
          ...cached,
          roomDefault: hasAuthoritativeRoomDefaults.value
            ? (bushitsu.danmakuDefaults[enmoku.id] ?? null)
            : cached.roomDefault,
        }
      }
    },
    { deep: true },
  )

  watch(
    () => [currentEnmokuId.value, selectedCandidate.value?.id, cueVersion.value] as const,
    () => {
      trackVersion.value += 1
      const candidate = selectedCandidate.value
      if (candidate) void loadCandidateCues(candidate)
    },
    { immediate: true },
  )

  return {
    fileInput,
    fileDanmakuEnabled,
    currentTimelineDanmaku,
    currentTimelineDanmakuName,
    timelineDanmakuTrackVersion,
    candidates,
    selectedCandidate,
    selection,
    selectionOrigin: computed<DanmakuSelectionOrigin>(() => selection.value.origin),
    currentOverride,
    currentRoomDefault,
    roomDefaultCandidate,
    roomDefaultSelected,
    sourceState,
    sourceError,
    resolutionLoading,
    roomAction,
    roomActionMessage,
    proposalAction,
    proposalMessage,
    toggleFileDanmaku,
    chooseFileDanmaku,
    onFileDanmakuSelected,
    selectCandidate,
    clearViewerOverride,
    setRoomDefault,
    clearRoomDefault,
    submitPublicProposal,
    retry,
    releaseIdentity: computed(() => (current.value ? stableReleaseIdentity(current.value) : "")),
    overrideVersion: DANMAKU_OVERRIDE_VERSION,
  }
}
