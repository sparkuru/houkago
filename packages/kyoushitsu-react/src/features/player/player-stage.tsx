import type { Enmoku } from "houkago-kousoku"
import type { EnmokuSourceChoice, EnmokuSubtitleChoice } from "houkago-kyoushitsu/enmoku-metadata"
import {
  SUBTITLE_OFF_VALUE,
  enmokuSourceChoices,
  enmokuSubtitleChoices,
} from "houkago-kyoushitsu/enmoku-metadata"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import type { RoomRuntime } from "../room/room-runtime"
import { PlayerDriver } from "./player-driver"
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
  overlay?: ReactNode
  cinemaMode?: boolean
  onCinemaChange?: (enabled: boolean) => void
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
  overlay,
  cinemaMode,
  onCinemaChange,
  controlLocked,
  showJoinGate,
}: PlayerStageProps) {
  const choices = useMemo(
    () => sourceChoices ?? enmokuSourceChoices(item, "主线路"),
    [sourceChoices, item],
  )
  const subtitles = useMemo(
    () => subtitleChoices ?? enmokuSubtitleChoices(item, "关闭字幕"),
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
  const [error, setError] = useState<string | null>(null)
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null)
  const [screenNode, setScreenNode] = useState<HTMLDivElement | null>(null)
  const [stageNode, setStageNode] = useState<HTMLElement | null>(null)
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
  }, [item.id])

  useEffect(() => {
    onOverlayContainerChange?.(screenNode)
    return () => onOverlayContainerChange?.(null)
  }, [screenNode, onOverlayContainerChange])

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
      error: (message) => {
        if (active) setError(message)
      },
      subtitleUnavailable: () => {
        if (!active) return
        setError("所选字幕不可用")
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
    const onFullscreen = () => setNativeFullscreen(document.fullscreenElement === stageNode)
    document.addEventListener("fullscreenchange", onFullscreen)
    return () => document.removeEventListener("fullscreenchange", onFullscreen)
  }, [stageNode])

  useEffect(() => {
    if (!webFullscreen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWebFullscreen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [webFullscreen])

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
    const driver = driverRef.current
    if (!driver) return
    const before = driver.snapshot()
    driver.togglePlayback()
    room.userPlayback({ ...before, isPlaying: !before.isPlaying })
  }

  function seek(seconds: number): void {
    const driver = driverRef.current
    if (!driver) return
    driver.seek(seconds)
    room.userPlayback({ ...driver.snapshot(), currentTime: seconds })
  }

  function changeRate(nextRate: number): void {
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
        await stageNode.requestFullscreen()
      }
    } catch {
      setError("全屏不可用")
    }
  }

  function toggleWebFullscreen(): void {
    if (!webFullscreen) changeCinema(false)
    setWebFullscreen(!webFullscreen)
  }

  return (
    <section
      ref={setStageNode}
      className={`player-stage${webFullscreen ? " player-web-fullscreen" : ""}`}
      aria-label="视频播放器"
    >
      <div ref={setScreenNode} className={`player-screen${locked ? " player-control-locked" : ""}`}>
        <div className="player-mount" ref={setMountNode} />
        <div className="player-overlay">{overlay}</div>
        {joinGate && (
          <button className="player-join-gate" type="button" onClick={join} disabled={!mediaUrl}>
            点击参加放映
          </button>
        )}
        {webFullscreen && (
          <button
            className="player-web-exit"
            type="button"
            onClick={toggleWebFullscreen}
            aria-label="退出网页全屏"
          >
            退出全屏
          </button>
        )}
      </div>
      {error && (
        <p className="player-error" role="alert">
          {error}
        </p>
      )}
      <div className="player-controls">
        <button
          type="button"
          data-testid="player-play-toggle"
          disabled={locked || !mediaUrl}
          onClick={togglePlayback}
        >
          {playing ? "暂停" : "播放"}
        </button>
        <label>
          进度
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
        <span className="player-time" aria-live="off">
          {Math.floor(time)}s / {duration > 0 ? `${Math.floor(duration)}s` : "--"}
        </span>
        <label>
          倍速
          <select
            data-testid="player-rate"
            disabled={locked}
            value={rate}
            onChange={(event) => changeRate(Number(event.target.value))}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <option value={rate} key={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
        {choices.length > 1 && (
          <label>
            线路
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
            字幕
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
        <button type="button" aria-pressed={cinema} onClick={() => changeCinema(!cinema)}>
          剧场模式
        </button>
        <button
          type="button"
          data-testid="player-web-fullscreen"
          aria-pressed={webFullscreen}
          onClick={toggleWebFullscreen}
        >
          网页全屏
        </button>
        <button
          type="button"
          data-testid="player-native-fullscreen"
          aria-pressed={nativeFullscreen}
          onClick={() => void toggleNativeFullscreen()}
        >
          原生全屏
        </button>
      </div>
    </section>
  )
}
