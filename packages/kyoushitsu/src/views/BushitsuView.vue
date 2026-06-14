<script setup lang="ts">
import { housou } from "@/api"
import ChatPanel from "@/components/chat/ChatPanel.vue"
import DanmakuOverlay from "@/components/danmaku/DanmakuOverlay.vue"
// biome-ignore lint/style/useImportType: used as a <template> component; biome only sees the script's `typeof EnmokuPlayer` and misses the value usage.
import EnmokuPlayer from "@/components/player/EnmokuPlayer.vue"
import { useShinkou } from "@/composables/useShinkou"
import { resolveEnmoku } from "@/lib/enmoku-resolve"
import { housouUrl } from "@/lib/housou-url"
import { useBushitsuStore } from "@/stores/bushitsu"
import { KousokuClient } from "@/ws/client"
import type { Enmoku } from "houkago-kousoku"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useRoute } from "vue-router"

// 放映 page: player + chat side panel. Wires the WS client to the store
// (writer) and exposes a manual direct-link enmoku for the scaffold demo.
const route = useRoute()
const bushitsu = useBushitsuStore()
const bushitsuId = String(route.params.id)

const bangumi = ref<Enmoku[]>([])
const current = ref<Enmoku | null>(null)

// scaffold: a hand-typed direct link to prove ArtPlayer playback.
// 开发期默认值，上线前清除。
const manualUrl = ref("https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8")

// 視聴 UI 態（pure view state, not store; state-management）：
// 網全面（web fullscreen, keep chat docked）と 聊天展開（chat collapse arrow）.
const webZenmen = ref(false)
const chatHiraku = ref(true)

let client: KousokuClient | null = null

// 進行制御: routes player events → SHINKOU (host) and remote SHINKOU/GENJOU →
// player (部員). The controller gates by role + 追従中; this view just connects.
const playerRef = ref<InstanceType<typeof EnmokuPlayer> | null>(null)
const shinkou = useShinkou((msg) => client?.send(msg), playerRef)

// ArtPlayer の $player を弹幕 overlay の Teleport target に。EnmokuPlayer mount 后
// 才有值，computed 在其可用后更新，Teleport 自动迁移到全屏子树。
const playerEl = computed<HTMLElement | null>(() => playerRef.value?.playerEl ?? null)

// 房主放映：register the source as a room 演目 (real enmokuId), refresh the local
// 番組表, then broadcast JOUEI(enmokuId). The host does not set `current` directly
// — the JOUEI echo flows back through the store.enmokuId watch like any 部員, so
// host and members share one resolve→play path (state-management: WS is writer).
async function playManual() {
  if (!manualUrl.value || !bushitsu.isBuchou) return
  const isHls = manualUrl.value.endsWith(".m3u8")
  const { data: enmoku } = await housou.bushitsu({ id: bushitsuId }).enmoku.post({
    title: "手填直链",
    type: isHls ? "hls" : "direct",
    url: manualUrl.value,
    addedBy: bushitsu.senderId,
  })
  if (!enmoku) return
  bangumi.value = [...bangumi.value, enmoku]
  client?.send({
    type: "JOUEI",
    ts: Date.now(),
    senderId: bushitsu.senderId,
    payload: { enmokuId: enmoku.id },
  })
}

// 上映中の解決：apply the authoritative enmokuId by resolving it to the room's
// Enmoku and setting `current`. If the local 番組表 lacks it (late joiner, or a
// source another client registered), re-fetch the 番組表 once and resolve again.
async function applyEnmokuId(enmokuId: string | null) {
  if (!enmokuId) {
    current.value = null
    return
  }
  let enmoku = resolveEnmoku(bangumi.value, enmokuId)
  if (!enmoku) {
    const { data } = await housou.bushitsu({ id: bushitsuId }).bangumi.get()
    if (data) bangumi.value = data
    enmoku = resolveEnmoku(bangumi.value, enmokuId)
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

onMounted(async () => {
  bushitsu.bushitsuId = bushitsuId
  const base = housouUrl()
  client = new KousokuClient(base, (msg) => {
    bushitsu.apply(msg) // keep the store the single source of truth first
    shinkou.handleRemote(msg) // then drive the player by message type
  })
  client.connect(bushitsuId, bushitsu.senderId)

  // Learn who the 部長 is so isBuchou is known before we decide to follow.
  const { data: room } = await housou.bushitsu({ id: bushitsuId }).get()
  if (room) bushitsu.buchouId = room.buchouId

  // 追いかけ: a 部員 asks for authority state to catch up; the host drives, so it
  // does not follow and does not ask.
  if (!bushitsu.isBuchou) {
    client.send({ type: "OIKAKE", ts: Date.now(), senderId: bushitsu.senderId, payload: {} })
  }

  const { data } = await housou.bushitsu({ id: bushitsuId }).bangumi.get()
  if (data) bangumi.value = data

  // store.enmokuId is the single source of truth for 上映中, written by the WS
  // client from JOUEI (host pick / echo) and GENJOU (late-joiner catch-up).
  // Watching it gives host + 部員 + late joiners one resolve→play path.
  // immediate covers the case where GENJOU已 set enmokuId before this mounts.
  watch(() => bushitsu.enmokuId, applyEnmokuId, { immediate: true })
})

onBeforeUnmount(() => {
  client?.close()
})
</script>

<template>
  <div class="bushitsu" :class="{ 'web-zenmen': webZenmen }">
    <main class="stage">
      <div class="bar">
        <button
          type="button"
          :aria-label="webZenmen ? 'ウェブ全画面を解除' : 'ウェブ全画面'"
          :aria-pressed="webZenmen"
          @click="webZenmen = !webZenmen"
        >
          {{ webZenmen ? "全画面解除" : "ウェブ全画面" }}
        </button>
      </div>
      <div v-if="current" class="player-wrap">
        <EnmokuPlayer
          ref="playerRef"
          :key="current.url"
          :url="current.url"
          :type="current.type"
          :muted="!bushitsu.isBuchou"
          @shinkou="shinkou.onLocalShinkou"
          @ready="shinkou.catchUp"
        />
        <DanmakuOverlay :target="playerEl" />
      </div>
      <div v-else class="placeholder">
        <template v-if="bushitsu.isBuchou">
          <input v-model="manualUrl" aria-label="直链 URL" placeholder="m3u8 / mp4 直链" />
          <button type="button" @click="playManual">再生</button>
        </template>
        <span v-else>部長の放映を待っています…</span>
      </div>
      <section class="bangumi">
        <h3>番組表</h3>
        <ul>
          <li v-for="e in bangumi" :key="e.id">{{ e.title }}</li>
        </ul>
      </section>
    </main>
    <button
      type="button"
      class="chat-toggle"
      :aria-label="chatHiraku ? '聊天室を畳む' : '聊天室を開く'"
      :aria-expanded="chatHiraku"
      @click="chatHiraku = !chatHiraku"
    >
      {{ chatHiraku ? "›" : "‹" }}
    </button>
    <ChatPanel v-show="chatHiraku" @oshaberi="oshaberi" />
  </div>
</template>

<style scoped>
.bushitsu {
  display: flex;
  height: 100vh;
}
.stage {
  flex: 1;
  padding: 12px;
}
.bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
/* player + overlay share one positioned wrapper so the overlay covers the player.
   普通模式下 wrap 定 16:9 盒，播放器填满它 */
.player-wrap {
  position: relative;
  aspect-ratio: 16 / 9;
}
.player-wrap :deep(.enmoku-player) {
  height: 100%;
}
.placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #111;
  color: #fff;
}
/* collapse arrow sits between stage and chat; always reachable */
.chat-toggle {
  align-self: center;
  width: 20px;
  padding: 12px 0;
  border: 1px solid #ddd;
  border-right: none;
  background: #f5f5f5;
  cursor: pointer;
}

/* ウェブ全画面: layout-level full viewport that KEEPS the chat docked right
   (synctv-web lacks this). ArtPlayer auto-fits the resized container. */
.bushitsu.web-zenmen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #000;
}
.bushitsu.web-zenmen .stage {
  display: flex;
  flex-direction: column;
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
</style>
