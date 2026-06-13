<script setup lang="ts">
import { housou } from "@/api"
import ChatPanel from "@/components/chat/ChatPanel.vue"
import DanmakuOverlay from "@/components/danmaku/DanmakuOverlay.vue"
// biome-ignore lint/style/useImportType: used as a <template> component; biome only sees the script's `typeof EnmokuPlayer` and misses the value usage.
import EnmokuPlayer from "@/components/player/EnmokuPlayer.vue"
import { useShinkou } from "@/composables/useShinkou"
import { useBushitsuStore } from "@/stores/bushitsu"
import { KousokuClient } from "@/ws/client"
import type { Enmoku } from "houkago-kousoku"
import { onBeforeUnmount, onMounted, ref } from "vue"
import { useRoute } from "vue-router"

// 放映 page: player + chat side panel. Wires the WS client to the store
// (writer) and exposes a manual direct-link enmoku for the scaffold demo.
const route = useRoute()
const bushitsu = useBushitsuStore()
const bushitsuId = String(route.params.id)

const bangumi = ref<Enmoku[]>([])
const current = ref<Enmoku | null>(null)

// scaffold: a hand-typed direct link to prove ArtPlayer playback.
const manualUrl = ref("")

// 視聴 UI 態（pure view state, not store; state-management）：
// 網全面（web fullscreen, keep chat docked）と 聊天展開（chat collapse arrow）.
const webZenmen = ref(false)
const chatHiraku = ref(true)

let client: KousokuClient | null = null

// 進行制御: routes player events → SHINKOU (host) and remote SHINKOU/GENJOU →
// player (部員). The controller gates by role + 追従中; this view just connects.
const playerRef = ref<InstanceType<typeof EnmokuPlayer> | null>(null)
const shinkou = useShinkou((msg) => client?.send(msg), playerRef)

function playManual() {
  if (!manualUrl.value) return
  const isHls = manualUrl.value.endsWith(".m3u8")
  current.value = {
    id: "manual",
    bushitsuId,
    title: "手填直链",
    type: isHls ? "hls" : "direct",
    url: manualUrl.value,
    addedBy: bushitsu.senderId,
  }
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
  const base = import.meta.env.VITE_HOUSOU_URL ?? "http://localhost:3000"
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
          @shinkou="shinkou.onLocalShinkou"
          @ready="shinkou.catchUp"
        />
        <DanmakuOverlay />
      </div>
      <div v-else class="placeholder">
        <input v-model="manualUrl" aria-label="直链 URL" placeholder="m3u8 / mp4 直链" />
        <button type="button" @click="playManual">再生</button>
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
/* player + overlay share one positioned wrapper so the overlay covers the player */
.player-wrap {
  position: relative;
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
.bushitsu.web-zenmen .player-wrap {
  flex: 1;
  min-height: 0;
}
.bushitsu.web-zenmen .bangumi {
  display: none;
}
</style>
