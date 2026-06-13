<script setup lang="ts">
import { housou } from "@/api"
import ChatPanel from "@/components/chat/ChatPanel.vue"
import EnmokuPlayer from "@/components/player/EnmokuPlayer.vue"
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

let client: KousokuClient | null = null

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
  client = new KousokuClient(base, (msg) => bushitsu.apply(msg))
  client.connect(bushitsuId, bushitsu.senderId || "anon")

  const { data } = await housou.bushitsu({ id: bushitsuId }).bangumi.get()
  if (data) bangumi.value = data
})

onBeforeUnmount(() => {
  client?.close()
})
</script>

<template>
  <div class="bushitsu">
    <main class="stage">
      <EnmokuPlayer v-if="current" :key="current.url" :url="current.url" :type="current.type" />
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
    <ChatPanel @oshaberi="oshaberi" />
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
.placeholder {
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #111;
  color: #fff;
}
</style>
