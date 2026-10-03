import type { DanmakuDefault, Enmoku } from "houkago-kousoku"
import { danmakuTrackBottom } from "houkago-kyoushitsu-core/danmaku-track"
import {
  type FileDanmakuViewport,
  type VisibleDanmakuCue,
  fileDanmakuRenderKey,
  fileDanmakuViewport,
  visibleFileDanmakuCues,
} from "houkago-kyoushitsu-core/file-danmaku"
import {
  loadFileDanmakuEnabled,
  saveFileDanmakuEnabled,
} from "houkago-kyoushitsu-core/file-danmaku-pref"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { type TimelineDanmakuInput, useTimelineDanmaku } from "./use-timeline-danmaku"
import "./danmaku-feature.css"

type ChatLine = { senderId: string; content: string; ts: number; kind: "chat" | "danmaku" }
type Bubble = { id: number; senderId: string; content: string; lane: number }
type ChatNotification = { id: number; senderId: string; content: string }

export type DanmakuFeatureProps = {
  roomId: string
  identityId: string
  current: Enmoku | null
  roomDefaults: Readonly<Record<string, DanmakuDefault>>
  defaultsAuthoritative: boolean
  isHost: boolean
  canManageRoomDefault: boolean
  chat: readonly ChatLine[]
  names: Readonly<Record<string, string>>
  mediaTime: number
  overlayContainer: HTMLElement | null
  controlsShown?: boolean
  fingerprint?: TimelineDanmakuInput["fingerprint"]
}

function sourceLabel(source: string) {
  switch (source) {
    case "server-stored":
      return t("danmakuSourceServerStored")
    case "provider-official":
      return t("danmakuSourceProviderOfficial")
    case "local":
      return t("danmakuSourceLocal")
    default:
      return t("danmakuSourceThirdParty")
  }
}

function originLabel(origin: string) {
  switch (origin) {
    case "viewer-override":
      return t("danmakuSourceScopeViewer")
    case "room-default":
      return t("danmakuSourceScopeRoom")
    case "fallback":
      return t("danmakuSourceFallback")
    case "strategy":
      return t("danmakuSourceScopeGlobal")
    default:
      return t("danmakuNone")
  }
}

function cueTransform(cue: VisibleDanmakuCue, width: number) {
  const distance = cue.progress * width
  const amount = cue.progress * 100
  if (cue.mode === "reverse") return `translate3d(calc(${distance}px + ${amount}%), 0, 0)`
  if (cue.mode === "top" || cue.mode === "bottom" || cue.mode === "special")
    return "translate3d(-50%, 0, 0)"
  return `translate3d(calc(-${distance}px - ${amount}%), 0, 0)`
}

function useViewport(target: HTMLElement | null): FileDanmakuViewport {
  const [viewport, setViewport] = useState<FileDanmakuViewport>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  })
  useEffect(() => {
    if (!target) return
    let observedVideo: HTMLVideoElement | null = null
    const measure = () => {
      const targetRect = target.getBoundingClientRect()
      const video = target.querySelector("video")
      if (!(video instanceof HTMLVideoElement)) {
        setViewport({ left: 0, top: 0, width: targetRect.width, height: targetRect.height })
        return
      }
      if (observedVideo !== video) {
        if (observedVideo) {
          observer?.unobserve(observedVideo)
          observedVideo.removeEventListener("loadedmetadata", measure)
          observedVideo.removeEventListener("resize", measure)
        }
        observedVideo = video
        observer?.observe(video)
        video.addEventListener("loadedmetadata", measure)
        video.addEventListener("resize", measure)
      }
      const videoRect = video.getBoundingClientRect()
      const size = fileDanmakuViewport(
        videoRect.width,
        videoRect.height,
        video.videoWidth,
        video.videoHeight,
      )
      setViewport({
        left: videoRect.left - targetRect.left + size.left,
        top: videoRect.top - targetRect.top + size.top,
        width: size.width,
        height: size.height,
      })
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure)
    observer?.observe(target)
    mutations?.observe(target, { childList: true, subtree: true })
    window.addEventListener("resize", measure)
    measure()
    return () => {
      observer?.disconnect()
      mutations?.disconnect()
      observedVideo?.removeEventListener("loadedmetadata", measure)
      observedVideo?.removeEventListener("resize", measure)
      window.removeEventListener("resize", measure)
    }
  }, [target])
  return viewport
}

export function DanmakuFeature(props: DanmakuFeatureProps) {
  const timeline = useTimelineDanmaku(props)
  const fileInput = useRef<HTMLInputElement>(null)
  const [fileEnabled, setFileEnabled] = useState(() => {
    try {
      return loadFileDanmakuEnabled()
    } catch {
      return false
    }
  })
  const [liveEnabled, setLiveEnabled] = useState(true)
  const [size, setSize] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [timeOffset, setTimeOffset] = useState(0)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [chatNotifications, setChatNotifications] = useState<ChatNotification[]>([])
  const lastLine = useRef<ChatLine | null>(null)
  const lastChatLine = useRef<ChatLine | null>(null)
  const seenInitialLines = useRef(false)
  const seenInitialChatLines = useRef(false)
  const liveScope = `${props.roomId}\0${props.identityId}`
  const previousLiveScope = useRef<string | null>(null)
  const bubbleId = useRef(0)
  const notificationId = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const viewport = useViewport(props.overlayContainer)
  const visible = useMemo(
    () =>
      fileEnabled ? visibleFileDanmakuCues(timeline.cues, props.mediaTime + timeOffset, speed) : [],
    [fileEnabled, timeline.cues, props.mediaTime, timeOffset, speed],
  )

  useEffect(() => {
    if (previousLiveScope.current === liveScope) return
    previousLiveScope.current = liveScope
    for (const timer of timers.current) clearTimeout(timer)
    timers.current.clear()
    setBubbles([])
    setChatNotifications([])
    lastLine.current = null
    lastChatLine.current = null
    seenInitialLines.current = false
    seenInitialChatLines.current = false
  }, [liveScope])

  useEffect(() => {
    const lines = props.chat.filter((line) => line.kind === "danmaku")
    if (!seenInitialLines.current) {
      seenInitialLines.current = true
      lastLine.current = lines.at(-1) ?? null
      return
    }
    const previous = lastLine.current ? lines.indexOf(lastLine.current) : -1
    const additions = previous < 0 ? lines.slice(-1) : lines.slice(previous + 1)
    lastLine.current = lines.at(-1) ?? null
    if (!liveEnabled) return
    for (const line of additions) {
      const id = ++bubbleId.current
      setBubbles((items) =>
        [...items, { id, senderId: line.senderId, content: line.content, lane: id % 4 }].slice(-5),
      )
      const timer = setTimeout(() => {
        setBubbles((items) => items.filter((item) => item.id !== id))
        timers.current.delete(timer)
      }, 5600)
      timers.current.add(timer)
    }
  }, [props.chat, liveEnabled])

  useEffect(() => {
    const lines = props.chat.filter((line) => line.kind === "chat")
    if (!seenInitialChatLines.current) {
      seenInitialChatLines.current = true
      lastChatLine.current = lines.at(-1) ?? null
      return
    }
    const previous = lastChatLine.current ? lines.indexOf(lastChatLine.current) : -1
    const additions = previous < 0 ? lines.slice(-1) : lines.slice(previous + 1)
    lastChatLine.current = lines.at(-1) ?? null
    for (const line of additions) {
      const id = ++notificationId.current
      setChatNotifications((items) =>
        [...items, { id, senderId: line.senderId, content: line.content }].slice(-3),
      )
      const timer = setTimeout(() => {
        setChatNotifications((items) => items.filter((item) => item.id !== id))
        timers.current.delete(timer)
      }, 5600)
      timers.current.add(timer)
    }
  }, [props.chat])

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer)
      timers.current.clear()
    },
    [],
  )

  function toggleFile() {
    setFileEnabled((enabled) => {
      const next = !enabled
      try {
        saveFileDanmakuEnabled(next)
      } catch {
        /* best effort preference */
      }
      return next
    })
  }

  const overlays =
    props.overlayContainer &&
    createPortal(
      <>
        {fileEnabled && (
          <div
            className="danmaku-timeline-overlay"
            aria-hidden="true"
            style={{
              left: viewport.left,
              top: viewport.top,
              width: viewport.width,
              height: viewport.height,
              fontSize: `${22 * size}px`,
              opacity,
            }}
          >
            {visible.map((cue) => (
              <span
                key={fileDanmakuRenderKey(cue, 0)}
                className={`danmaku-cue danmaku-cue-${cue.mode}`}
                style={{
                  top: cue.mode === "bottom" ? undefined : `calc(10px + ${cue.lane} * 30px)`,
                  bottom: cue.mode === "bottom" ? `calc(72px + ${cue.lane} * 30px)` : undefined,
                  color: cue.color,
                  opacity: cue.opacity,
                  transform: cueTransform(cue, viewport.width),
                }}
              >
                {cue.text}
              </span>
            ))}
          </div>
        )}
        <div className="danmaku-live-overlay">
          <button
            type="button"
            className="danmaku-live-toggle"
            aria-label={t(liveEnabled ? "danmakuHideAria" : "danmakuShowAria")}
            aria-pressed={liveEnabled}
            onClick={() => {
              setLiveEnabled((value) => !value)
              setBubbles([])
            }}
          >
            {t(liveEnabled ? "danmakuOn" : "danmakuOff")}
          </button>
          {liveEnabled && (
            <ul className="danmaku-live-track" aria-label="实时弹幕">
              {bubbles.map((bubble) => (
                <li
                  key={bubble.id}
                  className="danmaku-live-bubble"
                  style={{ top: `${8 + bubble.lane * 18}%` }}
                >
                  <span>{props.names[bubble.senderId] ?? bubble.senderId}</span> · {bubble.content}
                </li>
              ))}
            </ul>
          )}
          <ul
            className="danmaku-chat-live-track"
            aria-label="聊天室通知"
            aria-live="polite"
            style={{ bottom: danmakuTrackBottom(props.controlsShown ?? true) }}
          >
            {chatNotifications.map((notification) => (
              <li key={notification.id} className="danmaku-chat-live-notification">
                {props.names[notification.senderId] ?? notification.senderId}：
                {notification.content}
              </li>
            ))}
          </ul>
        </div>
      </>,
      props.overlayContainer,
    )

  return (
    <section className="danmaku-feature" aria-label={t("danmakuSettings")}>
      {overlays}
      <details className="danmaku-source-panel">
        <summary>
          {t("danmakuSourcePanel")} · {timeline.selection.candidate?.name ?? t("danmakuNone")}
        </summary>
        <div className="danmaku-source-body">
          {(timeline.sourceState !== "ready" || timeline.sourceError) && (
            <output aria-live="polite">
              {timeline.sourceError ||
                (timeline.sourceState === "loading"
                  ? t("danmakuSourceLoading")
                  : timeline.sourceState === "fallback"
                    ? t("danmakuSourceFallback")
                    : timeline.sourceState === "empty"
                      ? t("danmakuSourceEmpty")
                      : "")}
            </output>
          )}
          <ul className="danmaku-candidate-list" aria-label={t("danmakuSourcePanelAria")}>
            {timeline.candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  aria-pressed={timeline.selection.candidate?.id === candidate.id}
                  disabled={candidate.availability !== "available"}
                  onClick={() => timeline.select(candidate.id)}
                >
                  <strong>{candidate.name}</strong>
                  <small>
                    {sourceLabel(candidate.sourceClass)} · {t("danmakuSourceProvenance")}
                    {candidate.provenance?.label ??
                      candidate.provenance?.provider ??
                      t("danmakuSourceScopeGlobal")}
                    {timeline.selection.candidate?.id === candidate.id &&
                      ` · ${originLabel(timeline.selection.origin)}`}
                  </small>
                  {candidate.availability !== "available" && (
                    <small>{candidate.reason ?? t("danmakuSourceUnavailable")}</small>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="danmaku-source-actions">
            <input
              ref={fileInput}
              type="file"
              accept=".xml,text/xml,application/xml"
              aria-label={t("danmakuSourceFile")}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void timeline.loadFile(file)
              }}
            />
            <button type="button" onClick={() => fileInput.current?.click()}>
              {t("danmakuSourceChooseFile")}
            </button>
            <button type="button" onClick={toggleFile} aria-pressed={fileEnabled}>
              {t(fileEnabled ? "fileDanmakuOn" : "fileDanmakuOff")}
            </button>
            <button type="button" onClick={timeline.clearOverride} disabled={!timeline.override}>
              {t("danmakuSourceClearPersonally")}
            </button>
            {props.isHost && timeline.selection.candidate?.trackId && (
              <button
                type="button"
                disabled={!props.canManageRoomDefault || timeline.roomAction === "pending"}
                onClick={() => {
                  const candidate = timeline.selection.candidate
                  if (candidate) void timeline.setRoom(candidate.id)
                }}
              >
                {t("danmakuSourceSetRoomDefault")}
              </button>
            )}
            {props.isHost && timeline.roomDefault && (
              <button
                type="button"
                disabled={!props.canManageRoomDefault || timeline.roomAction === "pending"}
                onClick={() => void timeline.clearRoom()}
              >
                {t("danmakuSourceClearRoomDefault")}
              </button>
            )}
            {timeline.selection.candidate && (
              <button
                type="button"
                disabled={timeline.proposalAction === "pending"}
                onClick={() => {
                  const candidate = timeline.selection.candidate
                  if (candidate) void timeline.propose(candidate.id)
                }}
              >
                {t("danmakuSourceSubmitProposal")}
              </button>
            )}
            {(timeline.sourceState === "error" || timeline.sourceState === "fallback") && (
              <button type="button" onClick={timeline.retry}>
                {t("danmakuSourceRetry")}
              </button>
            )}
          </div>
          {timeline.roomMessage && <output>{timeline.roomMessage}</output>}
          {timeline.proposalMessage && <output>{timeline.proposalMessage}</output>}
          {timeline.matchCandidates.length > 0 && (
            <section className="danmaku-match-section">
              <h3>{t("danmakuMatchHeading")}</h3>
              <p>{t("danmakuMatchHint")}</p>
              <ul>
                {timeline.matchCandidates.map((candidate) => (
                  <li key={candidate.episodeId}>
                    <span>
                      {candidate.title} · {candidate.score.toFixed(0)}/100
                    </span>
                    <button
                      type="button"
                      disabled={timeline.matchAction === "pending"}
                      onClick={() =>
                        void timeline.confirm(
                          candidate.releaseId,
                          candidate.episodeId,
                          candidate.evidence,
                        )
                      }
                    >
                      {t("danmakuMatchConfirm")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {timeline.matchContext && (
            <form
              className="danmaku-manual-search"
              onSubmit={(event) => {
                event.preventDefault()
                void timeline.search()
              }}
            >
              <h3>{t("danmakuManualSearchHeading")}</h3>
              <label htmlFor="danmaku-manual-search">{t("danmakuManualSearchLabel")}</label>
              <div>
                <input
                  id="danmaku-manual-search"
                  type="search"
                  value={timeline.searchQuery}
                  onChange={(event) => timeline.setSearchQuery(event.target.value)}
                />
                <button type="submit" disabled={timeline.searchAction === "pending"}>
                  {t("danmakuManualSearchAction")}
                </button>
              </div>
              <ul>
                {timeline.searchResults.map((episode) => (
                  <li key={episode.id}>
                    {episode.title}
                    <button
                      type="button"
                      disabled={timeline.matchAction === "pending"}
                      onClick={() => {
                        const context = timeline.matchContext
                        if (context)
                          void timeline.confirm(context.releaseId, episode.id, context.evidence)
                      }}
                    >
                      {t("danmakuManualSearchConfirm")}
                    </button>
                  </li>
                ))}
              </ul>
              {timeline.searchMessage && <output>{timeline.searchMessage}</output>}
            </form>
          )}
          {timeline.matchMessage && <output>{timeline.matchMessage}</output>}
          <fieldset className="danmaku-display-settings">
            <legend>{t("danmakuSettings")}</legend>
            <label>
              {t("danmakuSize")}
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={size}
                onChange={(event) => setSize(Number(event.target.value))}
              />
            </label>
            <label>
              {t("danmakuOpacity")}
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
              />
            </label>
            <label>
              {t("danmakuSpeed")}
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              />
            </label>
            <label>
              {t("danmakuTimeOffset")}
              <input
                type="number"
                min="-30"
                max="30"
                step="0.5"
                value={timeOffset}
                onChange={(event) => setTimeOffset(Number(event.target.value))}
              />
            </label>
          </fieldset>
        </div>
      </details>
    </section>
  )
}
