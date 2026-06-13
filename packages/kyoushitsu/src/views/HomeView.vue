<script setup lang="ts">
import { housou } from "@/api"
import { buinId } from "@/lib/identity"
import { useBushitsuStore } from "@/stores/bushitsu"
import { ref } from "vue"
import { useRouter } from "vue-router"

// 進房 UI placeholder: nickname + room id → create or enter → 放映 page.
const router = useRouter()
const bushitsu = useBushitsuStore()

const nickname = ref("")
const roomId = ref("")
const newRoomName = ref("")
const error = ref("")

function enter(bushitsuId: string) {
  bushitsu.nickname = nickname.value
  bushitsu.bushitsuId = bushitsuId
  router.push({ name: "bushitsu", params: { id: bushitsuId } })
}

// 部室を作る then enter as 部長. The room's buchouId must be this browser's stable
// buinId (= the WS senderId), or host-authority never matches (design §5).
async function create() {
  error.value = ""
  if (!nickname.value) return
  const { data, error: err } = await housou.bushitsu.post({
    name: newRoomName.value || "新部室",
    buchouId: buinId(),
  })
  if (err || !data) {
    error.value = "部室作成に失敗しました"
    return
  }
  enter(data.id)
}

// 入部：enter an existing room by id.
function join() {
  error.value = ""
  if (!nickname.value || !roomId.value) return
  enter(roomId.value)
}
</script>

<template>
  <main class="home">
    <h1>放課後 / Houkago</h1>
    <label>
      ニックネーム
      <input v-model="nickname" aria-label="ニックネーム" />
    </label>

    <section>
      <h2>部室を作る</h2>
      <input v-model="newRoomName" aria-label="部室名" placeholder="部室名" />
      <button type="button" :disabled="!nickname" @click="create">作成して入部</button>
    </section>

    <section>
      <h2>部室に入る</h2>
      <input v-model="roomId" aria-label="部室 id" placeholder="部室 id" />
      <button type="button" :disabled="!nickname || !roomId" @click="join">入部</button>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>

<style scoped>
.home {
  max-width: 480px;
  margin: 40px auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.error {
  color: #c00;
}
</style>
