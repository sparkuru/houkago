<script setup lang="ts">
import { housou } from "@/api"
import { t } from "@/i18n"
import { buinId } from "@/lib/identity"
import { normalizeRoomId } from "@/lib/room-id"
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
  bushitsu.setNickname(nickname.value) // persist so reload/direct-link keeps the name
  bushitsu.bushitsuId = bushitsuId
  router.push({ name: "bushitsu", params: { id: bushitsuId } })
}

// 部室を作る then enter as 部長. The room's buchouId must be this browser's stable
// buinId (= the WS senderId), or host-authority never matches (design §5).
async function create() {
  error.value = ""
  if (!nickname.value) return
  const { data, error: err } = await housou.bushitsu.post({
    name: newRoomName.value || t("defaultBushitsuName"),
    buchouId: buinId(),
  })
  if (err || !data) {
    error.value = t("createBushitsuFailed")
    return
  }
  enter(data.id)
}

// 入部：enter an existing room by id.
function join() {
  error.value = ""
  if (!nickname.value || !roomId.value) return
  // 净化: a pasted URL/path ("bushitsu/<uuid>") must not become the room id.
  const id = normalizeRoomId(roomId.value)
  if (!id) return
  enter(id)
}
</script>

<template>
  <main class="home">
    <h1>{{ t("appTitle") }}</h1>
    <label>
      {{ t("nicknameLabel") }}
      <input v-model="nickname" :aria-label="t('nicknameLabel')" />
    </label>

    <section>
      <h2>{{ t("createBushitsuHeading") }}</h2>
      <input
        v-model="newRoomName"
        :aria-label="t('bushitsuNameLabel')"
        :placeholder="t('bushitsuNamePlaceholder')"
      />
      <button type="button" :disabled="!nickname" @click="create">{{ t("createAndJoin") }}</button>
    </section>

    <section>
      <h2>{{ t("joinBushitsuHeading") }}</h2>
      <input
        v-model="roomId"
        :aria-label="t('bushitsuIdLabel')"
        :placeholder="t('bushitsuIdPlaceholder')"
      />
      <button type="button" :disabled="!nickname || !roomId" @click="join">{{ t("joinBushitsu") }}</button>
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
