<script setup lang="ts">
import { housou } from "@/api"
import ChatPanel from "@/components/chat/ChatPanel.vue"
import DanmakuOverlay from "@/components/danmaku/DanmakuOverlay.vue"
import FileDanmakuOverlay from "@/components/danmaku/FileDanmakuOverlay.vue"
import KengenPanel from "@/components/kengen/KengenPanel.vue"
// biome-ignore lint/style/useImportType: used as a <template> component; biome only sees the script's `typeof EnmokuPlayer` and misses the value usage.
import EnmokuPlayer from "@/components/player/EnmokuPlayer.vue"
import { useShinkou } from "@/composables/useShinkou"
import { t } from "@/i18n"
import {
  canCancelBangumiItem,
  canDeleteBangumiItem,
  canPlayBangumiItem,
  isCurrentEnmoku,
} from "@/lib/bangumi-actions"
import { type ChatTheme, loadChatTheme, saveChatTheme } from "@/lib/chat-theme"
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
import { KousokuClient, type KousokuConnectionStatus } from "@/ws/client"
import { type DanmakuCue, parseBilibiliXml } from "houkago-kokuban"
import type { Enmoku, Kengen, NyuushitsuMode } from "houkago-kousoku"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"

// 放映 page: player + chat side panel. Wires the WS client to the store
// (writer) and exposes a manual direct-link enmoku for the scaffold demo.
const route = useRoute()
const bushitsu = useBushitsuStore()
const bushitsuId = String(route.params.id)
const roomName = ref("")
const roomLink = computed(() => (typeof location === "undefined" ? bushitsuId : location.href))

const current = ref<Enmoku | null>(null)
const currentEnmokuId = computed(() => current.value?.id ?? null)
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

// scaffold: a hand-typed direct link to prove ArtPlayer playback.
// 开发期默认值，上线前清除。
const manualUrl = ref("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")

// 視聴 UI 態（pure view state, not store; state-management）：聊天展開（chat collapse arrow）
// と聊天室模式（左播放器 + 右聊天，全屏式房间布局；不改变 ArtPlayer 原生网页全屏）。
const chatHiraku = ref(true)
const cinemaMode = ref(false)
const chatTheme = ref<ChatTheme>(loadChatTheme())
const wsStatus = ref<KousokuConnectionStatus>("closed")
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
  if (cinemaMode.value) chatHiraku.value = true
}

function collapseChat() {
  chatHiraku.value = false
  cinemaMode.value = false
}

function setChatTheme(theme: ChatTheme) {
  chatTheme.value = theme
  saveChatTheme(theme)
}

function reconnectKousoku() {
  client?.connect(bushitsuId, bushitsu.senderId, bushitsu.nickname)
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
const manualSubmitting = ref(false)
const providerInfoEnmoku = ref<Enmoku | null>(null)
let fetchedDanmakuRequest = 0

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
  client?.send({ type: "SETTEI", ts: Date.now(), senderId: bushitsu.senderId, payload: kengen })
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

function sendJouei(enmokuId: string | null) {
  if (!canPlayBangumiItem(bushitsu.canPlaylist)) return
  client?.send({
    type: "JOUEI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { enmokuId },
  })
}

async function playManual() {
  const url = manualUrl.value.trim()
  if (!url || !bushitsu.canPlaylist || manualSubmitting.value) return
  manualSubmitting.value = true
  try {
    const { data: enmoku } = await housou.bushitsu({ id: bushitsuId }).enmoku.post({
      sourceUrl: url,
      addedBy: bushitsu.senderId,
    })
    if (enmoku) sendJouei(enmoku.id)
  } finally {
    manualSubmitting.value = false
  }
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
  const { data } = await housou.bushitsu({ id: bushitsuId }).enmoku({ enmokuId }).delete()
  if (!data) return
  bushitsu.setBangumi(bushitsu.bangumi.filter((e) => e.id !== enmokuId))
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
  // Learn who the 部長 is so isBuchou is known before we decide to follow.
  const { data: room } = await housou.bushitsu({ id: bushitsuId }).get()
  if (room) {
    bushitsu.buchouId = room.buchouId
    roomName.value = room.name
  }

  // 追いかけ: a 部員 asks for authority state to catch up; the host drives, so it
  // does not follow and does not ask.
  if (!bushitsu.isBuchou) {
    client.send({ type: "OIKAKE", ts: Date.now(), senderId: bushitsu.senderId, payload: {} })
  }

  const { data } = await housou.bushitsu({ id: bushitsuId }).bangumi.get()
  if (data) bushitsu.setBangumi(data)

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
      if (msg.type === "NYUUSHITSU" && msg.payload.status === "entered") {
        void enterRoom()
      }
      shinkou.handleRemote(msg) // then drive the player by message type
    },
    (status) => {
      wsStatus.value = status
      if (status === "connecting") {
        bootstrapped.value = false
      }
    },
  )
  client.connect(bushitsuId, bushitsu.senderId, bushitsu.nickname)
}

onMounted(() => {
  bushitsu.bushitsuId = bushitsuId
  if (bushitsu.nickname) {
    startSession()
  } else {
    nameGate.value = true
  }
})

onBeforeUnmount(() => {
  stopEnmokuWatch?.()
  client?.close()
})
</script>

<template>
  <div class="bushitsu" :class="{ 'cinema-mode': cinemaMode, 'theme-dark': chatTheme === 'dark' }">
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
        <div class="room-workbench">
          <aside class="room-control-panel">
            <h3>{{ bushitsu.isBuchou ? t("roomControlHeading") : t("roomInfoHeading") }}</h3>
            <KengenPanel
              :room-name="roomName || bushitsuId"
              :room-link="roomLink"
              :room-status="wsStatus"
              @settei="settei"
              @nyuushitsu-settei="nyuushitsuSettei"
              @nyuushitsu-hantei="nyuushitsuHantei"
              @reconnect="reconnectKousoku"
            />
          </aside>
          <section class="bangumi">
            <h3>{{ t("bangumiHeading") }}</h3>
            <ul>
              <li
                v-for="e in bushitsu.bangumi"
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
                </span>
              </li>
            </ul>
            <form v-if="bushitsu.canPlaylist" class="dev-manual" @submit.prevent="playManual">
              <h4>{{ t("devManualHeading") }}</h4>
              <input
                v-model="manualUrl"
                :aria-label="t('manualUrlLabel')"
                :placeholder="t('manualUrlPlaceholder')"
              />
              <button type="submit" :disabled="manualSubmitting || !manualUrl.trim()">
                {{ t("play") }}
              </button>
            </form>
          </section>
        </div>
      </main>
      <div
        v-if="providerInfoEnmoku && providerInfo"
        class="provider-dialog-backdrop"
        @click.self="closeProviderInfo"
      >
        <section class="provider-dialog" role="dialog" :aria-label="t('providerInfoAria')">
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
      <!-- 折叠態の展开手柄（prd #4）：右缘の常駐ホットゾーンが hover/focus を受け、
         中の ‹ ボタンを浮現させる。既定は不可视（opacity:0）、keyboard でも focus で
         浮現し可達。展开中は v-if で消す（header 内の › で畳む）。 -->
      <div v-if="!chatHiraku" class="hiraku-handle">
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
        v-show="chatHiraku"
        :chat-theme="chatTheme"
        @oshaberi="oshaberi"
        @danmaku="danmaku"
        @chat-theme="setChatTheme"
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
  background: #fff;
  color: #222;
}
.bushitsu.theme-dark {
  background: #0f0f0f;
  color: #eee;
}
.stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  padding: 0 12px 0 12px;
  overflow: hidden;
}
.theme-dark .stage {
  background: #0f0f0f;
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
/* 普通模式：播放器吃满舞台宽度，但高度按 16:9 倾向计算，并给下方面板留保底。
   宽屏/全屏窗口下会优先增高播放器，减少左右黑边；番組表自滚动，不反压播放器。 */
.player-wrap {
  flex: 0 1 min(56.25cqw, calc(100dvh - 260px), 820px);
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
  background: #fbfbfb;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
}
.theme-dark .media-toolbar {
  background: #151515;
  border-color: #2a2a2a;
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
  background: #f7f7f7;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
}
.theme-dark .metadata-control,
.theme-dark .metadata-pill {
  background: #1d1d1d;
  border-color: #333;
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
  background: #111;
  color: #fff;
}
.placeholder {
  flex: 0 1 min(56.25cqw, calc(100dvh - 260px), 820px);
  width: 100%;
  min-height: 280px;
}
.bushitsu.cinema-mode {
  background: #000;
}
.bushitsu.cinema-mode .stage {
  padding: 0;
  background: #000;
}
.bushitsu.cinema-mode .player-wrap,
.bushitsu.cinema-mode .placeholder {
  flex: 1 1 auto;
  height: auto;
  min-height: 0;
}
.bushitsu.cinema-mode .media-toolbar,
.bushitsu.cinema-mode .room-workbench,
.bushitsu.cinema-mode .hiraku-handle {
  display: none;
}
.bushitsu.cinema-mode :deep(.chat-panel) {
  border-left-color: #222;
}
.room-workbench {
  flex: 1 1 220px;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 8px;
  margin-top: 8px;
  overflow: hidden;
}
.room-control-panel,
.bangumi {
  --surface-muted: #f7f7f7;
  --row-surface: #fff;
  --row-border: #e5e5e5;
  --row-current-border: #222;
  --row-current-surface: #f7f7f7;
  --panel-accent: #2a7;
  --danger-text: #8a1f1f;
  flex: 1 1 160px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
}
.theme-dark .room-control-panel,
.theme-dark .bangumi {
  --surface-muted: #0b0b0b;
  --row-surface: #151515;
  --row-border: #303030;
  --row-current-border: #ff7a22;
  --row-current-surface: #1b130e;
  --panel-accent: #ff8a3d;
  --danger-text: #ff8a8a;
  background: #141414;
  border-color: #2a2a2a;
}
.room-control-panel h3,
.bangumi h3 {
  flex: none;
  margin: 0;
  padding: 10px 12px;
  font-size: 20px;
  border-bottom: 1px solid #e5e5e5;
}
.theme-dark .room-control-panel h3,
.theme-dark .bangumi h3 {
  border-bottom-color: #2a2a2a;
}
.theme-dark .room-control-panel h3 {
  margin: 0;
  border: 0;
  border-bottom: 1px solid #2a2a2a;
  box-shadow: none;
}
.room-control-panel :deep(.kengen-panel) {
  flex: 1;
  align-content: flex-start;
  align-items: stretch;
  width: 100%;
  box-sizing: border-box;
  padding: 12px 8px;
  overflow-y: auto;
}
.room-control-panel :deep(.kengen-control-block),
.room-control-panel :deep(.kengen-box) {
  width: 100%;
}
.room-control-panel :deep(.kengen-switch-row) {
  width: 100%;
  text-align: left;
}
.theme-dark .room-control-panel :deep(.kengen-panel) {
  --kengen-muted: #b8b8b8;
  --kengen-text: #f1f1f1;
  --kengen-accent: #ff8a3d;
  --kengen-danger: #ff7474;
  --kengen-separator: #ff7a22;
  --kengen-switch-off: #0b0b0b;
  --kengen-switch-on: #ff8a3d;
  --kengen-knob: #fff;
}
.theme-dark .room-control-panel :deep(.kengen-section-title),
.theme-dark .room-control-panel :deep(.kengen-state-text),
.theme-dark .room-control-panel :deep(.room-info-key),
.theme-dark .room-control-panel :deep(.room-info-value),
.theme-dark .room-control-panel :deep(.nyuushitsu-mode-desc) {
  color: #b8b8b8;
}
.theme-dark .room-control-panel :deep(.kengen-switch-row),
.theme-dark .room-control-panel :deep(.nyuushitsu-option) {
  color: #f1f1f1;
  background: transparent;
  border: 0;
}
.bangumi ul {
  flex: 1 1 auto;
  display: block;
  padding: 8px;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}
.bangumi-row {
  display: flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 4px 6px;
  overflow: hidden;
  border: 1px solid var(--row-border);
  border-radius: 6px;
  background: var(--row-surface);
}
.bangumi-row + .bangumi-row {
  margin-top: 6px;
}
.theme-dark .bangumi-row {
  background: var(--row-surface);
  border-color: var(--row-border);
}
.bangumi-row.current {
  border-color: var(--row-current-border);
  background: var(--row-current-surface);
}
.theme-dark .bangumi-row.current {
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
  color: #fff;
  background: #00a1d6;
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
.theme-dark .bangumi-status {
  color: var(--panel-accent);
}
.dev-manual {
  flex: none;
  display: grid;
  grid-template-columns: auto minmax(180px, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-top: 1px solid var(--row-border);
  background: var(--surface-muted);
}
.theme-dark .dev-manual {
  border-top-color: var(--row-border);
}
.dev-manual h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.dev-manual input {
  min-width: 0;
  min-height: 28px;
  border: 1px solid var(--row-border);
  border-radius: 4px;
}
.theme-dark input,
.theme-dark textarea,
.theme-dark select {
  color: #eee;
  background: #181818;
  border-color: #444;
}
.theme-dark .bangumi input {
  color: #eee;
  background: #0b0b0b;
  border-color: var(--row-border);
}
.bangumi-actions {
  display: flex;
  gap: 6px;
}
.bangumi-action {
  flex: 0 0 auto;
  min-width: 48px;
  min-height: 24px;
  padding: 2px 7px;
  border: 1px solid var(--row-border);
  border-radius: 4px;
  background: transparent;
}
.bangumi-action:not(:disabled):hover,
.bangumi-action:not(:disabled):focus-visible,
.dev-manual button:not(:disabled):hover,
.dev-manual button:not(:disabled):focus-visible {
  border-color: var(--panel-accent);
}
.theme-dark button {
  color: #eee;
  background: #1d1d1d;
  border-color: #555;
}
.theme-dark .bangumi button {
  color: #eee;
  background: #0b0b0b;
  border-color: var(--row-border);
}
.theme-dark .bangumi button:not(:disabled):hover,
.theme-dark .bangumi button:not(:disabled):focus-visible {
  border-color: var(--panel-accent);
}
.theme-dark button:disabled {
  color: #777;
}
.bangumi-action.danger:not(:disabled) {
  color: var(--danger-text);
}
.theme-dark .bangumi-action.danger:not(:disabled) {
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
  background: rgba(0, 0, 0, 0.6);
}
.provider-dialog {
  width: min(420px, 100%);
  max-height: min(680px, calc(100dvh - 48px));
  overflow-y: auto;
  color: #222;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}
.theme-dark .provider-dialog {
  color: #eee;
  background: #151515;
  border-color: #333;
}
.provider-dialog header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e5e5;
}
.theme-dark .provider-dialog header {
  border-bottom-color: #333;
}
.provider-dialog header button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: transparent;
}
.provider-dialog img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: #111;
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
  background: #f7f7f7;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
}
.theme-dark .provider-stats div {
  background: #1d1d1d;
  border-color: #333;
}
.provider-stats dt {
  margin: 0 0 4px;
  font-size: 12px;
  color: #666;
}
.theme-dark .provider-stats dt {
  color: #aaa;
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
  color: #222;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-right: none;
  border-radius: 4px 0 0 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.theme-dark .hiraku-button {
  color: #eee;
  background: #1d1d1d;
  border-color: #333;
}
.hiraku-handle:hover .hiraku-button,
.hiraku-button:focus-visible {
  opacity: 1;
}

/* 昵称 gate: connect-time overlay, sits above the whole room until a name exists. */
.name-gate {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}
.name-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
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
  color: #fff;
  background: rgba(0, 0, 0, 0.72);
}
.nyuushitsu-gate p {
  margin: 0;
  padding: 20px 24px;
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
}
.nyuushitsu-gate .nyuushitsu-status {
  padding: 8px 12px;
  color: #ccc;
  font-size: 13px;
  background: rgba(17, 17, 17, 0.8);
}
</style>
