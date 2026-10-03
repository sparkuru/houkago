import Artplayer from "artplayer"
import * as dashjs from "dashjs"
import Hls from "hls.js"
import type { Enmoku, Shinkou } from "houkago-kousoku"
import type { PlayerHandle } from "houkago-kyoushitsu-core/player"
import { canSeekTo } from "houkago-kyoushitsu-core/seekable"

type MediaType = Enmoku["type"]

export type PlayerDriverEvents = {
  ready: () => void
  time: (seconds: number) => void
  duration: (seconds: number) => void
  playback: (state: Shinkou) => void
  error: (message: string) => void
  subtitleUnavailable: () => void
}

const SEEK_EPSILON = 0.3

function mediaKind(url: string, type: MediaType): "direct" | "hls" | "dash" {
  if (type === "hls" || type === "live" || /\.m3u8(?:[?#]|$)/i.test(url)) return "hls"
  if (type === "dash" || /\.mpd(?:[?#]|$)/i.test(url)) return "dash"
  return "direct"
}

function subtitleMatches(
  track: { name?: string; label?: string; lang?: string; language?: string },
  label: string,
): boolean {
  const normalized = label.trim().toLocaleLowerCase()
  return [track.name, track.label, track.lang, track.language].some(
    (candidate) => candidate?.trim().toLocaleLowerCase() === normalized,
  )
}

export class PlayerDriver implements PlayerHandle {
  private art: Artplayer | null = null
  private mediaCleanup: (() => void) | null = null
  private subtitleCleanup: (() => void) | null = null
  private hls: Hls | null = null
  private hlsManifestReady = false
  private nativeSubtitleReady = false
  private pendingSeek: number | null = null
  private ticker: number | null = null
  private generation = 0
  private sourceGeneration = 0
  private suppressPlayback = false
  private disposed = false
  private subtitleLabel: string | null = null
  private url: string
  private type: MediaType

  constructor(
    private readonly container: HTMLDivElement,
    url: string,
    type: MediaType,
    private readonly events: PlayerDriverEvents,
  ) {
    this.url = url
    this.type = type
    this.mount()
  }

  private get video(): HTMLVideoElement | null {
    return (this.art as unknown as { video?: HTMLVideoElement } | null)?.video ?? null
  }

  private clearMedia(): void {
    this.subtitleCleanup?.()
    this.subtitleCleanup = null
    this.mediaCleanup?.()
    this.mediaCleanup = null
    this.hls = null
    this.hlsManifestReady = false
    this.nativeSubtitleReady = false
  }

  private mount(): void {
    const generation = ++this.generation
    const kind = mediaKind(this.url, this.type)
    this.pendingSeek = null
    this.art = new Artplayer({
      container: this.container,
      url: this.url,
      ...(kind === "direct"
        ? {}
        : {
            type: kind === "hls" ? "m3u8" : "dash",
            customType: {
              m3u8: (video: HTMLVideoElement, url: string) => this.attachHls(video, url),
              dash: (video: HTMLVideoElement, url: string) => this.attachDash(video, url),
            },
          }),
      autoSize: false,
      fullscreen: false,
      fullscreenWeb: false,
      hotkey: false,
      setting: false,
    })
    const live = () => !this.disposed && generation === this.generation
    const playback = () => {
      if (!live()) return
      if (!this.suppressPlayback) this.events.playback(this.snapshot())
      this.reportTime()
      if (this.isPlaying()) this.startTicker()
      else this.stopTicker()
    }
    const ready = () => {
      if (!live()) return
      this.flushPendingSeek()
      this.reportDuration()
      this.suppressPlayback = false
      this.events.ready()
      this.reportTime()
    }
    this.art.on("play", playback)
    this.art.on("pause", playback)
    this.art.on("seek", playback)
    this.art.on("video:ratechange", playback)
    this.art.on("video:play", () => {
      if (live()) this.startTicker()
    })
    this.art.on("video:pause", () => {
      if (live()) this.stopTicker()
    })
    this.art.on("video:timeupdate", () => {
      if (live()) this.reportTime()
    })
    this.art.on("video:seeked", () => {
      if (live()) this.reportTime()
    })
    this.art.on("video:loadedmetadata", ready)
    this.art.on("video:canplay", () => {
      if (live()) this.flushPendingSeek()
    })
    this.art.on("ready", ready)
    this.art.on("error", () => {
      if (live()) this.events.error("媒体加载失败")
    })
  }

  private attachHls(video: HTMLVideoElement, url: string): void {
    this.clearMedia()
    if (Hls.isSupported()) {
      const hls = new Hls(
        this.subtitleLabel ? { subtitlePreference: { name: this.subtitleLabel } } : undefined,
      )
      this.hls = hls
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        if (this.hls !== hls) return
        this.hlsManifestReady = true
        this.applySubtitle()
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        const track =
          typeof data.context?.id === "number" ? hls.subtitleTracks[data.context.id] : undefined
        if (
          this.hls === hls &&
          this.subtitleLabel &&
          data.details.toLowerCase().includes("subtitle") &&
          data.context?.id === hls.subtitleTrack &&
          track &&
          subtitleMatches(track, this.subtitleLabel)
        ) {
          this.events.subtitleUnavailable()
        }
      })
      hls.loadSource(url)
      hls.attachMedia(video)
      this.mediaCleanup = () => hls.destroy()
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url
      this.watchNativeSubtitles(video)
    } else {
      this.events.error("此浏览器不支持 HLS")
    }
  }

  private attachDash(video: HTMLVideoElement, url: string): void {
    this.clearMedia()
    const player: dashjs.MediaPlayerClass = dashjs.MediaPlayer().create()
    player.initialize(video, url, false)
    this.mediaCleanup = () => player.reset()
    this.watchNativeSubtitles(video)
  }

  private watchNativeSubtitles(video: HTMLVideoElement): void {
    const ready = () => {
      this.nativeSubtitleReady = true
      this.applySubtitle()
    }
    video.addEventListener("loadedmetadata", ready)
    video.addEventListener("canplay", ready)
    video.textTracks.addEventListener("addtrack", ready)
    this.subtitleCleanup = () => {
      video.removeEventListener("loadedmetadata", ready)
      video.removeEventListener("canplay", ready)
      video.textTracks.removeEventListener("addtrack", ready)
    }
  }

  setSubtitle(label: string | null): void {
    this.subtitleLabel = label
    this.applySubtitle()
  }

  private applySubtitle(): void {
    const video = this.video
    const label = this.subtitleLabel
    if (!label) {
      if (this.hls) {
        this.hls.subtitleTrack = -1
        this.hls.subtitleDisplay = false
      }
      if (video) for (const track of Array.from(video.textTracks)) track.mode = "hidden"
      return
    }
    if (this.hls) {
      if (!this.hlsManifestReady) return
      const index = this.hls.subtitleTracks.findIndex((track) => subtitleMatches(track, label))
      if (index < 0) this.events.subtitleUnavailable()
      else {
        this.hls.subtitleTrack = index
        this.hls.subtitleDisplay = true
      }
      return
    }
    if (!video || !this.nativeSubtitleReady) return
    const tracks = Array.from(video.textTracks)
    for (const track of tracks) track.mode = "hidden"
    const chosen = tracks.find((track) => subtitleMatches(track, label))
    if (chosen) chosen.mode = "showing"
    else this.events.subtitleUnavailable()
  }

  switchSource(url: string, type: MediaType): void {
    if (this.disposed || (url === this.url && type === this.type)) return
    const previousKind = mediaKind(this.url, this.type)
    const nextKind = mediaKind(url, type)
    this.url = url
    this.type = type
    const sourceGeneration = ++this.sourceGeneration
    this.pendingSeek = null
    this.suppressPlayback = true
    if (!this.art || previousKind !== nextKind) {
      this.destroyArt()
      this.mount()
      return
    }
    this.clearMedia()
    void this.art
      .switchQuality(url)
      .catch(() => {
        if (!this.disposed && sourceGeneration === this.sourceGeneration)
          this.events.error("线路切换失败")
      })
      .finally(() => {
        if (sourceGeneration === this.sourceGeneration) this.suppressPlayback = false
      })
  }

  private seekTo(target: number): void {
    const video = this.video
    if (!this.art || !Number.isFinite(target) || target < 0) return
    if (video && canSeekTo(target, video.readyState, video.duration)) {
      this.art.seek = target
      this.pendingSeek = null
    } else {
      this.pendingSeek = target
    }
  }

  private flushPendingSeek(): void {
    if (this.pendingSeek !== null) this.seekTo(this.pendingSeek)
  }

  private safePlay(): void {
    if (!this.art) return
    Promise.resolve(this.art.play()).catch(() => {})
  }

  playForJoin(): void {
    this.safePlay()
  }

  togglePlayback(): void {
    if (this.isPlaying()) this.art?.pause()
    else this.safePlay()
  }

  seek(seconds: number): void {
    this.seekTo(seconds)
  }

  changeRate(rate: number): void {
    this.setRate(rate)
  }

  apply(state: Shinkou): void {
    if (!this.art) return
    if (Math.abs(this.snapshot().currentTime - state.currentTime) > SEEK_EPSILON)
      this.seekTo(state.currentTime)
    this.alignTransport(state)
  }

  alignTransport(state: Shinkou): void {
    if (!this.art) return
    this.art.playbackRate = state.playbackRate
    if (state.isPlaying && !this.art.playing) this.safePlay()
    else if (!state.isPlaying && this.art.playing) this.art.pause()
  }

  setRate(rate: number): void {
    if (this.art) this.art.playbackRate = rate
  }

  snapshot(): Shinkou {
    return {
      isPlaying: this.isPlaying(),
      currentTime: this.video?.currentTime ?? this.art?.currentTime ?? 0,
      playbackRate: this.art?.playbackRate ?? 1,
    }
  }

  private isPlaying(): boolean {
    const video = this.video
    return video ? !video.paused && !video.ended : (this.art?.playing ?? false)
  }

  private reportTime(): void {
    this.events.time(this.snapshot().currentTime)
  }

  private reportDuration(): void {
    const duration = this.video?.duration ?? 0
    this.events.duration(Number.isFinite(duration) ? duration : 0)
  }

  private startTicker(): void {
    if (this.ticker !== null) return
    const tick = () => {
      this.reportTime()
      this.ticker = this.isPlaying() ? requestAnimationFrame(tick) : null
    }
    this.ticker = requestAnimationFrame(tick)
  }

  private stopTicker(): void {
    if (this.ticker === null) return
    cancelAnimationFrame(this.ticker)
    this.ticker = null
  }

  private destroyArt(): void {
    this.generation += 1
    this.stopTicker()
    this.clearMedia()
    this.art?.destroy(false)
    this.art = null
    this.pendingSeek = null
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.sourceGeneration += 1
    this.destroyArt()
  }
}
