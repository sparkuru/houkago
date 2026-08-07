<script setup lang="ts">
import { t } from "@/i18n"
import { type EnmokuSubtitleChoice, SUBTITLE_OFF_VALUE } from "@/lib/enmoku-metadata"
import { canSeekTo } from "@/lib/seekable"
import Artplayer from "artplayer"
import * as dashjs from "dashjs"
import Hls from "hls.js"
import type { Enmoku, Shinkou } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref, watch } from "vue"

// The ArtPlayer instance is imperative third-party state — this single component
// owns its lifecycle (create onMounted, destroy onUnmounted), per
// component-guidelines. All art.seek/play/pause calls stay here; sync decisions
// live in composables/useShinkou.ts.
// showJoinGate: follower がまだ未参加のとき、ブラウザの autoplay 制約で音付き
// 再生にユーザー操作が要る。親が `!isBuchou && !joined` を渡し、true の間だけ
// 「クリックして参加」遮罩を表示する。
// controlLocked: a guest without 再生制御 permission. The parent passes
// `!canControl`; while true the root gets a `.control-locked` class. ArtPlayer の
// コントロール条 `.art-bottom`(z60, 進度条+再生/音量/全屏ボタン) と中央オーバーレイ
// `.art-mask`(z50, .art-state 大再生ボタン) を display:none で消し(display は
// pointer-events で覆せない — 前回 .art-video-player の pointer-events:none は控件
// 自身の可点性に勝てず再生ボタンが押せた)、video 本体 `.art-video` は
// pointer-events:none で点击を殺す。これで guest はあらゆる再生入力を失う。
// 程序化 art.play()/seek は JS 呼び出しで pointer-events/display に縛られないため
// follower 同期は通常通り。.control-lock 帯は純視覚提示 (pointer-events:none)。
// 弹幕 toggle は pointer-events:auto の子で依然押せ、join-gate は $player の兄弟で
// 影響を受けない。The server also rejects any SHINKOU (双保険・最終保険).
// cinemaMode: parent-owned room layout mode (video left + chat right). ArtPlayer's
// own fullscreenWeb remains pure-player fullscreen; this control only emits a
// local layout request to BushitsuView.
type PlayerSourceChoice = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    url: string
    type: Enmoku["type"]
    showJoinGate?: boolean
    controlLocked?: boolean
    cinemaMode?: boolean
    sourceChoices?: PlayerSourceChoice[]
    selectedSourceValue?: string
    subtitleChoices?: EnmokuSubtitleChoice[]
    selectedSubtitleValue?: string
    fileDanmakuEnabled?: boolean
    fileDanmakuName?: string
    danmakuSize?: number
    danmakuOpacity?: number
    danmakuSpeed?: number
    danmakuTimeOffset?: number
  }>(),
  {
    sourceChoices: () => [],
    selectedSourceValue: "primary",
    subtitleChoices: () => [],
    selectedSubtitleValue: SUBTITLE_OFF_VALUE,
    fileDanmakuEnabled: false,
    fileDanmakuName: "",
    danmakuSize: 1,
    danmakuOpacity: 1,
    danmakuSpeed: 1,
    danmakuTimeOffset: 0,
  },
)

// Local playback changes (host drives → useShinkou broadcasts); `ready` lets the
// parent run catch-up once the instance exists. `join`：部員 pressed the gate —
// the parent flips joined + catchUp in the same gesture stack. `control`：
// ArtPlayer コントロール条の显隐を親へ直送（emit）— 暴露 ref→親 computed の脆い
// 連鎖を避け、普通／网页全屏／原生全屏の三態で確実に響応させる（prd Bug1）。
// `time` feeds local file-danmaku rendering only; it never becomes playback
// authority and never emits SHINKOU. `cinema` sets parent-owned layout and is
// not playback/session authority. Source and file-danmaku controls also emit to
// the parent because those are local room UI state, not ArtPlayer playback
// authority.
const emit = defineEmits<{
  shinkou: [Shinkou]
  ready: []
  join: []
  control: [boolean]
  time: [number]
  cinema: [enabled: boolean]
  source: [value: string]
  subtitle: [value: string]
  toggleFileDanmaku: []
  chooseFileDanmaku: []
  danmakuSize: [value: number]
  danmakuOpacity: [value: number]
  danmakuSpeed: [value: number]
  danmakuTimeOffset: [value: number]
}>()

// Sub-threshold position diffs are ignored on apply to avoid a seek→echo→seek
// loop (design §5 ≤0.3s ignore tier).
const SEEK_EPSILON = 0.3
const DANMAKU_SIZE_OPTIONS = [0.5, 1, 1.5, 2] as const
const DANMAKU_OPACITY_PRESETS = [0.4, 0.7, 1] as const
const DANMAKU_SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const
const DANMAKU_TIME_OFFSET_MIN = -5
const DANMAKU_TIME_OFFSET_MAX = 5

const container = ref<HTMLDivElement | null>(null)
// ArtPlayer の主播放器容器（$player）：原生全屏の対象元素。父级用它做 Teleport
// target，让弹幕 overlay 进入全屏子树。ArtPlayer 类型不全 → 局部窄接口收窄，禁 any。
const playerEl = ref<HTMLElement | null>(null)
const danmakuSettingsOpen = ref(false)
let art: Artplayer | null = null
let stopFullscreenClickPatch: (() => void) | null = null
let cleanupMediaEngine: (() => void) | null = null
let timeRaf: number | null = null
let hls: Hls | null = null
let hlsManifestReady = false
let nativeSubtitleReady = false
let cleanupNativeSubtitleEvents: (() => void) | null = null
const subtitleFailureNotice = ref(false)

// 中途加入の追平 seek が早すぎて落ちる問題への対策（prd Bug2）: hls.js がまだ
// メディアを読み込み切っておらず seek 不可（readyState 低 / video.seekable 空）の
// うちに art.seek = t を発行しても 0 に戻り、追平しない。要求された seek 先を
// pendingSeek に控え、メディアが seek 可能になった loadedmetadata/canplay で flush する。
// 通常（既に seek 可能）は即時 seek し pendingSeek は使わない。
let pendingSeek: number | null = null

type ArtTemplate = { $player: HTMLElement }
type ArtFullscreen = { fullscreenWeb: boolean; fullscreen: boolean }

// art.video（HTMLVideoElement）への型安全な参照。ArtPlayer 型不全のため局部で収窄。
function videoEl(): HTMLVideoElement | null {
  return (art as unknown as { video?: HTMLVideoElement }).video ?? null
}

// 追平 seek を発行：今 seek 可能ならそのまま、まだならメディア準備完了後に
// flush するため pendingSeek に控える。seek 可否判定は純関数 canSeekTo に委譲。
function seekTo(target: number): void {
  if (!art) return
  const v = videoEl()
  if (v && canSeekTo(target, v.readyState, v.duration)) {
    art.seek = target
    pendingSeek = null
    return
  }
  pendingSeek = target
}

function playM3u8(video: HTMLVideoElement, url: string, _artInstance: Artplayer) {
  cleanupMediaEngine?.()
  cleanupMediaEngine = null
  cleanupNativeSubtitleEvents?.()
  cleanupNativeSubtitleEvents = null
  hls = null
  hlsManifestReady = false
  nativeSubtitleReady = false
  if (Hls.isSupported()) {
    const hlsInstance = new Hls()
    hls = hlsInstance
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      if (hls !== hlsInstance) return
      hlsManifestReady = true
      applySubtitleSelection()
    })
    hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
      if (hls !== hlsInstance || !data.details.toLowerCase().includes("subtitle")) return
      handleSubtitleFailure()
    })
    hlsInstance.loadSource(url)
    hlsInstance.attachMedia(video)
    cleanupMediaEngine = () => {
      hlsInstance.destroy()
      if (hls === hlsInstance) {
        hls = null
        hlsManifestReady = false
      }
    }
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url
    setupNativeSubtitleEvents(video)
  }
}

function playDash(video: HTMLVideoElement, url: string, _artInstance: Artplayer) {
  cleanupMediaEngine?.()
  cleanupNativeSubtitleEvents?.()
  cleanupNativeSubtitleEvents = null
  hls = null
  hlsManifestReady = false
  nativeSubtitleReady = false
  const player: dashjs.MediaPlayerClass = dashjs.MediaPlayer().create()
  player.initialize(video, url, false)
  cleanupMediaEngine = () => player.reset()
}

// 唯一の art.play() 経路：autoplay ポリシーで未参加 follower の play() は拒否
// (NotAllowedError) されるのが想定動作。rejection を静かに握りつぶし、Unhandled
// にも黒画面にもしない。muted リトライはしない（音質/同期劣化のため revert 済み）。
function safePlay(): void {
  if (!art) return
  // art.play() の戻りは Promise（rejection あり）— catch して握りつぶす。
  Promise.resolve(art.play()).catch(() => {})
}

function snapshot(): Shinkou {
  return {
    isPlaying: art ? art.playing : false,
    currentTime: mediaCurrentTime(),
    playbackRate: art?.playbackRate ?? 1,
  }
}

// 進行を適用：imperatively drive the player to a remote authority state. The only
// place that mutates the ArtPlayer instance from outside its own events.
function apply(s: Shinkou): void {
  if (!art) return
  if (Math.abs(mediaCurrentTime() - s.currentTime) > SEEK_EPSILON) seekTo(s.currentTime)
  art.playbackRate = s.playbackRate
  if (s.isPlaying && !art.playing) safePlay()
  else if (!s.isPlaying && art.playing) art.pause()
}

// Align play/pause/rate to authority without seeking — used by the GENJOU
// heartbeat so the time component can be left to zureHosei (no seek every tick).
function alignTransport(s: Shinkou): void {
  if (!art) return
  art.playbackRate = s.playbackRate
  if (s.isPlaying && !art.playing) safePlay()
  else if (!s.isPlaying && art.playing) art.pause()
}

// Temporarily override the playback rate for a soft drift nudge (design §5 中档).
// The authority rate is restored by useShinkou on the next ignore-tier tick.
function setRate(rate: number): void {
  if (art) art.playbackRate = rate
}

// 参加ボタン押下：このクリックは同期イベント処理器内なのでユーザー操作が有効。
// ここで音付き play() を即発火（手势保留）し、親へ join を通知 → 親が catchUp で
// 房主の現在位置へ seek + 追従。apply 側は art.playing 済みなら play() を再発火
// しないので二重再生にはならない。手势確保のため emit より先に play する。
function onJoin(): void {
  safePlay()
  emit("join")
}

function updateDanmakuOpacity(value: string): void {
  emit("danmakuOpacity", Number(value))
}

function updateDanmakuSpeed(value: number): void {
  emit("danmakuSpeed", value)
}

function clampDanmakuTimeOffset(value: number): number {
  if (!Number.isFinite(value)) return props.danmakuTimeOffset
  return Math.min(DANMAKU_TIME_OFFSET_MAX, Math.max(DANMAKU_TIME_OFFSET_MIN, value))
}

function adjustDanmakuTimeOffset(delta: number): void {
  emit(
    "danmakuTimeOffset",
    Number(clampDanmakuTimeOffset(props.danmakuTimeOffset + delta).toFixed(1)),
  )
}

function commitDanmakuTimeOffset(value: string): void {
  const normalized = value.trim().replace(/s$/i, "")
  const parsed = Number(normalized)
  emit("danmakuTimeOffset", Number(clampDanmakuTimeOffset(parsed).toFixed(1)))
}

function mediaCurrentTime(): number {
  return videoEl()?.currentTime ?? art?.currentTime ?? 0
}

function isMediaPlaying(): boolean {
  const video = videoEl()
  return video ? !video.paused && !video.ended : (art?.playing ?? false)
}

function emitCurrentTime(): void {
  emit("time", mediaCurrentTime())
}

function stopTimeTicker(): void {
  if (timeRaf === null) return
  cancelAnimationFrame(timeRaf)
  timeRaf = null
}

function startTimeTicker(): void {
  if (timeRaf !== null) return
  const tick = () => {
    emitCurrentTime()
    if (isMediaPlaying()) {
      timeRaf = requestAnimationFrame(tick)
    } else {
      timeRaf = null
    }
  }
  timeRaf = requestAnimationFrame(tick)
}

function onPlaybackChange(): void {
  emit("shinkou", snapshot())
  emitCurrentTime()
  if (isMediaPlaying()) {
    startTimeTicker()
  } else {
    stopTimeTicker()
  }
}

function onNativePlaybackStart(): void {
  emitCurrentTime()
  startTimeTicker()
}

function onNativePlaybackStop(): void {
  emitCurrentTime()
  stopTimeTicker()
}

function selectedSourceLabel(): string {
  return (
    props.sourceChoices.find((choice) => choice.value === props.selectedSourceValue)?.label ??
    props.sourceChoices[0]?.label ??
    t("sourceSelectLabel")
  )
}

function selectedSubtitleChoice(): EnmokuSubtitleChoice | undefined {
  return props.subtitleChoices.find((choice) => choice.value === props.selectedSubtitleValue)
}

function selectedSubtitleLabel(): string {
  return selectedSubtitleChoice()?.label ?? t("subtitleOff")
}

function subtitleControl() {
  if (props.subtitleChoices.length <= 1) return null
  return {
    name: "houkagoSubtitle",
    position: "right",
    index: 37,
    html: subtitleControlHtml(),
    tooltip: `${t("subtitleSelectLabel")}: ${selectedSubtitleLabel()}`,
    selector: props.subtitleChoices.map((choice) => ({
      html: escapeHtml(choice.label),
      value: choice.value,
      default: choice.value === props.selectedSubtitleValue,
    })),
    mounted: subtitleControlMounted,
    onSelect: (item: { value?: string | number; html?: string | HTMLElement }) => {
      if (typeof item.value === "string") {
        subtitleFailureNotice.value = false
        emit("subtitle", item.value)
        return typeof item.html === "string" ? item.html : subtitleControlHtml()
      }
      return subtitleControlHtml()
    },
  }
}

function subtitleControlHtml(): string {
  return `<span class="houkago-subtitle-control" style="display:block;max-width:82px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:currentColor;font-size:12px;font-weight:600;line-height:24px;" aria-hidden="true">${escapeHtml(t("subtitleSelectLabel"))}: ${escapeHtml(selectedSubtitleLabel())}</span>`
}

function subtitleControlMounted(control: HTMLElement): void {
  control.tabIndex = 0
  control.setAttribute("role", "button")
  control.setAttribute("aria-haspopup", "menu")
  control.setAttribute("aria-label", `${t("subtitleSelectLabel")}: ${selectedSubtitleLabel()}`)
  const options = Array.from(control.querySelectorAll<HTMLElement>(".art-selector-item"))
  const list = control.querySelector<HTMLElement>(".art-selector-list")
  list?.setAttribute("role", "menu")
  const close = () => {
    control.classList.remove("subtitle-selector-open")
    if (!list) return
    list.style.opacity = ""
    list.style.pointerEvents = ""
    list.style.transform = ""
  }
  const open = () => {
    control.classList.add("subtitle-selector-open")
    if (!list) return
    list.style.opacity = "1"
    list.style.pointerEvents = "auto"
    list.style.transform = "translateY(0)"
  }
  for (const option of options) {
    option.tabIndex = -1
    option.setAttribute("role", "menuitem")
    option.addEventListener("keydown", (event) => {
      const index = options.indexOf(option)
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        event.stopPropagation()
        options[
          (index + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length
        ]?.focus()
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        close()
        control.focus()
        return
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        event.stopPropagation()
        close()
        option.click()
        control.focus()
      }
    })
  }
  control.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    open()
    options.find((option) => option.classList.contains("art-current"))?.focus()
  })
}

function sourceControl() {
  if (props.sourceChoices.length > 1) {
    return {
      name: "houkagoSource",
      position: "right",
      index: 35,
      html: sourceControlHtml(),
      tooltip: selectedSourceLabel(),
      selector: props.sourceChoices.map((choice) => ({
        html: escapeHtml(choice.label),
        value: choice.value,
        default: choice.value === props.selectedSourceValue,
      })),
      onSelect: (item: { value?: string | number; html?: string | HTMLElement }) => {
        if (typeof item.value === "string") {
          emit("source", item.value)
          return typeof item.html === "string" ? item.html : sourceControlHtml()
        }
        return sourceControlHtml()
      },
    }
  }
  return null
}

function sourceControlHtml(): string {
  return `<span class="houkago-source-control" aria-hidden="true">${escapeHtml(selectedSourceLabel())}</span>`
}

function applySubtitleSelection(): void {
  const choice = selectedSubtitleChoice()
  if (!choice || choice.value === SUBTITLE_OFF_VALUE) {
    hideSubtitleTracks()
    return
  }

  if (hls) {
    if (!hlsManifestReady) return
    const trackIndex = hls.subtitleTracks.findIndex((track) =>
      subtitleTrackMatches(track, choice.label),
    )
    if (trackIndex < 0) {
      handleSubtitleFailure()
      return
    }
    hls.subtitleTrack = trackIndex
    hls.subtitleDisplay = true
    subtitleFailureNotice.value = false
    return
  }

  const video = videoEl()
  if (video && nativeSubtitleReady) applyNativeSubtitleSelection(video, choice.label)
}

function hideSubtitleTracks(): void {
  if (hls) {
    hls.subtitleTrack = -1
    hls.subtitleDisplay = false
  }
  const video = videoEl()
  if (!video) return
  for (const track of Array.from(video.textTracks)) track.mode = "hidden"
}

function applyNativeSubtitleSelection(video: HTMLVideoElement, label: string): void {
  const tracks = Array.from(video.textTracks)
  for (const track of tracks) track.mode = "hidden"
  const track = tracks.find((item) => subtitleTrackMatches(item, label))
  if (!track) {
    handleSubtitleFailure()
    return
  }
  track.mode = "showing"
  subtitleFailureNotice.value = false
}

function subtitleTrackMatches(
  track: { name?: string; label?: string; lang?: string; language?: string },
  label: string,
): boolean {
  const normalizedLabel = label.trim().toLocaleLowerCase()
  return [track.name, track.label, track.lang, track.language].some(
    (value) => value?.trim().toLocaleLowerCase() === normalizedLabel,
  )
}

function setupNativeSubtitleEvents(video: HTMLVideoElement): void {
  const apply = () => {
    nativeSubtitleReady = true
    applySubtitleSelection()
  }
  video.addEventListener("loadedmetadata", apply)
  video.addEventListener("canplay", apply)
  video.textTracks.addEventListener("addtrack", apply)
  cleanupNativeSubtitleEvents = () => {
    video.removeEventListener("loadedmetadata", apply)
    video.removeEventListener("canplay", apply)
    video.textTracks.removeEventListener("addtrack", apply)
  }
}

function handleSubtitleFailure(): void {
  if (props.selectedSubtitleValue === SUBTITLE_OFF_VALUE) return
  hideSubtitleTracks()
  subtitleFailureNotice.value = true
  emit("subtitle", SUBTITLE_OFF_VALUE)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function controlColor(active: boolean): string {
  return active ? "var(--art-theme, #f00)" : "currentColor"
}

function exitPlayerFullscreen(): void {
  if (!art) return
  const player = art as unknown as Partial<ArtFullscreen>
  if (player.fullscreenWeb) player.fullscreenWeb = false
  if (player.fullscreen) player.fullscreen = false
  if (typeof document !== "undefined" && document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {})
  }
}

function enterNativeFullscreenFromWeb(): boolean {
  if (!art) return false
  const player = art as unknown as Partial<ArtFullscreen>
  if (!player.fullscreenWeb) return false
  player.fullscreenWeb = false
  emit("cinema", false)
  player.fullscreen = true
  return true
}

function isNativeFullscreenControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return (
    target.closest(".art-control-fullscreen, .art-fullscreen") !== null &&
    target.closest(".art-control-fullscreenWeb, .art-fullscreenWeb") === null
  )
}

function patchFullscreenClick(player: HTMLElement): () => void {
  const onClick = (event: MouseEvent) => {
    if (!isNativeFullscreenControl(event.target)) return
    if (!enterNativeFullscreenFromWeb()) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  player.addEventListener("click", onClick, true)
  return () => player.removeEventListener("click", onClick, true)
}

function danmakuToggleControl() {
  const color = controlColor(props.fileDanmakuEnabled)
  return {
    name: "houkagoDanmakuToggle",
    position: "right",
    index: 40,
    tooltip: props.fileDanmakuEnabled ? t("danmakuOff") : t("danmakuOn"),
    html: `<span class="houkago-danmaku-toggle" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;color:${color};font-size:14px;font-weight:700;line-height:1;" aria-hidden="true">弹</span>`,
    click: () => emit("toggleFileDanmaku"),
  }
}

function danmakuSettingsControl() {
  return {
    name: "houkagoDanmakuSettings",
    position: "right",
    index: 50,
    tooltip: t("danmakuSettings"),
    html: `
      <span class="houkago-danmaku-settings-icon" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;color:currentColor;" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M5 7h14"></path>
          <path d="M5 12h14"></path>
          <path d="M5 17h14"></path>
        </svg>
      </span>
    `,
    click: () => {
      danmakuSettingsOpen.value = !danmakuSettingsOpen.value
    },
  }
}

function cinemaControl() {
  const color = controlColor(props.cinemaMode)
  return {
    name: "houkagoCinema",
    position: "right",
    index: 55,
    tooltip: t("cinemaMode"),
    html: `
      <span class="houkago-cinema-icon" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;color:${color};" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
          <rect x="3" y="5" width="12" height="14" rx="1"></rect>
          <rect x="17" y="5" width="4" height="14" rx="1"></rect>
        </svg>
      </span>
    `,
    click: () => {
      exitPlayerFullscreen()
      emit("cinema", !props.cinemaMode)
    },
  }
}

function artControls() {
  return [
    sourceControl(),
    subtitleControl(),
    danmakuToggleControl(),
    danmakuSettingsControl(),
    cinemaControl(),
  ].filter((control) => control !== null)
}

function refreshSourceControl(): void {
  const control = sourceControl()
  if (control) art?.controls.update(control)
}

function refreshSubtitleControl(): void {
  const control = subtitleControl()
  if (control) art?.controls.update(control)
}

// 放権（解锁: controlLocked true→false）時にコントロール条を能動的に再表示する。
// 加锁中は CSS `.control-locked` が `.art-bottom`/`.art-mask` を display:none で消す
// が、解锁で display:none が外れても ArtPlayer 自身の显隐状態機は「隠れ」のまま
// （.art-bottom 既定 opacity:0、art-control-show / art-hover が付いて初めて opacity:1）
// なので hover/再構築まで条が戻らなかった（prd 根因）。`art.controls.show = true` は
// $player に `art-control-show` クラスを付け（条が opacity:1 で復帰）、同時に
// ArtPlayer 内部で 'control' イベントを emit する — 既存の art.on("control", …) が
// それを親へ転送し controlsShown(気泡跟随) も自然に整合する（追加 emit 不要）。
// 加锁(false→true)は CSS が即時隠すので JS 操作は不要。art が null（mount 前）なら guard。
watch(
  () => props.controlLocked,
  (locked, prev) => {
    if (prev && !locked && art) art.controls.show = true
  },
)

defineExpose({ apply, alignTransport, setRate, snapshot, playerEl })

onMounted(() => {
  if (!container.value) return
  const isHls = props.type === "hls" || props.type === "live" || props.url.endsWith(".m3u8")
  const isDash = props.type === "dash" || props.url.endsWith(".mpd")
  const mediaType = isHls ? "m3u8" : isDash ? "dash" : undefined
  art = new Artplayer({
    container: container.value,
    url: props.url,
    ...(mediaType
      ? {
          type: mediaType,
          customType: {
            m3u8: (video: HTMLVideoElement, url: string, artInstance: Artplayer) =>
              playM3u8(video, url, artInstance),
            dash: (video: HTMLVideoElement, url: string, artInstance: Artplayer) =>
              playDash(video, url, artInstance),
          },
        }
      : {}),
    autoSize: false,
    fullscreenWeb: true,
    fullscreen: true,
    setting: false,
    controls: artControls(),
  })

  playerEl.value = (art.template as ArtTemplate).$player
  stopFullscreenClickPatch = patchFullscreenClick(playerEl.value)

  // Local playback events → Shinkou snapshots. useShinkou gates these by 部長 +
  // 追従中 before broadcasting, so emitting unconditionally here is safe.
  art.on("play", onPlaybackChange)
  art.on("pause", onPlaybackChange)
  art.on("seek", onPlaybackChange)
  art.on("video:play", onNativePlaybackStart)
  art.on("video:playing", onNativePlaybackStart)
  art.on("video:pause", onNativePlaybackStop)
  art.on("video:ratechange", onPlaybackChange)
  art.on("ready", () => {
    emit("ready")
    emitCurrentTime()
    if (isMediaPlaying()) startTimeTicker()
  })
  art.on("video:timeupdate", emitCurrentTime)
  art.on("video:seeked", emitCurrentTime)

  // コントロール条の显隐を親へ直送（prd Bug1）。ArtPlayer 'control' は state=条が
  // 可視か を渡す（typed event, 禁 any）。emit で送ることで暴露 ref→親 computed の
  // 脆い連鎖を排し、原生全屏含む三態で確実に響応する。art.destroy で listener 自清。
  art.on("control", (state) => emit("control", state))
  // ArtPlayer の网页全屏/原生全屏は播放器子树だけを表示するため、親级の聊天室
  // layout とは排他的。进入全屏时は親の cinemaMode を false にして、图标状态と
  // 実際に見えるレイアウトを一致させる。退出全屏では元の cinemaMode を復元しない
  // （ユーザーが全屏を明示選択した時点で播放器全屏を優先する）。
  art.on("fullscreenWeb", (state) => {
    if (state) emit("cinema", false)
  })
  art.on("fullscreen", (state) => {
    if (state) emit("cinema", false)
  })

  // 追平 seek の取りこぼし回収（prd Bug2）: catchUp/heartbeat が seek 可能になる前に
  // 控えた pendingSeek を、メディアが seek 可能になった時点で一度だけ flush する。
  // これにより中途加入は遮罩クリック後に房主の現在位置へ自動追平し、A の手動 toggle
  // に依存しない。flush 後 pendingSeek は seekTo 内で null に戻る。
  const flushPending = () => {
    if (pendingSeek !== null) seekTo(pendingSeek)
  }
  art.on("video:loadedmetadata", flushPending)
  art.on("video:canplay", flushPending)
})

watch(
  () => props.fileDanmakuEnabled,
  () => {
    art?.controls.update(danmakuToggleControl())
  },
)

watch(
  () => [props.selectedSourceValue, props.sourceChoices.length, selectedSourceLabel()],
  () => {
    refreshSourceControl()
  },
)

watch(
  () => [props.selectedSubtitleValue, props.subtitleChoices.length, selectedSubtitleLabel()],
  () => {
    refreshSubtitleControl()
    applySubtitleSelection()
  },
)

watch(
  () => props.url,
  (url, previous) => {
    if (!art || url === previous) return
    void art.switchQuality(url).catch(() => {})
  },
)

watch(
  () => props.cinemaMode,
  () => {
    art?.controls.update(cinemaControl())
  },
)

onBeforeUnmount(() => {
  stopTimeTicker()
  stopFullscreenClickPatch?.()
  stopFullscreenClickPatch = null
  cleanupNativeSubtitleEvents?.()
  cleanupNativeSubtitleEvents = null
  cleanupMediaEngine?.()
  cleanupMediaEngine = null
  hls = null
  hlsManifestReady = false
  nativeSubtitleReady = false
  art?.destroy()
  art = null
  playerEl.value = null
})
</script>

<template>
  <div
    class="enmoku-player"
    :class="{
      'control-locked': controlLocked,
      'cinema-mode': cinemaMode,
      'file-danmaku-enabled': fileDanmakuEnabled,
    }"
  >
    <!-- ArtPlayer 専属マウント点：第三方ライブラリが内部 DOM を全権管理する。
         Vue はこの div 内に一切ノードを置かない — そうしないと ArtPlayer の DOM
         再配置と Vue の v-if patch が同一容器を奪い合い、comment アンカーの
         insertBefore で parent=null クラッシュを起こす（prd 根因）。浮層は下の
         兄弟として .enmoku-player 直下に置き、Vue が完全掌握する。 -->
    <div ref="container" class="art-host"></div>
    <Teleport v-if="danmakuSettingsOpen && playerEl" :to="playerEl">
      <section class="danmaku-settings-panel">
        <div class="segmented-setting">
          <span class="setting-label">{{ t("danmakuSize") }}</span>
          <div class="setting-options">
            <button
              v-for="value in DANMAKU_SIZE_OPTIONS"
              :key="value"
              type="button"
              :class="{ active: Math.abs(danmakuSize - value) < 0.001 }"
              @click="emit('danmakuSize', value)"
            >
              {{ value }}x
            </button>
          </div>
        </div>
        <label class="opacity-setting">
          <span class="setting-label">{{ t("danmakuOpacity") }}</span>
          <div class="range-stack">
            <div class="opacity-track" aria-hidden="true">
              <span
                class="opacity-fill"
                :style="{ width: `${((danmakuOpacity - 0.4) / 0.6) * 100}%` }"
              ></span>
            </div>
            <input
              class="opacity-range"
              type="range"
              min="0.4"
              max="1"
              step="0.05"
              :value="danmakuOpacity"
              @input="updateDanmakuOpacity(($event.target as HTMLInputElement).value)"
            />
            <div class="preset-points">
              <button
                v-for="value in DANMAKU_OPACITY_PRESETS"
                :key="value"
                type="button"
                :aria-label="`${t('danmakuOpacity')} ${Math.round(value * 100)}%`"
                :style="{ left: `${((value - 0.4) / 0.6) * 100}%` }"
                @click="emit('danmakuOpacity', value)"
              ></button>
            </div>
            <span
              class="opacity-thumb"
              :style="{ left: `${((danmakuOpacity - 0.4) / 0.6) * 100}%` }"
            ></span>
          </div>
          <output>{{ Math.round(danmakuOpacity * 100) }}%</output>
        </label>
        <div class="segmented-setting">
          <span class="setting-label">{{ t("danmakuSpeed") }}</span>
          <div class="setting-options">
            <button
              v-for="value in DANMAKU_SPEED_OPTIONS"
              :key="value"
              type="button"
              :aria-label="value === 1 ? t('danmakuResetSpeed') : undefined"
              :class="{ active: Math.abs(danmakuSpeed - value) < 0.001 }"
              :title="value === 1 ? t('danmakuResetSpeed') : undefined"
              @click="updateDanmakuSpeed(value)"
            >
              {{ value }}x
            </button>
          </div>
        </div>
        <div class="stepper-setting">
          <span class="setting-label">{{ t("danmakuTimeOffset") }}</span>
          <div class="offset-stepper">
            <button type="button" @click="adjustDanmakuTimeOffset(-1)">
              -1s
            </button>
            <button type="button" @click="adjustDanmakuTimeOffset(-0.1)">
              -0.1s
            </button>
            <input
              type="text"
              inputmode="decimal"
              :aria-label="t('danmakuTimeOffset')"
              :value="`${danmakuTimeOffset.toFixed(1)}s`"
              @change="commitDanmakuTimeOffset(($event.target as HTMLInputElement).value)"
              @keydown.enter="commitDanmakuTimeOffset(($event.target as HTMLInputElement).value)"
            />
            <button type="button" @click="adjustDanmakuTimeOffset(0.1)">
              +0.1s
            </button>
            <button type="button" @click="adjustDanmakuTimeOffset(1)">
              +1s
            </button>
          </div>
        </div>
        <div class="danmaku-source">
          <span class="setting-label">{{ t("danmakuSource") }}</span>
          <button type="button" @click="emit('chooseFileDanmaku')">
            {{ t("danmakuSourceFile") }}
          </button>
          <button type="button" disabled>{{ t("danmakuSourceRemote") }}</button>
          <small>{{ fileDanmakuName || t("danmakuNone") }}</small>
        </div>
      </section>
    </Teleport>
    <Teleport v-if="subtitleFailureNotice && playerEl" :to="playerEl">
      <p class="subtitle-failure-notice" role="status">
        {{ t("subtitleUnavailable") }}
      </p>
    </Teleport>
    <!-- 再生制御提示：guest に 再生制御 権限がない間だけ表示。遮断は CSS で
         .art-bottom/.art-mask を display:none + .art-video を pointer-events:none に
         して行い、この帯は純視覚 (pointer-events:none)。状態は文字併記で色だけに
         頼らない (accessibility)。art-host の兄弟なので ArtPlayer の DOM と交錯しない。 -->
    <div
      v-if="controlLocked"
      class="control-lock"
      role="status"
      :aria-label="t('controlLockedAria')"
    >
      <span>{{ t("controlLocked") }}</span>
    </div>
    <button
      v-if="showJoinGate"
      type="button"
      class="join-gate"
      :aria-label="t('joinGateAria')"
      @click="onJoin"
    >
      {{ t("joinGate") }}
    </button>
  </div>
</template>

<style scoped>
/* 宽高比由父级 .player-wrap 决定（普通=16:9，网页全屏=填满左列）；
   播放器只负责填满父容器，ArtPlayer 内部 object-fit contain 做 letterbox */
.enmoku-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}
/* ArtPlayer 専属マウント点：.enmoku-player を満铺する。ArtPlayer の DOM はこの
   中に生え、浮層(control-lock/join-gate)は兄弟として外層直下に置く。下の :deep
   後代選択器(.art-bottom/.art-mask/.art-video)は art-host を跨いでも依然命中する。 */
.art-host {
  width: 100%;
  height: 100%;
}
/* ArtPlayer 既定の .art-video は object-fit 未指定で、容器を満铺ストレッチする
   （dist CSS: width/height 100% のみ）。普通模式は wrap が 16:9 で容器=映像比のため
   目立たないが、网页全屏／原生全屏は容器比が映像比とズレ、映像が歪む／满铺して
   contain しない（prd Bug2）。contain を明示し、全状態で letterbox 居中させる。
   wrap の比が映像比と一致する普通模式では no-op。 */
.enmoku-player :deep(.art-video) {
  object-fit: contain;
}
.enmoku-player :deep(.art-control-houkagoSource),
.enmoku-player :deep(.art-control-houkagoSubtitle),
.enmoku-player :deep(.art-control-houkagoDanmakuToggle),
.enmoku-player :deep(.art-control-houkagoDanmakuSettings),
.enmoku-player :deep(.art-control-houkagoCinema) {
  color: #fff;
}
.enmoku-player :deep(.houkago-source-control) {
  display: block;
  max-width: 74px;
  padding: 0 4px;
  overflow: hidden;
  color: currentColor;
  font-size: 12px;
  font-weight: 600;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.enmoku-player :deep(.art-control-houkagoSubtitle) {
  min-width: 44px;
  min-height: 44px;
}
.enmoku-player :deep(.houkago-subtitle-control) {
  display: block;
  max-width: 82px;
  padding: 0 4px;
  overflow: hidden;
  color: currentColor;
  font-size: 12px;
  font-weight: 600;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.enmoku-player :deep(.art-control-houkagoSubtitle:focus-visible) {
  outline: 2px solid var(--art-theme, #f00);
  outline-offset: -2px;
}
.enmoku-player :deep(.art-control-houkagoSubtitle .art-selector-item) {
  display: flex;
  align-items: center;
  min-height: 44px;
}
.enmoku-player :deep(.art-control-houkagoSubtitle.subtitle-selector-open .art-selector-list) {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
.subtitle-failure-notice {
  position: absolute;
  right: 12px;
  bottom: 54px;
  z-index: 81;
  max-width: min(320px, calc(100% - 24px));
  margin: 0;
  padding: 7px 10px;
  color: #fff;
  font-size: 12px;
  line-height: 1.4;
  background: rgba(20, 20, 20, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 6px;
}
.enmoku-player.file-danmaku-enabled :deep(.art-control-houkagoDanmakuToggle),
.enmoku-player.cinema-mode :deep(.art-control-houkagoCinema) {
  color: var(--art-theme);
}
.enmoku-player :deep(.houkago-danmaku-toggle) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 14px;
  font-weight: 700;
}
.enmoku-player :deep(.houkago-danmaku-settings-icon) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  width: 24px;
  height: 24px;
  padding: 5px 3px;
}
.enmoku-player :deep(.houkago-danmaku-settings-icon span) {
  display: block;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
}
.enmoku-player :deep(.houkago-cinema-icon) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 7px;
  gap: 3px;
  align-items: stretch;
  width: 24px;
  height: 24px;
  padding: 5px 4px;
}
.enmoku-player :deep(.houkago-cinema-main),
.enmoku-player :deep(.houkago-cinema-side) {
  display: block;
  border: 2px solid currentColor;
  border-radius: 2px;
}
.enmoku-player :deep(.houkago-cinema-side) {
  opacity: 0.72;
}
.danmaku-settings-panel {
  --settings-edge: clamp(12px, 8vw, 86px);
  --range-thumb-inset: 8px;
  position: absolute;
  right: var(--settings-edge);
  bottom: 54px;
  z-index: 80;
  width: min(420px, calc(100% - var(--settings-edge) * 2));
  padding: 9px;
  color: #eee;
  background: rgba(20, 20, 20, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
}
.danmaku-settings-panel label,
.segmented-setting,
.stepper-setting,
.danmaku-source {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 42px;
  column-gap: 6px;
  row-gap: 5px;
  align-items: center;
  min-height: 24px;
  font-size: 12px;
}
.setting-label {
  display: block;
  width: 100%;
  color: #f2f2f2;
  text-align: left;
  letter-spacing: 0;
  white-space: nowrap;
}
.danmaku-settings-panel label + label,
.segmented-setting + .segmented-setting,
.danmaku-settings-panel label + .segmented-setting,
.segmented-setting + .stepper-setting,
.stepper-setting + .danmaku-source,
.danmaku-source {
  margin-top: 6px;
}
.danmaku-settings-panel input[type="range"]:not(.opacity-range) {
  width: 100%;
}
.danmaku-settings-panel output,
.danmaku-source small {
  color: #bbb;
  text-align: right;
}
.range-stack {
  position: relative;
  display: grid;
  align-items: center;
  min-height: 22px;
}
.opacity-track,
.opacity-range,
.preset-points {
  grid-area: 1 / 1;
}
.opacity-track {
  position: relative;
  height: 4px;
  overflow: hidden;
  background: #d7d9df;
  border-radius: 999px;
}
.opacity-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: #0078ff;
  border-radius: inherit;
}
.opacity-range {
  position: relative;
  z-index: 4;
  width: 100%;
  height: 22px;
  margin: 0;
  cursor: pointer;
  opacity: 0;
}
.preset-points {
  position: absolute;
  z-index: 5;
  inset: 50% 0 auto;
  pointer-events: none;
}
.preset-points button {
  position: absolute;
  width: 11px;
  height: 11px;
  padding: 0;
  cursor: pointer;
  background: #8f969f;
  border: 0;
  border-radius: 999px;
  box-shadow: 0 0 0 2px rgba(20, 20, 20, 0.94);
  transform: translate(-50%, -50%);
  pointer-events: auto;
}
.opacity-thumb {
  position: absolute;
  z-index: 6;
  top: 50%;
  width: 16px;
  height: 16px;
  background: var(--art-theme);
  border-radius: 999px;
  box-shadow: 0 0 0 3px rgba(20, 20, 20, 0.94);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.setting-options {
  display: grid;
  grid-column: 2 / 4;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}
.setting-options button,
.offset-stepper button {
  min-height: 22px;
  color: #eee;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
}
.setting-options button.active {
  color: #fff;
  background: color-mix(in srgb, var(--art-theme) 56%, transparent);
  border-color: var(--art-theme);
}
.offset-stepper {
  display: grid;
  grid-column: 2 / 4;
  grid-template-columns: 34px 44px minmax(52px, 1fr) 44px 34px;
  gap: 4px;
  align-items: center;
}
.offset-stepper input {
  width: 100%;
  min-width: 0;
  height: 22px;
  color: #eee;
  text-align: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
}
.danmaku-source {
  grid-template-columns: 56px auto auto;
}
.danmaku-source button {
  min-height: 22px;
  padding: 2px 7px;
  color: #eee;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
}
.danmaku-source button:disabled {
  color: #777;
}
.danmaku-source small {
  grid-column: 2 / 4;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 再生制御ロック：ArtPlayer のコントロール条と中央再生ボタンを display:none で
   消し、video 本体は pointer-events:none で点击を殺す。display:none は控件自身の
   可点性に覆されない（前回 .art-video-player の pointer-events:none では控件が勝ち
   再生ボタンが押せた）。.art-bottom=底部条(進度条+再生/音量/全屏)、.art-mask=中央
   オーバーレイ(.art-state 大再生ボタン)。$player の兄弟 join-gate と pointer-events:
   auto の弹幕 toggle は影響を受けない。程序化 art.play()/seek は JS 呼び出しのため
   follower 同期は妨げない。授権/房主時(control-locked なし)は控件が復帰する。 */
.enmoku-player.control-locked :deep(.art-bottom),
.enmoku-player.control-locked :deep(.art-mask) {
  display: none;
}
.enmoku-player.control-locked :deep(.art-video) {
  pointer-events: none;
}
/* 再生制御提示帯：純視覚（pointer-events:none で拦截はしない）。color のみで
   状態を伝えないようテキストを併記（accessibility）。 */
.control-lock {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
  color: #fff;
  font-size: 0.9rem;
  background: rgba(0, 0, 0, 0.15);
}
.control-lock span {
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
}
.join-gate {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 1.25rem;
  cursor: pointer;
}
</style>
