<script setup lang="ts">
import { housou } from "@/api"
import EnmokuComposer from "@/components/bangumi/EnmokuComposer.vue"
import ChatPanel from "@/components/chat/ChatPanel.vue"
import DanmakuOverlay from "@/components/danmaku/DanmakuOverlay.vue"
import FileDanmakuOverlay from "@/components/danmaku/FileDanmakuOverlay.vue"
import KengenPanel from "@/components/kengen/KengenPanel.vue"
// biome-ignore lint/style/useImportType: used as a <template> component; biome only sees the script's `typeof EnmokuPlayer` and misses the value usage.
import EnmokuPlayer from "@/components/player/EnmokuPlayer.vue"
import { useRoomMotion } from "@/composables/use-room-motion"
import { useShinkou } from "@/composables/useShinkou"
import { t } from "@/i18n"
import {
  canCancelBangumiItem,
  canClearPendingBangumi,
  canDeleteBangumiItem,
  canMoveBangumiItem,
  canPlayBangumiItem,
  isCurrentEnmoku,
} from "@/lib/bangumi-actions"
import {
  type ProviderStatKey,
  bilibiliProvider,
  enmokuMetadataSummary,
  enmokuPlayableUrl,
  enmokuSourceChoices,
  providerStatItems,
  sourceIndexFromValue,
  sourceValue,
} from "@/lib/enmoku-metadata"
import { resolveEnmoku } from "@/lib/enmoku-resolve"
import { loadFileDanmakuEnabled, saveFileDanmakuEnabled } from "@/lib/file-danmaku-pref"
import { housouUrl } from "@/lib/housou-url"
import { showJoinGate } from "@/lib/join-gate"
import { useBushitsuStore } from "@/stores/bushitsu"
import { useSeitoStore } from "@/stores/seito"
import { KousokuClient, type KousokuConnectionStatus } from "@/ws/client"
import { type DanmakuCue, parseBilibiliXml } from "houkago-kokuban"
import type { Enmoku, Kengen, NyuushitsuMode } from "houkago-kousoku"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

// 放映 page: player + chat side panel. Wires the WS client to the store
// (writer) and exposes a manual direct-link enmoku for the scaffold demo.
const route = useRoute()
const router = useRouter()
const bushitsu = useBushitsuStore()
const seito = useSeitoStore()
const roomShell = ref<HTMLElement | null>(null)
const roomMotion = useRoomMotion()
const bushitsuId = String(route.params.id)
const roomName = ref("")
const roomLink = computed(() => (typeof location === "undefined" ? bushitsuId : location.href))

const current = ref<Enmoku | null>(null)
const currentEnmokuId = computed(() => current.value?.id ?? null)
const pendingBangumiCount = computed(
  () =>
    bushitsu.bangumi.filter((enmoku) => !isCurrentEnmoku(enmoku.id, currentEnmokuId.value)).length,
)
const clearPendingEnabled = computed(() =>
  canClearPendingBangumi(bushitsu.isBuchou, pendingBangumiCount.value),
)
const movePendingId = ref<string | null>(null)
const clearPendingRequest = ref(false)
const queueManagementError = ref("")
const queueManagementSuccess = ref("")
const clearPendingDialog = ref<HTMLDialogElement | null>(null)
const selectedSourceIndex = ref<number | null>(null)
const currentSourceChoices = computed(() =>
  current.value ? enmokuSourceChoices(current.value, t("sourcePrimary")) : [],
)
const currentMetadata = computed(() =>
  current.value ? enmokuMetadataSummary(current.value) : null,
)
const hasInlineMetadata = computed(() => {
  const metadata = currentMetadata.value
  return metadata ? metadata.subtitleNames.length > 0 || metadata.live !== undefined : false
})
const currentPlayableUrl = computed(() =>
  current.value ? enmokuPlayableUrl(current.value, selectedSourceIndex.value) : "",
)
const selectedSourceValue = computed({
  get: () => sourceValue(selectedSourceIndex.value),
  set: (value: string) => {
    selectedSourceIndex.value = sourceIndexFromValue(value)
  },
})

// 視聴 UI 態（pure view state, not store; state-management）：聊天展開（chat collapse arrow）
// と聊天室模式（左播放器 + 右聊天，全屏式房间布局；不改变 ArtPlayer 原生网页全屏）。
const chatHiraku = ref(true)
const cinemaMode = ref(false)
const portraitRoom = ref(false)
const chatSheet = ref<HTMLDialogElement | null>(null)
const chatLauncher = ref<HTMLButtonElement | null>(null)
const chatSheetOpen = ref(false)
const chatSheetExpanded = ref(false)
let portraitRoomQuery: MediaQueryList | null = null
let chatLauncherFocus: HTMLElement | null = null
const wsStatus = ref<KousokuConnectionStatus>("closed")
const kengenPending = ref(false)
const kengenError = ref("")
const wsStatusLabel = computed(() => {
  switch (wsStatus.value) {
    case "connecting":
      return t("roomStatusConnecting")
    case "open":
      return t("roomStatusNormal")
    case "error":
      return t("roomStatusError")
    case "closed":
      return t("roomStatusClosed")
  }
})

// 参加済みか（follower の autoplay ゲート用, pure view 態 → store 不要）。
// 部長は遮罩自体が出ないので影響しない。
const joined = ref(false)

let client: KousokuClient | null = null

// 進行制御: routes player events → SHINKOU (host) and remote SHINKOU/GENJOU →
// player (部員). The controller gates by role + 追従中; this view just connects.
const playerRef = ref<InstanceType<typeof EnmokuPlayer> | null>(null)
const shinkou = useShinkou((msg) => client?.send(msg), playerRef)
const bootstrapped = ref(false)
let stopEnmokuWatch: ReturnType<typeof watch> | null = null

// 参加ボタン押下：joined を立てて遮罩を消し、同じ同期スタック内で catchUp。
// EnmokuPlayer 側が先に音付き play() を済ませてあるので、ここは房主の現在位置へ
// seek + 追従させるだけ（手势保留のため非同期を挟まない）。
function onJoin() {
  joined.value = true
  shinkou.catchUp()
}

function setCinemaMode(enabled: boolean) {
  cinemaMode.value = enabled
  if (cinemaMode.value) {
    chatHiraku.value = true
    closeChatSheet(false)
  }
}

function collapseChat() {
  chatHiraku.value = false
  cinemaMode.value = false
}

function closeChatSheet(restoreFocus = true) {
  chatSheetExpanded.value = false
  const dialog = chatSheet.value
  if (dialog?.open) dialog.close()
  chatSheetOpen.value = false
  if (restoreFocus) void nextTick(() => chatLauncherFocus?.focus())
}

function openChatSheet() {
  if (!portraitRoom.value) {
    chatHiraku.value = true
    return
  }
  chatLauncherFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  chatSheetOpen.value = true
  void nextTick(() => {
    const dialog = chatSheet.value
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    roomMotion.enterPanel(dialog)
  })
}

function toggleChatSheetExpanded() {
  chatSheetExpanded.value = !chatSheetExpanded.value
}

function syncPortraitRoom() {
  const isPortraitRoom = portraitRoomQuery?.matches ?? false
  if (!isPortraitRoom) closeChatSheet(false)
  portraitRoom.value = isPortraitRoom
}

function reconnectKousoku() {
  client?.connect(bushitsuId)
}

// ArtPlayer の $player を弹幕 overlay の Teleport target に。EnmokuPlayer mount 后
// 才有值，computed 在其可用后更新，Teleport 自动迁移到全屏子树。
const playerEl = computed<HTMLElement | null>(() => playerRef.value?.playerEl ?? null)

// コントロール条の显隐：EnmokuPlayer の @control（emit）を自有 ref で受け、
// DanmakuOverlay へ prop で下す（prd Bug1）。暴露 ref→親 computed の脆い連鎖を
// 避け、原生全屏含む三態で確実に響応させる。pure view 態 → store 不要。
const controlsShown = ref(true)
const playbackTime = ref(0)
const DANMAKU_BASE_SIZE = 22
// 演目切替（current 変更）で player が再 mount され control 発火前は条あり扱いに
// 復位させる。EnmokuPlayer 卸載は control を停発するので親側で戻す。
watch(current, () => {
  controlsShown.value = true
  playbackTime.value = 0
  selectedSourceIndex.value = null
})

const fileInput = ref<HTMLInputElement | null>(null)
const fileDanmakuEnabled = ref(loadFileDanmakuEnabled())
const fileDanmakuByEnmoku = ref<Record<string, DanmakuCue[]>>({})
const fileDanmakuNameByEnmoku = ref<Record<string, string>>({})
const fetchedDanmakuByEnmoku = ref<Record<string, DanmakuCue[]>>({})
const fetchedDanmakuNameByEnmoku = ref<Record<string, string>>({})
const fileDanmakuTrackVersion = ref(0)
const fetchedDanmakuTrackVersion = ref(0)
const danmakuSize = ref(1)
const danmakuOpacity = ref(1)
const danmakuSpeed = ref(1)
const danmakuTimeOffset = ref(0)
const providerInfoEnmoku = ref<Enmoku | null>(null)
const providerDialog = ref<HTMLElement | null>(null)
let fetchedDanmakuRequest = 0

watch(providerInfoEnmoku, (provider) => {
  if (!provider) return
  void nextTick(() => roomMotion.enterPanel(providerDialog.value))
})

const currentFileDanmaku = computed(() => {
  const id = currentEnmokuId.value
  return id ? (fileDanmakuByEnmoku.value[id] ?? []) : []
})
const currentFileDanmakuName = computed(() => {
  const id = currentEnmokuId.value
  return id ? (fileDanmakuNameByEnmoku.value[id] ?? "") : ""
})
const currentFetchedDanmaku = computed(() => {
  const id = currentEnmokuId.value
  return id ? (fetchedDanmakuByEnmoku.value[id] ?? []) : []
})
const currentFetchedDanmakuName = computed(() => {
  const id = currentEnmokuId.value
  return id ? (fetchedDanmakuNameByEnmoku.value[id] ?? "") : ""
})
const currentTimelineDanmaku = computed(() =>
  currentFileDanmakuName.value ? currentFileDanmaku.value : currentFetchedDanmaku.value,
)
const currentTimelineDanmakuName = computed(
  () => currentFileDanmakuName.value || currentFetchedDanmakuName.value,
)
const timelineDanmakuTrackVersion = computed(
  () => fileDanmakuTrackVersion.value + fetchedDanmakuTrackVersion.value,
)
const providerInfo = computed(() =>
  providerInfoEnmoku.value ? bilibiliProvider(providerInfoEnmoku.value) : null,
)
const providerInfoStats = computed(() => providerStatItems(providerInfo.value ?? undefined))

function toggleFileDanmaku() {
  fileDanmakuEnabled.value = !fileDanmakuEnabled.value
  saveFileDanmakuEnabled(fileDanmakuEnabled.value)
}

function chooseFileDanmaku() {
  fileInput.value?.click()
}

async function onFileDanmakuSelected(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const file = target.files?.[0]
  target.value = ""
  const enmokuId = currentEnmokuId.value
  if (!file || !enmokuId) return

  const cues = parseBilibiliXml(await file.text())
  fileDanmakuByEnmoku.value = { ...fileDanmakuByEnmoku.value, [enmokuId]: cues }
  fileDanmakuNameByEnmoku.value = {
    ...fileDanmakuNameByEnmoku.value,
    [enmokuId]: cues.length > 0 ? file.name : t("fileDanmakuEmpty"),
  }
  fileDanmakuTrackVersion.value += 1
  const snapshot = playerRef.value?.snapshot()
  if (snapshot) {
    playbackTime.value = snapshot.currentTime
  }
}

async function loadFetchedDanmaku(enmoku: Enmoku | null) {
  const requestId = ++fetchedDanmakuRequest
  if (!enmoku || enmoku.danmaku?.type !== "fetch") return
  if (!enmoku.danmaku.ref.startsWith("bilibili:")) return
  if (fetchedDanmakuByEnmoku.value[enmoku.id]) return

  let data: DanmakuCue[] | null = null
  try {
    const response = await housou.eisha.danmaku({ ref: enmoku.danmaku.ref }).get()
    data = response.data ?? null
  } catch {
    if (requestId === fetchedDanmakuRequest && currentEnmokuId.value === enmoku.id) {
      fetchedDanmakuNameByEnmoku.value = {
        ...fetchedDanmakuNameByEnmoku.value,
        [enmoku.id]: t("fileDanmakuEmpty"),
      }
    }
    return
  }
  if (requestId !== fetchedDanmakuRequest || currentEnmokuId.value !== enmoku.id || !data) return

  fetchedDanmakuByEnmoku.value = { ...fetchedDanmakuByEnmoku.value, [enmoku.id]: data }
  fetchedDanmakuNameByEnmoku.value = {
    ...fetchedDanmakuNameByEnmoku.value,
    [enmoku.id]: data.length > 0 ? t("danmakuSourceRemote") : t("fileDanmakuEmpty"),
  }
  fetchedDanmakuTrackVersion.value += 1
  const snapshot = playerRef.value?.snapshot()
  if (snapshot) {
    playbackTime.value = snapshot.currentTime
  }
}

function closeProviderInfo() {
  providerInfoEnmoku.value = null
}

function providerStatLabel(key: ProviderStatKey): string {
  switch (key) {
    case "view":
      return t("providerStatsView")
    case "danmaku":
      return t("providerStatsDanmaku")
    case "reply":
      return t("providerStatsReply")
    case "favorite":
      return t("providerStatsFavorite")
    case "coin":
      return t("providerStatsCoin")
    case "like":
      return t("providerStatsLike")
    case "share":
      return t("providerStatsShare")
  }
}

// 房主放映：register the source as a room 演目 (real enmokuId), refresh the local
// 番組表, then broadcast JOUEI(enmokuId). The host does not set `current` directly
// — the JOUEI echo flows back through the store.enmokuId watch like any 部員, so
// host and members share one resolve→play path (state-management: WS is writer).
// 権限設定: the host changes a guest-permission switch → SETTEI(C→S). housou
// stores it and broadcasts KENGEN back, which the store applies — so the host's
// own UI also follows the round-trip, not a local optimistic write.
function settei(kengen: Kengen) {
  if (kengenPending.value) return
  if (!client || wsStatus.value !== "open") {
    kengenError.value = t("kengenSaveFailed")
    return
  }
  kengenPending.value = true
  kengenError.value = ""
  client.send({ type: "SETTEI", ts: Date.now(), senderId: bushitsu.senderId, payload: kengen })
}

function nyuushitsuSettei(mode: NyuushitsuMode, password?: string) {
  client?.send({
    type: "NYUUSHITSU_SETTEI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: password === undefined ? { mode } : { mode, password },
  })
}

function nyuushitsuHantei(senderId: string, approved: boolean) {
  client?.send({
    type: "NYUUSHITSU_HANTEI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { senderId, approved },
  })
}

async function removeBuin(seitoId: string) {
  const { error } = await housou.bushitsu({ id: bushitsuId }).meibo({ seitoId }).delete()
  return !error
}

function sendJouei(enmokuId: string | null) {
  if (!canPlayBangumiItem(bushitsu.canPlaylist)) return
  client?.send({
    type: "JOUEI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { enmokuId },
  })
}

function playBangumi(enmokuId: string) {
  sendJouei(enmokuId)
}

function cancelBangumi(enmokuId: string) {
  if (!canCancelBangumiItem(bushitsu.canPlaylist, enmokuId, currentEnmokuId.value)) return
  sendJouei(null)
}

async function deleteBangumiEnmoku(enmokuId: string) {
  if (!canDeleteBangumiItem(bushitsu.canPlaylist, enmokuId, currentEnmokuId.value)) return
  await housou.bushitsu({ id: bushitsuId }).enmoku({ enmokuId }).delete()
}

function openClearPendingDialog() {
  queueManagementError.value = ""
  queueManagementSuccess.value = ""
  clearPendingDialog.value?.showModal()
}

function closeClearPendingDialog() {
  if (clearPendingRequest.value) return
  clearPendingDialog.value?.close()
}

async function moveBangumi(enmokuId: string, direction: "up" | "down", index: number) {
  if (!canMoveBangumiItem(bushitsu.isBuchou, index, bushitsu.bangumi.length, direction)) return
  movePendingId.value = enmokuId
  queueManagementError.value = ""
  queueManagementSuccess.value = ""
  const { error } = await housou
    .bushitsu({ id: bushitsuId })
    .bangumi({ enmokuId })
    .move.post({ direction })
  movePendingId.value = null
  if (error) {
    queueManagementError.value = t("queueManageFailed")
    return
  }
  queueManagementSuccess.value = t("queueManageSucceeded")
}

async function clearPendingBangumi() {
  if (!clearPendingEnabled.value || clearPendingRequest.value) return
  clearPendingRequest.value = true
  queueManagementError.value = ""
  queueManagementSuccess.value = ""
  const { error } = await housou.bushitsu({ id: bushitsuId }).bangumi.pending.delete()
  clearPendingRequest.value = false
  if (error) {
    queueManagementError.value = t("queueManageFailed")
    return
  }
  clearPendingDialog.value?.close()
  queueManagementSuccess.value = t("queueManageSucceeded")
}

function sourceBadge(enmoku: Enmoku): string {
  if (bilibiliProvider(enmoku)) return "哔"
  switch (enmoku.type) {
    case "direct":
      return t("sourceDirectBadge")
    case "hls":
      return t("sourceHlsBadge")
    case "dash":
      return t("sourceDashBadge")
    case "live":
      return t("sourceLiveBadge")
  }
}

function sourceBadgeTitle(enmoku: Enmoku): string {
  return bilibiliProvider(enmoku) ? t("providerBilibili") : enmoku.type.toUpperCase()
}

// 上映中の解決：apply the authoritative enmokuId by resolving it to the room's
// Enmoku and setting `current`. If the local 番組表 lacks it (late joiner, or a
// source another client registered), re-fetch the 番組表 once and resolve again.
async function applyEnmokuId(enmokuId: string | null) {
  if (!enmokuId) {
    current.value = null
    return
  }
  let enmoku = resolveEnmoku(bushitsu.bangumi, enmokuId)
  if (!enmoku) {
    const { data } = await housou.bushitsu({ id: bushitsuId }).bangumi.get()
    if (data) bushitsu.setBangumi(data)
    enmoku = resolveEnmoku(bushitsu.bangumi, enmokuId)
  }
  current.value = enmoku
  void loadFetchedDanmaku(enmoku)
}

function oshaberi(content: string) {
  client?.send({
    type: "OSHABERI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { content },
  })
}

function danmaku(content: string, options?: { color?: string }) {
  const payload = options?.color ? { content, color: options.color } : { content }
  client?.send({
    type: "DANMAKU",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload,
  })
}

// 昵称 gate: a direct-link / refresh / 隐私窗口 visitor has no persisted nickname,
// so connecting would fall back to the raw senderId (uuid) server-side. Gate the
// WS connect behind an inline name form (pure view 態, not store). The 部員
// join-gate (autoplay 遮罩) is a separate, later layer; this name gate runs first.
const nameGate = ref(false)
const nameInput = ref(t("nicknamePlaceholder"))

function submitName() {
  bushitsu.setNickname(nameInput.value.trim() || t("nicknamePlaceholder"))
  nameGate.value = false
  startSession()
}

async function enterRoom() {
  if (bootstrapped.value) return
  bootstrapped.value = true
  const roomRequest = housou.bushitsu({ id: bushitsuId }).get()
  // A BANGUMI frame can arrive while this initial fetch is in flight. Keep that
  // newer room snapshot instead of letting the older HTTP response overwrite it.
  const bangumiAtRequest = bushitsu.bangumi
  const bangumiRequest = housou.bushitsu({ id: bushitsuId }).bangumi.get()

  // Learn who the 部長 is so isBuchou is known before we decide to follow.
  const { data: room } = await roomRequest
  if (room) {
    bushitsu.buchouId = room.buchouId
    roomName.value = room.name
  }

  // 追いかけ: a 部員 asks for authority state to catch up; the host drives, so it
  // does not follow and does not ask.
  if (!bushitsu.isBuchou) {
    client.send({ type: "OIKAKE", ts: Date.now(), senderId: bushitsu.senderId, payload: {} })
  }

  const { data } = await bangumiRequest
  if (data && bushitsu.bangumi === bangumiAtRequest) bushitsu.setBangumi(data)

  // store.enmokuId is the single source of truth for 上映中, written by the WS
  // client from JOUEI (host pick / echo) and GENJOU (late-joiner catch-up).
  // Watching it gives host + 部員 + late joiners one resolve→play path.
  // immediate covers the case where GENJOU已 set enmokuId before this mounts.
  stopEnmokuWatch?.()
  stopEnmokuWatch = watch(() => bushitsu.enmokuId, applyEnmokuId, { immediate: true })
}

// Connect first, then wait for the server-authoritative admission status. Only
// after NYUUSHITSU says "entered" do we bootstrap room data and sync.
async function startSession() {
  const base = housouUrl()
  bushitsu.nyuushitsuStatus = "idle"
  bootstrapped.value = false
  client = new KousokuClient(
    base,
    (msg) => {
      bushitsu.apply(msg) // keep the store the single source of truth first
      if (msg.type === "KENGEN") {
        kengenPending.value = false
        kengenError.value = ""
      }
      if (msg.type === "KEIHOU" && kengenPending.value) {
        kengenPending.value = false
        kengenError.value = t("kengenSaveFailed")
      }
      if (msg.type === "NYUUSHITSU" && msg.payload.status === "entered") {
        void enterRoom()
      }
      if (msg.type === "NYUUSHITSU" && msg.payload.status === "revoked") {
        client?.close()
        void router.replace({ name: "home", query: { revoked: "1" } })
      }
      shinkou.handleRemote(msg) // then drive the player by message type
    },
    (status) => {
      wsStatus.value = status
      if ((status === "closed" || status === "error") && kengenPending.value) {
        kengenPending.value = false
        kengenError.value = t("kengenSaveFailed")
      }
      if (status === "connecting") {
        bootstrapped.value = false
      }
      if (status === "open") roomMotion.confirm(roomShell.value)
    },
  )
  client.connect(bushitsuId)
}

onMounted(() => {
  portraitRoomQuery = window.matchMedia("(max-width: 800px) and (orientation: portrait)")
  syncPortraitRoom()
  portraitRoomQuery.addEventListener("change", syncPortraitRoom)
  roomMotion.enterRoom(roomShell.value)
  bushitsu.bushitsuId = bushitsuId
  void seito.restore().then((account) => {
    if (!account) {
      void router.replace({ name: "home" })
      return
    }
    bushitsu.setSenderId(account.id)
    startSession()
  })
})

onBeforeUnmount(() => {
  portraitRoomQuery?.removeEventListener("change", syncPortraitRoom)
  closeChatSheet(false)
  stopEnmokuWatch?.()
  client?.close()
})
</script>

<template>
  <div ref="roomShell" class="bushitsu" :class="{ 'cinema-mode': cinemaMode }">
    <div v-if="nameGate" class="name-gate">
      <form class="name-form" @submit.prevent="submitName">
        <label>
          {{ t("nicknameLabel") }}
          <input
            v-model="nameInput"
            :aria-label="t('nicknameLabel')"
            :placeholder="t('nicknamePlaceholder')"
          />
        </label>
        <button type="submit">{{ t("joinBushitsu") }}</button>
      </form>
    </div>
    <div v-else-if="bushitsu.nyuushitsuStatus !== 'entered'" class="nyuushitsu-gate">
      <p v-if="bushitsu.nyuushitsuStatus === 'waiting'">
        {{ t("waitingApproval") }}
      </p>
      <p v-else-if="bushitsu.nyuushitsuStatus === 'closed'">
        {{ t("nyuushitsuClosed") }}
      </p>
      <p v-else-if="bushitsu.nyuushitsuStatus === 'rejected'">
        {{ t("nyuushitsuRejected") }}
      </p>
      <p v-else>{{ t("enteringBushitsu") }}</p>
      <p class="nyuushitsu-status">
        {{ t("roomInfoStatus") }}: {{ wsStatusLabel }}
      </p>
    </div>
    <template v-else>
      <main class="stage">
        <template v-if="current">
          <div class="player-wrap">
            <EnmokuPlayer
              ref="playerRef"
              :key="current.id"
              :url="currentPlayableUrl"
              :type="current.type"
              :show-join-gate="showJoinGate(bushitsu.isBuchou, joined)"
              :control-locked="!bushitsu.canControl"
              :cinema-mode="cinemaMode"
              :source-choices="currentSourceChoices"
              :selected-source-value="selectedSourceValue"
              :file-danmaku-enabled="fileDanmakuEnabled"
              :file-danmaku-name="currentTimelineDanmakuName || t('danmakuNone')"
              :danmaku-size="danmakuSize"
              :danmaku-opacity="danmakuOpacity"
              :danmaku-speed="danmakuSpeed"
              :danmaku-time-offset="danmakuTimeOffset"
              @shinkou="shinkou.onLocalShinkou"
              @ready="shinkou.catchUp"
              @join="onJoin"
              @control="controlsShown = $event"
              @time="playbackTime = $event"
              @cinema="setCinemaMode"
              @source="selectedSourceValue = $event"
              @toggle-file-danmaku="toggleFileDanmaku"
              @choose-file-danmaku="chooseFileDanmaku"
              @danmaku-size="danmakuSize = $event"
              @danmaku-opacity="danmakuOpacity = $event"
              @danmaku-speed="danmakuSpeed = $event"
              @danmaku-time-offset="danmakuTimeOffset = $event"
            />
            <FileDanmakuOverlay
              :target="playerEl"
              :cues="currentTimelineDanmaku"
              :current-time="playbackTime"
              :enabled="fileDanmakuEnabled"
              :size="DANMAKU_BASE_SIZE * danmakuSize"
              :opacity="danmakuOpacity"
              :speed="danmakuSpeed"
              :time-offset="danmakuTimeOffset"
              :track-version="timelineDanmakuTrackVersion"
            />
            <DanmakuOverlay :target="playerEl" :controls-shown="controlsShown" :show-toggle="false" />
            <input
              ref="fileInput"
              class="file-danmaku-input"
              type="file"
              accept=".xml,text/xml,application/xml"
              :aria-label="t('danmakuSourceFile')"
              @change="onFileDanmakuSelected"
            />
          </div>
        </template>
        <div v-else class="placeholder">
          <span>{{ t("waitingBuchouJouei") }}</span>
        </div>
        <div v-if="current && hasInlineMetadata" class="media-toolbar">
          <section
            v-if="currentMetadata"
            class="enmoku-metadata"
            :aria-label="t('enmokuMetadataHeading')"
          >
            <div v-if="currentMetadata.subtitleNames.length > 0" class="metadata-pill">
              <span>{{ t("subtitlesLabel") }}</span>
              <strong>{{ currentMetadata.subtitleNames.join(" / ") }}</strong>
            </div>
            <div v-if="currentMetadata.live !== undefined" class="metadata-pill">
              <strong>{{ currentMetadata.live ? t("liveTrue") : t("liveFalse") }}</strong>
            </div>
          </section>
        </div>
        <button
          v-if="portraitRoom"
          ref="chatLauncher"
          type="button"
          class="mobile-chat-launcher"
          :aria-controls="'mobile-chat-sheet'"
          :aria-expanded="chatSheetOpen"
          @click="openChatSheet"
        >
          {{ t("chatLauncher") }}
        </button>
        <div class="room-workbench">
          <aside class="room-control-panel">
            <details class="room-disclosure" :open="!portraitRoom">
              <summary>
                <strong>{{ bushitsu.isBuchou ? t("roomControlHeading") : t("roomInfoHeading") }}</strong>
                <span>{{ roomName || bushitsuId }} · {{ wsStatusLabel }}</span>
              </summary>
              <div class="room-control-content">
                <h3>{{ bushitsu.isBuchou ? t("roomControlHeading") : t("roomInfoHeading") }}</h3>
                <KengenPanel
                  :room-name="roomName || bushitsuId"
                  :room-link="roomLink"
                  :room-status="wsStatus"
                  :kengen-pending="kengenPending"
                  :kengen-error="kengenError"
                  :remove-buin="removeBuin"
                  @settei="settei"
                  @nyuushitsu-settei="nyuushitsuSettei"
                  @nyuushitsu-hantei="nyuushitsuHantei"
                  @reconnect="reconnectKousoku"
                />
              </div>
            </details>
          </aside>
          <section class="bangumi">
            <details class="bangumi-disclosure" :open="!portraitRoom">
              <summary>
                <strong>{{ t("bangumiHeading") }}</strong>
                <span>{{ bushitsu.bangumi.length }}</span>
              </summary>
              <div class="bangumi-content">
                <h3>{{ t("bangumiHeading") }}</h3>
                <EnmokuComposer
                  v-if="bushitsu.canPlaylist"
                  :bushitsu-id="bushitsuId"
                  @jouei="playBangumi"
                />
                <div v-if="bushitsu.isBuchou" class="bangumi-management">
                  <button
                    type="button"
                    class="bangumi-action danger"
                    :disabled="!clearPendingEnabled || clearPendingRequest"
                    @click="openClearPendingDialog"
                  >
                    {{ t("clearPending") }}
                  </button>
                </div>
                <p v-if="queueManagementError" class="bangumi-feedback error" role="alert">
                  {{ queueManagementError }}
                </p>
                <p v-else-if="queueManagementSuccess" class="bangumi-feedback" role="status">
                  {{ queueManagementSuccess }}
                </p>
                <ul>
              <li
                v-for="(e, index) in bushitsu.bangumi"
                :key="e.id"
                class="bangumi-row"
                :class="{ current: isCurrentEnmoku(e.id, currentEnmokuId) }"
                :aria-current="isCurrentEnmoku(e.id, currentEnmokuId) ? 'true' : undefined"
              >
                <span class="source-mark" :title="sourceBadgeTitle(e)">
                  {{ sourceBadge(e) }}
                </span>
                <span class="bangumi-title">
                  {{ e.title || t("manualEnmokuTitle") }}
                </span>
                <span class="bangumi-meta">
                  <span v-if="isCurrentEnmoku(e.id, currentEnmokuId)" class="bangumi-status">
                    {{ t("joueiChuu") }}
                  </span>
                  <button
                    v-if="bilibiliProvider(e)"
                    type="button"
                    class="provider-info-button"
                    :aria-label="t('providerInfoAria')"
                    @click="providerInfoEnmoku = e"
                  >
                    i
                  </button>
                  <button
                    v-if="bushitsu.canPlaylist"
                    type="button"
                    class="bangumi-action"
                    :disabled="!canPlayBangumiItem(bushitsu.canPlaylist)"
                    @click="playBangumi(e.id)"
                  >
                    {{ t("play") }}
                  </button>
                  <button
                    v-if="bushitsu.canPlaylist"
                    type="button"
                    class="bangumi-action"
                    :disabled="!canCancelBangumiItem(bushitsu.canPlaylist, e.id, currentEnmokuId)"
                    @click="cancelBangumi(e.id)"
                  >
                    {{ t("cancelPlay") }}
                  </button>
                  <button
                    v-if="bushitsu.canPlaylist"
                    type="button"
                    class="bangumi-action danger"
                    :disabled="!canDeleteBangumiItem(bushitsu.canPlaylist, e.id, currentEnmokuId)"
                    @click="deleteBangumiEnmoku(e.id)"
                  >
                    {{ t("delete") }}
                  </button>
                  <button
                    v-if="bushitsu.isBuchou"
                    type="button"
                    class="bangumi-action"
                    :disabled="
                      movePendingId !== null ||
                      !canMoveBangumiItem(bushitsu.isBuchou, index, bushitsu.bangumi.length, 'up')
                    "
                    @click="moveBangumi(e.id, 'up', index)"
                  >
                    {{ t("moveUp") }}
                  </button>
                  <button
                    v-if="bushitsu.isBuchou"
                    type="button"
                    class="bangumi-action"
                    :disabled="
                      movePendingId !== null ||
                      !canMoveBangumiItem(bushitsu.isBuchou, index, bushitsu.bangumi.length, 'down')
                    "
                    @click="moveBangumi(e.id, 'down', index)"
                  >
                    {{ t("moveDown") }}
                  </button>
                </span>
              </li>
                </ul>
              </div>
            </details>
          </section>
        </div>
      </main>
      <dialog
        ref="clearPendingDialog"
        class="queue-confirm-dialog"
        aria-labelledby="clear-pending-title"
        @cancel.prevent="closeClearPendingDialog"
      >
        <form method="dialog" @submit.prevent="clearPendingBangumi">
          <h2 id="clear-pending-title">{{ t("clearPendingTitle") }}</h2>
          <p>{{ t("clearPendingNotice") }}</p>
          <p v-if="queueManagementError" class="bangumi-feedback error" role="alert">
            {{ queueManagementError }}
          </p>
          <div class="queue-confirm-actions">
            <button type="button" :disabled="clearPendingRequest" @click="closeClearPendingDialog">
              {{ t("cancel") }}
            </button>
            <button type="submit" class="danger" :disabled="!clearPendingEnabled || clearPendingRequest">
              {{ t("clearPendingConfirm") }}
            </button>
          </div>
        </form>
      </dialog>
      <div
        v-if="providerInfoEnmoku && providerInfo"
        class="provider-dialog-backdrop"
        @click.self="closeProviderInfo"
      >
        <section ref="providerDialog" class="provider-dialog" role="dialog" :aria-label="t('providerInfoAria')">
          <header>
            <strong>{{ t("providerBilibili") }}</strong>
            <button type="button" :aria-label="t('providerDialogClose')" @click="closeProviderInfo">
              ×
            </button>
          </header>
          <img v-if="providerInfo.coverUrl" :src="providerInfo.coverUrl" :alt="providerInfoEnmoku.title" />
          <h4>{{ providerInfoEnmoku.title }}</h4>
          <p v-if="providerInfo.ownerName">
            <span>{{ t("providerOwner") }}</span>
            <strong>{{ providerInfo.ownerName }}</strong>
          </p>
          <dl v-if="providerInfoStats.length > 0" class="provider-stats">
            <div v-for="item in providerInfoStats" :key="item.key">
              <dt>{{ providerStatLabel(item.key) }}</dt>
              <dd>{{ item.value.toLocaleString() }}</dd>
            </div>
          </dl>
          <a :href="providerInfo.url" target="_blank" rel="noreferrer">
            {{ t("providerExternalLink") }}
          </a>
        </section>
      </div>
      <dialog
        id="mobile-chat-sheet"
        ref="chatSheet"
        class="mobile-chat-sheet"
        :class="{ 'is-expanded': chatSheetExpanded }"
        :aria-label="t('chatSheetAria')"
        @cancel.prevent="closeChatSheet()"
        @click.self="closeChatSheet()"
      >
        <div class="mobile-chat-sheet-shell">
          <header>
            <span>{{ t("chatSheetAria") }}</span>
            <span class="mobile-chat-sheet-actions">
              <button type="button" @click="toggleChatSheetExpanded">
                {{ chatSheetExpanded ? t("chatSheetShrink") : t("chatSheetExpand") }}
              </button>
              <button type="button" @click="closeChatSheet()">{{ t("chatSheetClose") }}</button>
            </span>
          </header>
          <ChatPanel @oshaberi="oshaberi" @danmaku="danmaku" @toggle="closeChatSheet()" />
        </div>
      </dialog>
      <!-- 折叠態の展开手柄（prd #4）：右缘の常駐ホットゾーンが hover/focus を受け、
         中の ‹ ボタンを浮現させる。既定は不可视（opacity:0）、keyboard でも focus で
         浮現し可達。展开中は v-if で消す（header 内の › で畳む）。 -->
      <div v-if="!portraitRoom && !chatHiraku" class="hiraku-handle">
        <button
          type="button"
          class="hiraku-button"
          :aria-label="t('chatOpenAria')"
          :aria-expanded="chatHiraku"
          @click="chatHiraku = true"
        >
          ‹
        </button>
      </div>
      <ChatPanel
        v-if="!portraitRoom"
        v-show="chatHiraku"
        @oshaberi="oshaberi"
        @danmaku="danmaku"
        @toggle="collapseChat"
      />
    </template>
  </div>
</template>

<style scoped>
.bushitsu {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: radial-gradient(circle at top left, var(--color-canvas-glow), var(--color-canvas));
  color: var(--color-text);
}
.stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  padding: 0 12px 0 12px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
}
.file-danmaku-input {
  display: none;
}
/* player + overlay share one positioned wrapper so the overlay covers the player. */
.player-wrap {
  position: relative;
  flex: none;
  min-height: 0;
}
/* 普通模式：播放器吃满舞台宽度，但高度按 16:9 倾向计算。
   下方面板按内容高度布局；矮窗口由 stage 滚动，而不是裁掉番組表。 */
.player-wrap {
  flex: 0 0 min(56.25cqw, calc(100dvh - 260px), 820px);
  width: 100%;
  min-height: 280px;
}
.player-wrap :deep(.enmoku-player) {
  height: 100%;
}
.media-toolbar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
}
.enmoku-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 28px;
  font-size: 12px;
}
.metadata-control,
.metadata-pill {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-height: 28px;
  padding: 4px 8px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.metadata-control select {
  max-width: 24ch;
}
.metadata-pill strong {
  font-weight: 600;
}
/* placeholder（上映前）も player-wrap と同じ高度驱动で、折叠聊天で膨胀しない。 */
.placeholder {
  flex: none;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--color-media-surface);
  color: var(--color-on-media);
}
.placeholder {
  flex: 0 0 min(56.25cqw, calc(100dvh - 260px), 820px);
  width: 100%;
  min-height: 280px;
}
.bushitsu.cinema-mode {
  background: var(--color-cinema-canvas);
}
.bushitsu.cinema-mode .stage {
  padding: 0;
  background: var(--color-cinema-canvas);
}
.bushitsu.cinema-mode .player-wrap,
.bushitsu.cinema-mode .placeholder {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
}
.bushitsu.cinema-mode .media-toolbar,
.bushitsu.cinema-mode .room-workbench,
.bushitsu.cinema-mode .mobile-chat-launcher,
.bushitsu.cinema-mode .hiraku-handle {
  display: none;
}
.bushitsu.cinema-mode :deep(.chat-panel) {
  border-left-color: var(--color-media-surface);
}
.room-workbench {
  flex: 0 0 auto;
  min-height: 120px;
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 8px;
  margin-top: 8px;
  overflow: hidden;
}
.room-control-panel,
.bangumi {
  --surface-muted: var(--color-surface-muted);
  --row-surface: var(--color-surface-raised);
  --row-border: var(--color-border);
  --row-current-border: var(--color-accent);
  --row-current-surface: var(--color-surface-muted);
  --panel-accent: var(--color-accent);
  --danger-text: var(--color-danger);
  flex: 1 1 160px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-panel);
}
.room-disclosure,
.bangumi-disclosure,
.room-control-content,
.bangumi-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.room-disclosure summary,
.bangumi-disclosure summary {
  display: none;
}
.room-control-content h3,
.bangumi-content h3 {
  flex: none;
  margin: 0;
  padding: 10px 12px;
  font-size: 20px;
  border-bottom: 1px solid var(--color-border);
}
.room-control-content :deep(.kengen-panel) {
  --kengen-muted: var(--color-text-muted);
  --kengen-text: var(--color-text);
  --kengen-accent: var(--color-accent);
  --kengen-danger: var(--color-danger);
  --kengen-separator: var(--color-border);
  --kengen-switch-on: var(--color-accent);
  --kengen-knob: var(--color-on-accent);
  flex: 1;
  align-content: flex-start;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 8px;
  overflow-y: auto;
}
.room-control-content :deep(.kengen-control-block),
.room-control-content :deep(.kengen-box) {
  width: 100%;
}
.room-control-content :deep(.kengen-switch-row) {
  width: 100%;
  text-align: left;
}
.bangumi-content ul {
  flex: 1 1 auto;
  display: block;
  padding: 8px;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}
.bangumi-management {
  display: flex;
  justify-content: flex-end;
  padding: 8px 8px 0;
}
.bangumi-feedback {
  margin: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
}
.bangumi-feedback.error {
  color: var(--danger-text);
}
.bangumi-row {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 44px;
  padding: 4px 6px;
  overflow: visible;
  border: 1px solid var(--row-border);
  border-radius: 6px;
  background: var(--row-surface);
}
.bangumi-row + .bangumi-row {
  margin-top: 6px;
}
.bangumi-row.current {
  border-color: var(--row-current-border);
  background: var(--row-current-surface);
}
.bangumi-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bangumi-meta {
  flex: 0 0 auto;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}
.source-mark {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 16px;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-provider-on-brand);
  background: var(--color-provider-brand);
  border-radius: 4px;
}
.provider-info-button {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: var(--panel-accent);
  background: transparent;
  border: 1px solid var(--row-border);
  border-radius: 999px;
}
.bangumi-status {
  flex: 0 0 auto;
  min-width: 44px;
  font-size: 12px;
  color: var(--panel-accent);
}
.bangumi-actions {
  display: flex;
  gap: 6px;
}
.bangumi-action {
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 2px 7px;
  border: 1px solid var(--row-border);
  border-radius: 4px;
  background: transparent;
}
.bangumi-action:not(:disabled):hover,
.bangumi-action:not(:disabled):focus-visible {
  border-color: var(--panel-accent);
}
.bangumi-action.danger:not(:disabled) {
  color: var(--danger-text);
}
.queue-confirm-dialog {
  width: min(420px, calc(100% - 32px));
  padding: 0;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-floating);
}
.queue-confirm-dialog::backdrop {
  background: var(--color-overlay);
}
.queue-confirm-dialog form {
  padding: var(--space-4);
}
.queue-confirm-dialog h2 {
  margin: 0;
  font-size: 18px;
}
.queue-confirm-dialog p {
  line-height: 1.5;
}
.queue-confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
.queue-confirm-actions button {
  min-width: 44px;
  min-height: 44px;
  padding: 0 var(--space-3);
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.queue-confirm-actions .danger:not(:disabled) {
  color: var(--danger-text);
}
.provider-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-overlay);
}
.provider-dialog {
  width: min(420px, 100%);
  max-height: min(680px, calc(100dvh - 48px));
  overflow-y: auto;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-floating);
}
.provider-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}
.provider-dialog header button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
}
.provider-dialog img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: var(--color-media-surface);
}
.provider-dialog h4,
.provider-dialog p,
.provider-dialog a {
  margin: 12px;
}
.provider-dialog p {
  display: flex;
  gap: 8px;
  align-items: center;
}
.provider-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 8px;
  margin: 12px;
}
.provider-stats div {
  min-width: 0;
  padding: 8px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.provider-stats dt {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--color-text-muted);
}
.provider-stats dd {
  margin: 0;
  font-weight: 700;
}
.provider-dialog a {
  display: inline-flex;
  color: var(--panel-accent);
}
/* 折叠態の展开手柄（prd #4）：右缘に細いホットゾーンを常駐させ hover を受ける。
   中の ‹ ボタンは既定 opacity:0、hover/focus でのみ浮現（color だけで状態を伝えない）。 */
.hiraku-handle {
  align-self: stretch;
  display: flex;
  align-items: center;
  width: 12px;
}
.hiraku-button {
  width: 20px;
  margin-left: -8px;
  padding: 12px 0;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.hiraku-handle:hover .hiraku-button,
.hiraku-button:focus-visible {
  opacity: 1;
}
.mobile-chat-sheet {
  display: none;
}

/* 昵称 gate: connect-time overlay, sits above the whole room until a name exists. */
.name-gate {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
}
.name-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  color: var(--color-text);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-floating);
}
.nyuushitsu-gate {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: var(--color-on-accent);
  background: var(--color-overlay-strong);
}
.nyuushitsu-gate p {
  margin: 0;
  padding: 20px 24px;
  background: var(--color-media-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
}
.nyuushitsu-gate .nyuushitsu-status {
  padding: 8px 12px;
  color: var(--color-overlay-muted);
  font-size: 13px;
  background: var(--color-overlay-surface);
}

@media (max-width: 800px) and (orientation: portrait) {
  .bushitsu {
    display: block;
    overflow-y: auto;
  }
  .stage {
    min-height: 100dvh;
    padding: 0 var(--space-3) var(--space-4);
    overflow: visible;
  }
  .player-wrap,
  .placeholder {
    flex: none;
    width: 100%;
    min-height: 0;
    height: auto;
    aspect-ratio: 16 / 9;
  }
  .room-workbench {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: auto;
    overflow: visible;
  }
  .room-control-panel,
  .bangumi {
    flex: none;
    min-height: 0;
    overflow: visible;
    background: transparent;
    border: 0;
    box-shadow: none;
  }
  .mobile-chat-launcher {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    margin-top: var(--space-2);
    color: var(--color-on-accent);
    background: var(--color-accent);
    border: 1px solid var(--color-accent-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-panel);
  }
  .room-disclosure,
  .bangumi-disclosure {
    display: block;
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-panel);
  }
  .room-disclosure summary,
  .bangumi-disclosure summary {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 var(--space-3);
    cursor: pointer;
    list-style: none;
  }
  .room-disclosure summary::-webkit-details-marker,
  .bangumi-disclosure summary::-webkit-details-marker {
    display: none;
  }
  .room-disclosure summary span,
  .bangumi-disclosure summary span {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text-muted);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .room-disclosure[open] summary,
  .bangumi-disclosure[open] summary {
    border-bottom: 1px solid var(--color-border);
  }
  .room-control-content h3,
  .bangumi-content h3 {
    display: none;
  }
  .bangumi-row {
    flex-wrap: wrap;
  }
  .bangumi-meta {
    flex-basis: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .room-control-content :deep(.kengen-panel) {
    max-height: min(58dvh, 520px);
    padding: var(--space-3) var(--space-2);
  }
  .bangumi-content ul {
    max-height: min(48dvh, 360px);
  }
  .mobile-chat-sheet[open] {
    position: fixed;
    inset: auto 0 0;
    display: block;
    width: 100%;
    height: min(60dvh, 620px);
    max-width: none;
    max-height: none;
    padding: 0;
    margin: 0;
    overflow: hidden;
    color: var(--color-text);
    background: transparent;
    border: 0;
  }
  .mobile-chat-sheet[open].is-expanded {
    height: min(90dvh, 900px);
  }
  .mobile-chat-sheet::backdrop {
    background: var(--color-overlay);
  }
  .mobile-chat-sheet-shell {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-bottom: 0;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    box-shadow: var(--shadow-floating);
  }
  .mobile-chat-sheet-shell > header {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    padding: 0 var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }
  .mobile-chat-sheet-actions {
    display: flex;
    gap: var(--space-2);
  }
  .mobile-chat-sheet-actions button {
    min-height: 36px;
    padding: 0 var(--space-2);
    color: var(--color-text);
    background: var(--color-surface-raised);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  .mobile-chat-sheet :deep(.chat-panel) {
    flex: 1;
    width: 100%;
    height: auto;
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }
}
</style>
