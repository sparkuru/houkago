import type { Enmoku } from "houkago-kousoku"
import type {
  EnmokuSourceChoice,
  EnmokuSubtitleChoice,
} from "houkago-kyoushitsu-core/enmoku-metadata"
import {
  SUBTITLE_OFF_VALUE,
  enmokuSourceChoices,
  enmokuSubtitleChoices,
} from "houkago-kyoushitsu-core/enmoku-metadata"
import { t } from "houkago-kyoushitsu-core/i18n"
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import type { RoomRuntime } from "../room/room-runtime"
import { PlayerDriver } from "./player-driver"
import { PlayerIcon } from "./player-icon"
import { PlayerPanel } from "./player-panel"
import { formatPlayerTime } from "./player-time"
import "./player-stage.css"

export type PlayerStageProps = {
  room: RoomRuntime
  item: Enmoku
  url?: string
  type?: Enmoku["type"]
  sourceChoices?: readonly EnmokuSourceChoice[]
  selectedSourceValue?: string
  onSourceChange?: (value: string) => void
  subtitleChoices?: readonly EnmokuSubtitleChoice[]
  selectedSubtitleValue?: string
  onSubtitleChange?: (value: string) => void
  onTime?: (seconds: number) => void
  onOverlayContainerChange?: (element: HTMLElement | null) => void
  onComposerContainerChange?: (element: HTMLElement | null) => void
  onDanmakuControlsContainerChange?: (element: HTMLElement | null) => void
  onDanmakuSettingsContainerChange?: (element: HTMLElement | null) => void
  onControlsVisibilityChange?: (visible: boolean) => void
  overlay?: ReactNode
  cinemaMode?: boolean
  onCinemaChange?: (enabled: boolean) => void
  onFullscreenChange?: (enabled: boolean) => void
  controlLocked?: boolean
  showJoinGate?: boolean
}

export function PlayerStage({
  room,
  item,
  url,
  type,
  sourceChoices,
  selectedSourceValue,
  onSourceChange,
  subtitleChoices,
  selectedSubtitleValue,
  onSubtitleChange,
  onTime,
  onOverlayContainerChange,
  onComposerContainerChange,
  onDanmakuControlsContainerChange,
  onDanmakuSettingsContainerChange,
  onControlsVisibilityChange,
  overlay,
  cinemaMode,
  onCinemaChange,
  onFullscreenChange,
  controlLocked,
  showJoinGate,
}: PlayerStageProps) {
  const choices = useMemo(
    () => sourceChoices ?? enmokuSourceChoices(item, t("playerPrimarySource")),
    [sourceChoices, item],
  )
  const subtitles = useMemo(
    () => subtitleChoices ?? enmokuSubtitleChoices(item, t("playerSubtitleOff")),
    [subtitleChoices, item],
  )
  const [localSourceValue, setLocalSourceValue] = useState("primary")
  const [localSubtitleValue, setLocalSubtitleValue] = useState(SUBTITLE_OFF_VALUE)
  const [joined, setJoined] = useState(false)
  const joinedRef = useRef(false)
  const [localCinema, setLocalCinema] = useState(false)
  const [webFullscreen, setWebFullscreen] = useState(false)
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [panel, setPanel] = useState<"playback" | "danmaku" | "communication" | null>(null)
  const [compact, setCompact] = useState(false)
  const [idleHidden, setIdleHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null)
  const [screenNode, setScreenNode] = useState<HTMLDivElement | null>(null)
  const [stageNode, setStageNode] = useState<HTMLElement | null>(null)
  const [composerNode, setComposerNode] = useState<HTMLDivElement | null>(null)
  const [danmakuControlsNode, setDanmakuControlsNode] = useState<HTMLDivElement | null>(null)
  const [danmakuSettingsNode, setDanmakuSettingsNode] = useState<HTMLDivElement | null>(null)
  const toolsRef = useRef<HTMLDivElement>(null)
  const panelTrigger = useRef<HTMLButtonElement | null>(null)
  const surfacePointer = useRef("mouse")
  const idleActivity = useRef<() => void>(() => {})
  const panelId = useId()
  const previousWebFullscreen = useRef(false)
  const driverRef = useRef<PlayerDriver | null>(null)
  const timeCallback = useRef(onTime)
  timeCallback.current = onTime
  const sourceValue = selectedSourceValue ?? localSourceValue
  const activeSource = choices.find((choice) => choice.value === sourceValue) ?? choices[0]
  const mediaUrl = url ?? activeSource?.url ?? item.url
  const mediaType = type ?? item.type
  const subtitleValue = selectedSubtitleValue ?? localSubtitleValue
  const activeSubtitle = subtitles.find((choice) => choice.value === subtitleValue)
  const locked = controlLocked ?? !room.can("playback")
  const joinGate = showJoinGate ?? (!room.isHost && !joined)
  const cinema = cinemaMode ?? localCinema
  const fullscreen = webFullscreen || nativeFullscreen
  const controlsVisible =
    !fullscreen || !playing || Boolean(error) || joinGate || panel !== null || !idleHidden

  const closePanel = useCallback(() => {
    setPanel(null)
    const trigger = panelTrigger.current
    if (trigger?.getClientRects().length) trigger.focus()
    else
      stageNode?.querySelector<HTMLButtonElement>('[data-testid="player-settings-toggle"]')?.focus()
  }, [stageNode])

  // biome-ignore lint/correctness/useExhaustiveDependencies: item identity resets local viewing state.
  useEffect(() => {
    joinedRef.current = false
    setJoined(false)
    setLocalSourceValue("primary")
    setLocalSubtitleValue(SUBTITLE_OFF_VALUE)
    setTime(0)
    setDuration(0)
    setPlaying(false)
    setRate(1)
    setError(null)
    setPanel(null)
    setIdleHidden(false)
  }, [item.id])

  useEffect(() => {
    onOverlayContainerChange?.(screenNode)
    return () => onOverlayContainerChange?.(null)
  }, [screenNode, onOverlayContainerChange])

  useEffect(() => {
    onComposerContainerChange?.(composerNode)
    return () => onComposerContainerChange?.(null)
  }, [composerNode, onComposerContainerChange])

  useEffect(() => {
    onDanmakuControlsContainerChange?.(danmakuControlsNode)
    return () => onDanmakuControlsContainerChange?.(null)
  }, [danmakuControlsNode, onDanmakuControlsContainerChange])

  useEffect(() => {
    onDanmakuSettingsContainerChange?.(danmakuSettingsNode)
    return () => onDanmakuSettingsContainerChange?.(null)
  }, [danmakuSettingsNode, onDanmakuSettingsContainerChange])

  useEffect(() => {
    onControlsVisibilityChange?.(controlsVisible)
  }, [controlsVisible, onControlsVisibilityChange])

  useEffect(() => {
    const tools = toolsRef.current
    if (!stageNode || !tools) return
    const measure = () => {
      const inset = fullscreen && controlsVisible ? tools.getBoundingClientRect().height + 8 : 0
      stageNode.style.setProperty("--player-controls-inset", `${inset}px`)
      driverRef.current?.setControlsInset(inset)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(tools)
    measure()
    return () => observer.disconnect()
  }, [stageNode, fullscreen, controlsVisible])

  useEffect(
    () => () => {
      onFullscreenChange?.(false)
      onControlsVisibilityChange?.(true)
    },
    [onFullscreenChange, onControlsVisibilityChange],
  )

  useEffect(() => {
    if (!stageNode) return
    const measure = () => setCompact(stageNode.clientWidth < 640)
    const observer = new ResizeObserver(measure)
    observer.observe(stageNode)
    measure()
    return () => observer.disconnect()
  }, [stageNode])

  // biome-ignore lint/correctness/useExhaustiveDependencies: one driver owns an item; source changes use switchSource below.
  useEffect(() => {
    if (!mountNode || !mediaUrl) return
    let active = true
    const driver = new PlayerDriver(mountNode, mediaUrl, mediaType, {
      ready: () => {
        if (active && joinedRef.current) room.catchUpPlayback()
      },
      time: (seconds) => {
        if (!active) return
        setTime(seconds)
        timeCallback.current?.(seconds)
      },
      duration: (seconds) => {
        if (active) setDuration(seconds)
      },
      playback: (state) => {
        if (!active) return
        setPlaying(state.isPlaying)
        setRate(state.playbackRate)
        room.localPlayback(state)
      },
      volume: (value, isMuted) => {
        if (!active) return
        setVolume(value)
        setMuted(isMuted)
      },
      error: (message) => {
        if (active) setError(message)
      },
      subtitleUnavailable: () => {
        if (!active) return
        setError(t("playerSubtitleUnavailable"))
        if (onSubtitleChange) onSubtitleChange(SUBTITLE_OFF_VALUE)
        else setLocalSubtitleValue(SUBTITLE_OFF_VALUE)
      },
    })
    driverRef.current = driver
    const detach = room.attachPlayer(driver)
    return () => {
      active = false
      detach()
      driver.dispose()
      if (driverRef.current === driver) driverRef.current = null
    }
  }, [room, item.id, mountNode])

  useEffect(() => {
    driverRef.current?.switchSource(mediaUrl, mediaType)
    setError(null)
  }, [mediaUrl, mediaType])

  useEffect(() => {
    driverRef.current?.setSubtitle(
      subtitleValue === SUBTITLE_OFF_VALUE ? null : (activeSubtitle?.label ?? null),
    )
  }, [subtitleValue, activeSubtitle?.label])

  useEffect(() => {
    if (!stageNode) return
    let wasFullscreen = false
    const onFullscreen = () => {
      const active = document.fullscreenElement === stageNode
      setNativeFullscreen(active)
      setIdleHidden(false)
      if (wasFullscreen && !active) {
        setPanel(null)
        stageNode
          .querySelector<HTMLButtonElement>('[data-testid="player-native-fullscreen"]')
          ?.focus()
      }
      wasFullscreen = active
    }
    onFullscreen()
    document.addEventListener("fullscreenchange", onFullscreen)
    return () => document.removeEventListener("fullscreenchange", onFullscreen)
  }, [stageNode])

  useEffect(() => {
    onFullscreenChange?.(webFullscreen || nativeFullscreen)
  }, [nativeFullscreen, onFullscreenChange, webFullscreen])

  useEffect(() => {
    if (previousWebFullscreen.current && !webFullscreen) {
      setPanel(null)
      const trigger = stageNode?.querySelector<HTMLButtonElement>(
        '[data-testid="player-web-fullscreen"]',
      )
      if (trigger?.getClientRects().length) trigger.focus()
      else
        stageNode
          ?.querySelector<HTMLButtonElement>('[data-testid="player-settings-toggle"]')
          ?.focus()
    }
    previousWebFullscreen.current = webFullscreen
    if (!webFullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [stageNode, webFullscreen])

  useEffect(() => {
    if (!stageNode) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return
      if (panel !== null) {
        event.preventDefault()
        closePanel()
      } else if (webFullscreen) {
        event.preventDefault()
        setWebFullscreen(false)
      }
    }
    stageNode.addEventListener("keydown", onKey)
    return () => stageNode.removeEventListener("keydown", onKey)
  }, [panel, stageNode, webFullscreen, closePanel])

  useEffect(() => {
    if (!stageNode || !fullscreen || !playing || panel !== null || error || joinGate) {
      setIdleHidden(false)
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const reveal = () => {
      clearTimeout(timer)
      setIdleHidden(false)
      timer = setTimeout(() => {
        if (!toolsRef.current?.contains(document.activeElement)) setIdleHidden(true)
      }, 2500)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "mouse") reveal()
    }
    const focus = (event: FocusEvent) => {
      if (
        !(event.target instanceof HTMLElement) ||
        !event.target.classList.contains("player-screen-target")
      )
        reveal()
    }
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.classList.contains("player-screen-target") &&
        (event.key === "Enter" || event.key === " ")
      )
        return
      reveal()
    }
    stageNode.addEventListener("pointermove", move)
    stageNode.addEventListener("focusin", focus)
    stageNode.addEventListener("focusout", reveal)
    stageNode.addEventListener("keydown", key)
    idleActivity.current = reveal
    reveal()
    return () => {
      idleActivity.current = () => {}
      clearTimeout(timer)
      stageNode.removeEventListener("pointermove", move)
      stageNode.removeEventListener("focusin", focus)
      stageNode.removeEventListener("focusout", reveal)
      stageNode.removeEventListener("keydown", key)
    }
  }, [stageNode, fullscreen, playing, panel, error, joinGate])

  useEffect(() => {
    if (panel === null) return
    const target =
      panel === "communication"
        ? composerNode
        : toolsRef.current?.querySelector(`#${CSS.escape(panelId)}-${panel}`)
    const frame = requestAnimationFrame(() => {
      target?.querySelector<HTMLElement>("input, select, summary, button")?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [panel, composerNode, panelId])

  function selectSource(value: string): void {
    if (onSourceChange) onSourceChange(value)
    else setLocalSourceValue(value)
  }

  function selectSubtitle(value: string): void {
    setError(null)
    if (onSubtitleChange) onSubtitleChange(value)
    else setLocalSubtitleValue(value)
  }

  function changeCinema(value: boolean): void {
    if (onCinemaChange) onCinemaChange(value)
    else setLocalCinema(value)
  }

  function togglePlayback(): void {
    if (locked || !room.can("playback")) return
    const driver = driverRef.current
    if (!driver) return
    const before = driver.snapshot()
    driver.togglePlayback()
    room.userPlayback({ ...before, isPlaying: !before.isPlaying })
  }

  function seek(seconds: number): void {
    if (locked || !room.can("playback")) return
    const driver = driverRef.current
    if (!driver) return
    driver.seek(seconds)
    room.userPlayback({ ...driver.snapshot(), currentTime: seconds })
  }

  function changeRate(nextRate: number): void {
    if (locked || !room.can("playback")) return
    const driver = driverRef.current
    if (!driver) return
    driver.changeRate(nextRate)
    room.userPlayback({ ...driver.snapshot(), playbackRate: nextRate })
  }

  function join(): void {
    // Keep the audible play attempt in the click stack before sync catch-up.
    driverRef.current?.playForJoin()
    joinedRef.current = true
    setJoined(true)
    room.catchUpPlayback()
  }

  async function toggleNativeFullscreen(): Promise<void> {
    if (!stageNode) return
    try {
      if (document.fullscreenElement === stageNode) await document.exitFullscreen()
      else {
        setWebFullscreen(false)
        changeCinema(false)
        setPanel(null)
        await stageNode.requestFullscreen()
      }
    } catch {
      setError(t("playerFullscreenUnavailable"))
    }
  }

  async function toggleWebFullscreen(): Promise<void> {
    if (document.fullscreenElement === stageNode) await document.exitFullscreen()
    if (!webFullscreen) changeCinema(false)
    setPanel(null)
    setIdleHidden(false)
    setWebFullscreen(!webFullscreen)
  }

  async function toggleCinema(): Promise<void> {
    if (document.fullscreenElement === stageNode) await document.exitFullscreen()
    setWebFullscreen(false)
    setPanel(null)
    changeCinema(!cinema)
  }

  function togglePanel(next: NonNullable<typeof panel>, trigger: HTMLButtonElement): void {
    panelTrigger.current = trigger
    setPanel((current) => (current === next ? null : next))
    setIdleHidden(false)
  }

  const webControl = (
    <button
      className="player-icon-button"
      type="button"
      data-testid="player-web-fullscreen"
      aria-label={webFullscreen ? t("playerWebExit") : t("playerWebFullscreen")}
      title={webFullscreen ? t("playerWebExit") : t("playerWebFullscreen")}
      aria-pressed={webFullscreen}
      onClick={() => void toggleWebFullscreen()}
    >
      <PlayerIcon name={webFullscreen ? "exit" : "web"} />
      {compact && !webFullscreen && <span>{t("playerWebFullscreen")}</span>}
    </button>
  )
  const nativeControl = (
    <button
      className="player-icon-button"
      type="button"
      data-testid="player-native-fullscreen"
      aria-pressed={nativeFullscreen}
      onClick={() => void toggleNativeFullscreen()}
      aria-label={nativeFullscreen ? t("playerNativeExit") : t("playerNativeFullscreen")}
      title={nativeFullscreen ? t("playerNativeExit") : t("playerNativeFullscreen")}
    >
      <PlayerIcon name={nativeFullscreen ? "exit" : "fullscreen"} />
      {compact && webFullscreen && <span>{t("playerNativeFullscreen")}</span>}
    </button>
  )
  const danmakuSettingsControl = (
    <button
      type="button"
      className="player-icon-button"
      aria-label={t("danmakuSettings")}
      title={t("danmakuSettings")}
      aria-expanded={panel === "danmaku"}
      aria-controls={`${panelId}-danmaku`}
      onClick={(event) => togglePanel("danmaku", event.currentTarget)}
    >
      <PlayerIcon name="danmaku" />
      {compact && <span>{t("danmakuSettings")}</span>}
    </button>
  )
  const viewingModes = (
    <>
      <button
        className="player-icon-button"
        type="button"
        aria-label={t("playerCinema")}
        title={t("playerCinema")}
        aria-pressed={cinema}
        onClick={() => void toggleCinema()}
      >
        <PlayerIcon name="cinema" />
        {compact && <span>{t("playerCinema")}</span>}
      </button>
      {compact && webFullscreen ? nativeControl : webControl}
    </>
  )

  return (
    <section
      ref={setStageNode}
      className={`player-stage${webFullscreen ? " player-web-fullscreen" : ""}`}
      data-compact={compact}
      aria-label={t("playerStage")}
    >
      <div ref={setScreenNode} className={`player-screen${locked ? " player-control-locked" : ""}`}>
        <div className="player-mount" ref={setMountNode} />
        <button
          type="button"
          className="player-screen-target"
          aria-label={fullscreen ? t("playerControlsToggle") : t("playerPlaybackToggle")}
          aria-pressed={fullscreen ? controlsVisible : undefined}
          disabled={!fullscreen && locked}
          onPointerDown={(event) => {
            surfacePointer.current = event.pointerType
          }}
          onClick={(event) => {
            if (panel !== null) {
              closePanel()
              return
            }
            if (fullscreen) {
              idleActivity.current()
              if (event.detail === 0 || surfacePointer.current === "touch")
                setIdleHidden(!idleHidden)
            } else togglePlayback()
          }}
        />
        <div className="player-overlay">{overlay}</div>
        {joinGate && (
          <button className="player-join-gate" type="button" onClick={join} disabled={!mediaUrl}>
            {t("playerJoin")}
          </button>
        )}
      </div>
      {error && (
        <p className="player-error" role="alert">
          {error}
        </p>
      )}
      <div
        className="player-tools"
        ref={toolsRef}
        data-visible={controlsVisible}
        aria-hidden={!controlsVisible}
        inert={!controlsVisible}
      >
        <PlayerPanel
          id={`${panelId}-playback`}
          label={t("playerSettings")}
          open={panel === "playback"}
          anchor={toolsRef}
          onClose={closePanel}
        >
          <label>
            {t("playerRate")}
            <select
              data-testid="player-rate"
              disabled={locked}
              value={rate}
              onChange={(event) => changeRate(Number(event.target.value))}
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => (
                <option value={value} key={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("playerVolume")}
            <input
              type="range"
              data-testid="player-volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(event) => driverRef.current?.setVolume(Number(event.target.value))}
            />
          </label>
          {compact && (
            <button
              type="button"
              className="player-panel-mute"
              aria-pressed={muted || volume === 0}
              onClick={() => driverRef.current?.toggleMuted()}
            >
              <PlayerIcon name={muted || volume === 0 ? "muted" : "volume"} />
              {muted || volume === 0 ? t("playerUnmute") : t("playerMute")}
            </button>
          )}
          {choices.length > 1 && (
            <label>
              {t("playerSource")}
              <select
                data-testid="player-source"
                value={activeSource?.value ?? "primary"}
                onChange={(event) => selectSource(event.target.value)}
              >
                {choices.map((choice) => (
                  <option value={choice.value} key={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {subtitles.length > 1 && (
            <label>
              {t("playerSubtitle")}
              <select
                data-testid="player-subtitle"
                value={subtitleValue}
                onChange={(event) => selectSubtitle(event.target.value)}
              >
                {subtitles.map((choice) => (
                  <option value={choice.value} key={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {compact && fullscreen && danmakuSettingsControl}
          {compact && (
            <fieldset className="player-view-modes">
              <legend>{t("playerViewModes")}</legend>
              {viewingModes}
            </fieldset>
          )}
        </PlayerPanel>
        <PlayerPanel
          className="player-danmaku-panel"
          id={`${panelId}-danmaku`}
          label={t("playerDanmakuPanel")}
          heading={t("danmakuSettings")}
          open={fullscreen && panel === "danmaku"}
          anchor={toolsRef}
          onClose={closePanel}
        >
          <div ref={setDanmakuSettingsNode} />
        </PlayerPanel>
        <PlayerPanel
          className="player-communication-panel"
          id={`${panelId}-communication`}
          label={t("playerCommunication")}
          heading={t("playerCommunicationHeading")}
          open={fullscreen && panel === "communication"}
          anchor={toolsRef}
          onClose={closePanel}
        >
          <div ref={setComposerNode} />
        </PlayerPanel>
        <div className="player-controls">
          <label className="player-progress">
            <span className="sr-only">{t("playerProgress")}</span>
            <input
              type="range"
              data-testid="player-seek"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.1}
              value={Math.min(time, duration > 0 ? duration : 1)}
              disabled={locked || duration <= 0}
              onChange={(event) => seek(Number(event.target.value))}
            />
          </label>
          <div className="player-toolbar">
            <button
              className="player-icon-button"
              type="button"
              data-testid="player-play-toggle"
              disabled={locked || !mediaUrl}
              onClick={togglePlayback}
              aria-label={playing ? t("playerPause") : t("playerPlay")}
              title={playing ? t("playerPause") : t("playerPlay")}
            >
              <PlayerIcon name={playing ? "pause" : "play"} />
            </button>
            {!compact && (
              <button
                type="button"
                className="player-icon-button"
                aria-label={muted || volume === 0 ? t("playerUnmute") : t("playerMute")}
                title={muted || volume === 0 ? t("playerUnmute") : t("playerMute")}
                aria-pressed={muted || volume === 0}
                onClick={() => driverRef.current?.toggleMuted()}
              >
                <PlayerIcon name={muted || volume === 0 ? "muted" : "volume"} />
              </button>
            )}
            <span className="player-time" aria-live="off">
              {formatPlayerTime(time)}
              <span>
                <span className="player-time-divider"> / </span>
                {duration > 0 ? formatPlayerTime(duration) : "--:--"}
              </span>
            </span>
            <div className="player-toolbar-spacer" />
            <div className="player-danmaku-control" ref={setDanmakuControlsNode} />
            {fullscreen && !compact && danmakuSettingsControl}
            {fullscreen && (
              <button
                type="button"
                className="player-icon-button"
                aria-label={t("playerCommunicationOpen")}
                title={t("playerCommunication")}
                aria-expanded={panel === "communication"}
                aria-controls={`${panelId}-communication`}
                onClick={(event) => togglePanel("communication", event.currentTarget)}
              >
                <PlayerIcon name="chat" />
              </button>
            )}
            <button
              type="button"
              className="player-icon-button"
              data-testid="player-settings-toggle"
              aria-label={t("playerSettings")}
              title={t("playerSettings")}
              aria-expanded={panel === "playback"}
              aria-controls={`${panelId}-playback`}
              onClick={(event) => togglePanel("playback", event.currentTarget)}
            >
              <PlayerIcon name="settings" />
            </button>
            {!compact && viewingModes}
            {compact && webFullscreen ? webControl : nativeControl}
          </div>
        </div>
      </div>
    </section>
  )
}
