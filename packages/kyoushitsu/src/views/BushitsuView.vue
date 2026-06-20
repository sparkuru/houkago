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
import { canDeleteBangumiItem, canPlayBangumiItem, isCurrentEnmoku } from "@/lib/bangumi-actions"
import { resolveEnmoku } from "@/lib/enmoku-resolve"
import { loadFileDanmakuEnabled, saveFileDanmakuEnabled } from "@/lib/file-danmaku-pref"
import { housouUrl } from "@/lib/housou-url"
import { showJoinGate } from "@/lib/join-gate"
import { useBushitsuStore } from "@/stores/bushitsu"
import { KousokuClient } from "@/ws/client"
import { type DanmakuCue, parseBilibiliXml } from "houkago-kokuban"
import type { Enmoku, Kengen, NyuushitsuMode } from "houkago-kousoku"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"

// 放映 page: player + chat side panel. Wires the WS client to the store
// (writer) and exposes a manual direct-link enmoku for the scaffold demo.
const route = useRoute()
const bushitsu = useBushitsuStore()
const bushitsuId = String(route.params.id)

const current = ref<Enmoku | null>(null)
const currentEnmokuId = computed(() => current.value?.id ?? null)

// scaffold: a hand-typed direct link to prove ArtPlayer playback.
// 开发期默认值，上线前清除。
const manualUrl = ref("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")

// 視聴 UI 態（pure view state, not store; state-management）：
// 網全面（web fullscreen, keep chat docked）と 聊天展開（chat collapse arrow）.
const webZenmen = ref(false)
const chatHiraku = ref(true)

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

// ArtPlayer の $player を弹幕 overlay の Teleport target に。EnmokuPlayer mount 后
// 才有值，computed 在其可用后更新，Teleport 自动迁移到全屏子树。
const playerEl = computed<HTMLElement | null>(() => playerRef.value?.playerEl ?? null)

// コントロール条の显隐：EnmokuPlayer の @control（emit）を自有 ref で受け、
// DanmakuOverlay へ prop で下す（prd Bug1）。暴露 ref→親 computed の脆い連鎖を
// 避け、原生全屏含む三態で確実に響応させる。pure view 態 → store 不要。
const controlsShown = ref(true)
const playbackTime = ref(0)
const playbackPlaying = ref(false)
// 演目切替（current 変更）で player が再 mount され control 発火前は条あり扱いに
// 復位させる。EnmokuPlayer 卸載は control を停発するので親側で戻す。
watch(current, () => {
  controlsShown.value = true
  playbackTime.value = 0
  playbackPlaying.value = false
})

const fileInput = ref<HTMLInputElement | null>(null)
const fileDanmakuEnabled = ref(loadFileDanmakuEnabled())
const fileDanmakuByEnmoku = ref<Record<string, DanmakuCue[]>>({})
const fileDanmakuNameByEnmoku = ref<Record<string, string>>({})
const manualSubmitting = ref(false)

const currentFileDanmaku = computed(() => {
  const id = currentEnmokuId.value
  return id ? (fileDanmakuByEnmoku.value[id] ?? []) : []
})
const currentFileDanmakuName = computed(() => {
  const id = currentEnmokuId.value
  return id ? (fileDanmakuNameByEnmoku.value[id] ?? "") : ""
})

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

function nyuushitsuSettei(mode: NyuushitsuMode) {
  client?.send({
    type: "NYUUSHITSU_SETTEI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { mode },
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

function sendJouei(enmokuId: string) {
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
      title: t("manualEnmokuTitle"),
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

async function deleteBangumiEnmoku(enmokuId: string) {
  if (!canDeleteBangumiItem(bushitsu.canPlaylist, enmokuId, currentEnmokuId.value)) return
  const { data } = await housou.bushitsu({ id: bushitsuId }).enmoku({ enmokuId }).delete()
  if (!data) return
  bushitsu.setBangumi(bushitsu.bangumi.filter((e) => e.id !== enmokuId))
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
}

function oshaberi(content: string) {
  client?.send({
    type: "OSHABERI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { content },
  })
}

function danmaku(content: string) {
  client?.send({
    type: "DANMAKU",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { content },
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
  if (room) bushitsu.buchouId = room.buchouId

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
  client = new KousokuClient(base, (msg) => {
    bushitsu.apply(msg) // keep the store the single source of truth first
    if (msg.type === "NYUUSHITSU" && msg.payload.status === "entered") {
      void enterRoom()
    }
    shinkou.handleRemote(msg) // then drive the player by message type
  })
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
  <div class="bushitsu" :class="{ 'web-zenmen': webZenmen }">
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
    </div>
    <template v-else>
      <main class="stage">
        <div class="bar">
          <div v-if="current" class="file-danmaku-controls">
            <button
              type="button"
              :aria-label="t('fileDanmakuToggleAria')"
              :aria-pressed="fileDanmakuEnabled"
              @click="toggleFileDanmaku"
            >
              {{ fileDanmakuEnabled ? t("fileDanmakuOn") : t("fileDanmakuOff") }}
            </button>
            <button type="button" @click="chooseFileDanmaku">
              {{ t("fileDanmakuChoose") }}
            </button>
            <input
              ref="fileInput"
              class="file-danmaku-input"
              type="file"
              accept=".xml,text/xml,application/xml"
              :aria-label="t('fileDanmakuChoose')"
              @change="onFileDanmakuSelected"
            />
            <span class="file-danmaku-name">
              {{ currentFileDanmakuName || t("fileDanmakuNone") }}
            </span>
          </div>
          <KengenPanel
            v-if="bushitsu.isBuchou"
            @settei="settei"
            @nyuushitsu-settei="nyuushitsuSettei"
            @nyuushitsu-hantei="nyuushitsuHantei"
          />
          <button
            type="button"
            :aria-label="webZenmen ? t('webZenmenExitAria') : t('webZenmenAria')"
            :aria-pressed="webZenmen"
            @click="webZenmen = !webZenmen"
          >
            {{ webZenmen ? t("webZenmenExit") : t("webZenmen") }}
          </button>
        </div>
        <div v-if="current" class="player-wrap">
          <EnmokuPlayer
            ref="playerRef"
            :key="current.url"
            :url="current.url"
            :type="current.type"
            :show-join-gate="showJoinGate(bushitsu.isBuchou, joined)"
            :control-locked="!bushitsu.canControl"
            @shinkou="shinkou.onLocalShinkou"
            @ready="shinkou.catchUp"
            @join="onJoin"
            @control="controlsShown = $event"
            @time="playbackTime = $event"
            @playing="playbackPlaying = $event"
          />
          <FileDanmakuOverlay
            :target="playerEl"
            :cues="currentFileDanmaku"
            :current-time="playbackTime"
            :enabled="fileDanmakuEnabled"
            :playing="playbackPlaying"
          />
          <DanmakuOverlay :target="playerEl" :controls-shown="controlsShown" />
        </div>
        <div v-else class="placeholder">
          <span>{{ t("waitingBuchouJouei") }}</span>
        </div>
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
              <span class="bangumi-title">{{ e.title }}</span>
              <span v-if="isCurrentEnmoku(e.id, currentEnmokuId)" class="bangumi-status">
                {{ t("joueiChuu") }}
              </span>
              <span v-if="bushitsu.canPlaylist" class="bangumi-actions">
                <button
                  type="button"
                  class="bangumi-action"
                  :disabled="!canPlayBangumiItem(bushitsu.canPlaylist)"
                  @click="playBangumi(e.id)"
                >
                  {{ t("play") }}
                </button>
                <button
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
      </main>
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
        @oshaberi="oshaberi"
        @danmaku="danmaku"
        @toggle="chatHiraku = false"
      />
    </template>
  </div>
</template>

<style scoped>
.bushitsu {
  display: flex;
  height: 100vh;
}
.stage {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.file-danmaku-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-right: auto;
}
.file-danmaku-input {
  display: none;
}
.file-danmaku-name {
  max-width: 28ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #444;
}
/* player + overlay share one positioned wrapper so the overlay covers the player. */
.player-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}
/* 普通模式：stage 为 flex column，player-wrap 占 bar 与 bangumi 之间的剩余高度
   （flex:1 + min-height:0），16:9 由该高度推导 width → 与 stage 宽度/聊天显隐无关，
   折叠聊天后不膨胀；margin-inline:auto 居中，多余横向空间留白。max-width:100% 防止
   窄高窗口下推导 width 溢出（此时退化为宽度驱动，仍合理）。仅作用普通模式：
   margin-inline:auto 会取消 flex 的默认 stretch，若漏到 web-zenmen 会令空 wrap 收成
   0 宽，故用 :not(.web-zenmen) 隔离。 */
.bushitsu:not(.web-zenmen) .player-wrap {
  aspect-ratio: 16 / 9;
  max-width: 100%;
  margin-inline: auto;
}
.player-wrap :deep(.enmoku-player) {
  height: 100%;
}
/* placeholder（上映前）も player-wrap と同じ高度驱动で、折叠聊天で膨胀しない。 */
.placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #111;
  color: #fff;
}
.bushitsu:not(.web-zenmen) .placeholder {
  aspect-ratio: 16 / 9;
  max-width: 100%;
  margin-inline: auto;
}
/* 普通模式：番組表は player の下に固定高で居座り、player の高度推导を侵さない。
   長くなれば自前スクロール。web-zenmen では display:none で隐す（既存）。 */
.bushitsu:not(.web-zenmen) .bangumi {
  flex: none;
  max-height: 30vh;
  overflow-y: auto;
  margin-top: 8px;
}
.bangumi ul {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.bangumi-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  background: #fff;
}
.bangumi-row.current {
  border-color: #222;
  background: #f7f7f7;
}
.bangumi-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bangumi-status {
  font-size: 12px;
  color: #222;
}
.dev-manual {
  display: grid;
  grid-template-columns: auto minmax(180px, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
}
.dev-manual h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.dev-manual input {
  min-width: 0;
}
.bangumi-actions {
  display: flex;
  gap: 6px;
}
.bangumi-action {
  min-width: 48px;
  min-height: 28px;
  padding: 3px 8px;
}
.bangumi-action.danger:not(:disabled) {
  color: #8a1f1f;
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
.hiraku-handle:hover .hiraku-button,
.hiraku-button:focus-visible {
  opacity: 1;
}

/* ウェブ全画面: layout-level full viewport that KEEPS the chat docked right
   (synctv-web lacks this). ArtPlayer auto-fits the resized container. */
.bushitsu.web-zenmen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #000;
}
/* 网页全屏：取消固定比例，填满左列高度；ArtPlayer 内部 contain 上下黑边居中，
   无下方黑占位（B 站直播间式整块播放器） */
.bushitsu.web-zenmen .player-wrap {
  flex: 1;
  min-height: 0;
  aspect-ratio: auto;
}
.bushitsu.web-zenmen .bangumi {
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
</style>
