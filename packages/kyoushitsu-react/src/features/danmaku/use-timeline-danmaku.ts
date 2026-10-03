import type {
  BaiduMediaFingerprint,
  DanmakuCandidate,
  DanmakuCandidateResolution,
  DanmakuCue,
  DanmakuDefault,
  DanmakuEpisode,
  DanmakuEvidence,
  DanmakuSourcePolicy,
  Enmoku,
} from "houkago-kousoku"
import {
  type DanmakuViewerOverride,
  clearDanmakuOverride,
  isDanmakuCandidateUsable,
  loadDanmakuOverride,
  resolveDanmakuSelection,
  saveDanmakuOverride,
} from "houkago-kyoushitsu-core/danmaku-selection"
import {
  clearDanmakuRoomDefault,
  confirmDanmakuPersonalMatch,
  fetchDanmakuCandidates,
  fetchDanmakuSearch,
  fetchLegacyDanmakuCues,
  setDanmakuRoomDefault,
  submitDanmakuPublicProposal,
} from "houkago-kyoushitsu-core/http"
import { t } from "houkago-kyoushitsu-core/i18n"
import { createLocalDanmakuCandidate } from "houkago-kyoushitsu-core/local-danmaku-candidate"
import { useEffect, useMemo, useRef, useState } from "react"

const defaultPolicy: DanmakuSourcePolicy = {
  allowedClasses: ["server-stored", "provider-official", "local", "third-party"],
  order: ["server-stored", "provider-official", "local", "third-party"],
  updatedAt: 0,
}

type RequestState = "idle" | "pending" | "success" | "error"
type Scoped<T> = { scope: string; value: T }

export type TimelineDanmakuInput = {
  roomId: string
  identityId: string
  current: Enmoku | null
  roomDefaults: Readonly<Record<string, DanmakuDefault>>
  defaultsAuthoritative: boolean
  isHost: boolean
  canManageRoomDefault: boolean
  fingerprint?: (enmoku: Enmoku) => Promise<BaiduMediaFingerprint | null>
}

function fallbackResolution(roomId: string, enmoku: Enmoku): DanmakuCandidateResolution {
  const ref = enmoku.danmaku?.type === "fetch" ? enmoku.danmaku.ref.trim() : ""
  const candidate: DanmakuCandidate | null = ref
    ? {
        id: `legacy:${enmoku.id}`,
        sourceClass: "provider-official",
        name: t("danmakuSourceRemote"),
        provenance: { reference: ref },
        legacyRef: ref,
        availability: "available",
      }
    : null
  return {
    bushitsuId: roomId,
    enmokuId: enmoku.id,
    policy: defaultPolicy,
    candidates: candidate ? [candidate] : [],
    roomDefault: null,
  }
}

export function useTimelineDanmaku(input: TimelineDanmakuInput) {
  const { roomId, identityId, current, roomDefaults, defaultsAuthoritative, canManageRoomDefault } =
    input
  const scope = `${roomId}\0${identityId}\0${current?.id ?? ""}`
  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const previousScope = useRef<string | null>(null)
  const requests = useRef(new Set<AbortController>())
  const [resolution, setResolution] = useState<Scoped<DanmakuCandidateResolution> | null>(null)
  const [resolutionState, setResolutionState] = useState<RequestState>("idle")
  const [resolutionError, setResolutionError] = useState("")
  const [legacyCues, setLegacyCues] = useState<Scoped<{ id: string; cues: DanmakuCue[] }> | null>(
    null,
  )
  const [failedCandidate, setFailedCandidate] = useState<Scoped<string> | null>(null)
  const [cueState, setCueState] = useState<RequestState>("idle")
  const [override, setOverride] = useState<Scoped<DanmakuViewerOverride | null> | null>(null)
  const [localCandidates, setLocalCandidates] = useState<Record<string, DanmakuCandidate>>({})
  const [roomAction, setRoomAction] = useState<RequestState>("idle")
  const [roomMessage, setRoomMessage] = useState("")
  const [proposalAction, setProposalAction] = useState<RequestState>("idle")
  const [proposalMessage, setProposalMessage] = useState("")
  const [matchAction, setMatchAction] = useState<RequestState>("idle")
  const [matchMessage, setMatchMessage] = useState("")
  const [searchAction, setSearchAction] = useState<RequestState>("idle")
  const [searchMessage, setSearchMessage] = useState("")
  const [searchResults, setSearchResults] = useState<Scoped<DanmakuEpisode[]> | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [reload, setReload] = useState(0)
  const requestScope = `${scope}\0${reload}`

  useEffect(() => {
    const scopeChanged = previousScope.current !== scope
    previousScope.current = scope
    for (const request of requests.current) request.abort()
    requests.current.clear()
    setResolutionState(current ? "pending" : "idle")
    setResolutionError("")
    setCueState("idle")
    setFailedCandidate(null)
    if (scopeChanged) {
      setRoomAction("idle")
      setRoomMessage("")
      setProposalAction("idle")
      setProposalMessage("")
      setMatchAction("idle")
      setMatchMessage("")
      setSearchAction("idle")
      setSearchMessage("")
      setSearchResults(null)
      setSearchQuery("")
    }
    setOverride(current ? { scope, value: loadDanmakuOverride(current) } : null)
    if (!current) return

    const enmoku = current
    const controller = new AbortController()
    requests.current.add(controller)
    const active = () => !controller.signal.aborted && scopeRef.current === scope
    void (async () => {
      try {
        let fingerprint: BaiduMediaFingerprint | null = null
        try {
          fingerprint = (await input.fingerprint?.(enmoku)) ?? null
        } catch {
          // Fingerprint is optional evidence; ordinary metadata resolution still works.
        }
        if (!active()) return
        const query = fingerprint
          ? { fingerprint: fingerprint.value, fingerprintBytes: fingerprint.bytes }
          : {}
        const value = await fetchDanmakuCandidates(roomId, enmoku.id, query, {
          signal: controller.signal,
        })
        if (!active()) return
        setResolution({ scope: requestScope, value })
        setResolutionState("success")
      } catch {
        if (!active()) return
        setResolution({ scope: requestScope, value: fallbackResolution(roomId, enmoku) })
        setResolutionState("error")
        setResolutionError(t("danmakuSourceLoadFailed"))
      } finally {
        requests.current.delete(controller)
      }
    })()
    return () => {
      for (const request of requests.current) request.abort()
      requests.current.clear()
    }
  }, [roomId, current, requestScope, scope, input.fingerprint])

  const value = resolution?.scope === requestScope ? resolution.value : null
  const policy = value?.policy ?? defaultPolicy
  const roomDefault = current
    ? defaultsAuthoritative
      ? (roomDefaults[current.id] ?? null)
      : (value?.roomDefault ?? null)
    : null
  const candidates = useMemo(() => {
    const merged = new Map((value?.candidates ?? []).map((candidate) => [candidate.id, candidate]))
    const localCandidate = localCandidates[scope]
    if (localCandidate) merged.set(localCandidate.id, localCandidate)
    return [...merged.values()].map((candidate): DanmakuCandidate => {
      if (failedCandidate?.scope === scope && failedCandidate.value === candidate.id)
        return { ...candidate, availability: "failed", reason: t("danmakuSourceLoadFailed") }
      if (!policy.allowedClasses.includes(candidate.sourceClass))
        return { ...candidate, availability: "disabled", reason: t("danmakuSourceDisabled") }
      return candidate
    })
  }, [value, localCandidates, failedCandidate, policy, scope])
  const selection = resolveDanmakuSelection(
    candidates,
    override?.scope === scope ? override.value : null,
    roomDefault,
    policy,
  )
  const selected = selection.candidate
  const cues: readonly DanmakuCue[] =
    selected?.cues ??
    (legacyCues?.scope === scope && legacyCues.value.id === selected?.id
      ? legacyCues.value.cues
      : [])

  useEffect(() => {
    if (
      !selected?.legacyRef ||
      selected.cues ||
      (legacyCues?.scope === scope && legacyCues.value.id === selected.id)
    )
      return
    const controller = new AbortController()
    requests.current.add(controller)
    setCueState("pending")
    const candidateId = selected.id
    void fetchLegacyDanmakuCues(selected.legacyRef, { signal: controller.signal })
      .then((loaded) => {
        if (controller.signal.aborted || scopeRef.current !== scope) return
        setLegacyCues({ scope, value: { id: candidateId, cues: loaded } })
        setCueState("success")
      })
      .catch(() => {
        if (controller.signal.aborted || scopeRef.current !== scope) return
        setFailedCandidate({ scope, value: candidateId })
        setCueState("error")
      })
      .finally(() => requests.current.delete(controller))
    return () => controller.abort()
  }, [scope, selected?.id, selected?.legacyRef, selected?.cues, legacyCues])

  async function runAction(work: (signal: AbortSignal) => Promise<unknown>) {
    const controller = new AbortController()
    requests.current.add(controller)
    try {
      await work(controller.signal)
      return !controller.signal.aborted && scopeRef.current === scope
    } catch {
      return false
    } finally {
      requests.current.delete(controller)
    }
  }

  function select(candidateId: string) {
    if (!current) return
    const candidate = candidates.find((item) => item.id === candidateId)
    if (!candidate || !isDanmakuCandidateUsable(candidate)) return
    setOverride({ scope, value: saveDanmakuOverride(current, candidate.id, candidate.trackId) })
    setRoomMessage(t("danmakuSourceSaved"))
  }

  function clearOverride() {
    if (!current) return
    clearDanmakuOverride(current)
    setOverride({ scope, value: null })
    setRoomMessage("")
  }

  async function loadFile(file: File) {
    if (!current) return
    let text = ""
    try {
      text = await file.text()
    } catch {
      // An unreadable file becomes an unavailable local candidate.
    }
    if (scopeRef.current !== scope) return
    const candidate = createLocalDanmakuCandidate(current, file.name, text, t("fileDanmakuEmpty"))
    setLocalCandidates((items) => ({ ...items, [scope]: candidate }))
    if (candidate.availability === "available")
      setOverride({ scope, value: saveDanmakuOverride(current, candidate.id) })
  }

  async function setRoom(candidateId: string) {
    if (!canManageRoomDefault || !current) return
    const candidate = candidates.find((item) => item.id === candidateId)
    if (!candidate?.trackId || !isDanmakuCandidateUsable(candidate)) return
    const trackId = candidate.trackId
    setRoomAction("pending")
    setRoomMessage("")
    const ok = await runAction((signal) =>
      setDanmakuRoomDefault(roomId, current.id, trackId, { signal }),
    )
    if (scopeRef.current !== scope) return
    setRoomAction(ok ? "success" : "error")
    setRoomMessage(t(ok ? "danmakuSourceRoomDefaultSaved" : "danmakuSourceActionFailed"))
  }

  async function clearRoom() {
    if (!canManageRoomDefault || !current) return
    setRoomAction("pending")
    setRoomMessage("")
    const ok = await runAction((signal) => clearDanmakuRoomDefault(roomId, current.id, { signal }))
    if (scopeRef.current !== scope) return
    setRoomAction(ok ? "success" : "error")
    setRoomMessage(t(ok ? "danmakuSourceRoomDefaultCleared" : "danmakuSourceActionFailed"))
  }

  async function propose(candidateId: string) {
    const candidate = candidates.find((item) => item.id === candidateId)
    if (!candidate?.releaseId || !candidate.evidence?.length) {
      setProposalAction("error")
      setProposalMessage(t("danmakuSourceProposalUnavailable"))
      return
    }
    const releaseId = candidate.releaseId
    const evidence = [...candidate.evidence]
    setProposalAction("pending")
    setProposalMessage("")
    const ok = await runAction((signal) =>
      submitDanmakuPublicProposal(releaseId, evidence, { signal }),
    )
    if (scopeRef.current !== scope) return
    setProposalAction(ok ? "success" : "error")
    setProposalMessage(t(ok ? "danmakuSourceProposalSubmitted" : "danmakuSourceActionFailed"))
  }

  async function confirm(
    releaseId: string,
    episodeId: string,
    evidence: readonly DanmakuEvidence[],
  ) {
    setMatchAction("pending")
    setMatchMessage("")
    const ok = await runAction((signal) =>
      confirmDanmakuPersonalMatch(releaseId, episodeId, [...evidence], { signal }),
    )
    if (scopeRef.current !== scope) return
    setMatchAction(ok ? "success" : "error")
    setMatchMessage(t(ok ? "danmakuMatchConfirmed" : "danmakuMatchFailed"))
    if (ok) setReload((count) => count + 1)
  }

  async function search() {
    if (!value?.matchContext) return
    const query = searchQuery.trim()
    if (!query) {
      setSearchAction("error")
      setSearchMessage(t("danmakuManualSearchEnter"))
      setSearchResults({ scope, value: [] })
      return
    }
    setSearchAction("pending")
    setSearchMessage("")
    const controller = new AbortController()
    requests.current.add(controller)
    try {
      const found = await fetchDanmakuSearch(query, { signal: controller.signal })
      if (controller.signal.aborted || scopeRef.current !== scope) return
      setSearchResults({ scope, value: found })
      setSearchAction("success")
      setSearchMessage(found.length ? "" : t("danmakuManualSearchEmpty"))
    } catch {
      if (controller.signal.aborted || scopeRef.current !== scope) return
      setSearchResults({ scope, value: [] })
      setSearchAction("error")
      setSearchMessage(t("danmakuManualSearchFailed"))
    } finally {
      requests.current.delete(controller)
    }
  }

  const sourceState = !current
    ? "idle"
    : resolutionState === "pending" || cueState === "pending"
      ? "loading"
      : selection.origin === "fallback"
        ? "fallback"
        : resolutionState === "error" && !selected
          ? "error"
          : !selected || cues.length === 0
            ? cueState === "error"
              ? "error"
              : "empty"
            : "ready"

  return {
    candidates,
    selection,
    roomDefault,
    cues,
    sourceState,
    sourceError: resolutionError || (cueState === "error" ? t("danmakuSourceLoadFailed") : ""),
    override: override?.scope === scope ? override.value : null,
    matchCandidates: value?.matchCandidates ?? [],
    matchContext: value?.matchContext ?? null,
    searchQuery,
    setSearchQuery,
    searchResults: searchResults?.scope === scope ? searchResults.value : [],
    searchAction,
    searchMessage,
    roomAction,
    roomMessage,
    proposalAction,
    proposalMessage,
    matchAction,
    matchMessage,
    select,
    clearOverride,
    loadFile,
    setRoom,
    clearRoom,
    propose,
    confirm,
    search,
    retry: () => setReload((count) => count + 1),
  }
}
