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
let roomViewPrefetched = false

function prefetchRoomView(): void {
  if (roomViewPrefetched) return
  roomViewPrefetched = true
  void import("@/views/BushitsuView.vue")
}

function enter(bushitsuId: string) {
  prefetchRoomView()
  bushitsu.setNickname(nickname.value) // persist so reload/direct-link keeps the name
  bushitsu.bushitsuId = bushitsuId
  router.push({ name: "bushitsu", params: { id: bushitsuId } })
}

// 部室を作る then enter as 部長. The room's buchouId must be this browser's stable
// buinId (= the WS senderId), or host-authority never matches (design §5).
async function create() {
  prefetchRoomView()
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
    <header class="home-heading">
      <h1>{{ t("appTitle") }}</h1>
    </header>

    <label class="nickname-field">
      <span>{{ t("nicknameLabel") }}</span>
      <input
        v-model="nickname"
        :aria-label="t('nicknameLabel')"
        autocomplete="nickname"
        @focus="prefetchRoomView"
      />
    </label>

    <form class="entry-card entry-primary" @submit.prevent="join">
      <h2>{{ t("joinBushitsuHeading") }}</h2>
      <input
        v-model="roomId"
        :aria-label="t('bushitsuIdLabel')"
        :placeholder="t('bushitsuIdPlaceholder')"
        @focus="prefetchRoomView"
      />
      <button type="submit" :disabled="!nickname || !roomId">{{ t("joinBushitsu") }}</button>
    </form>

    <form class="entry-card entry-secondary" @submit.prevent="create">
      <h2>{{ t("createBushitsuHeading") }}</h2>
      <input
        v-model="newRoomName"
        :aria-label="t('bushitsuNameLabel')"
        :placeholder="t('bushitsuNamePlaceholder')"
        @focus="prefetchRoomView"
      />
      <button type="submit" :disabled="!nickname">{{ t("createAndJoin") }}</button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
.home {
  width: min(100% - 32px, 480px);
  min-height: 100%;
  margin: 0 auto;
  padding: clamp(48px, 12vh, 120px) 0 48px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.home-heading {
  margin-bottom: var(--space-2);
}
h1,
h2,
p {
  margin: 0;
}
h1 {
  color: var(--color-text);
  font-family: ui-serif, Georgia, serif;
  font-size: clamp(32px, 8vw, 48px);
  letter-spacing: 0.03em;
}
.nickname-field,
.entry-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.nickname-field > span {
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 700;
}
.entry-card {
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft);
}
.entry-primary {
  border-color: var(--color-border-strong);
}
.entry-secondary {
  background: color-mix(in srgb, var(--color-surface) 82%, var(--color-surface-muted));
  box-shadow: none;
}
h2 {
  color: var(--color-text);
  font-size: 18px;
}
input {
  min-height: 44px;
  padding: 0 var(--space-3);
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
button {
  min-height: 44px;
  padding: 0 var(--space-4);
  color: var(--color-on-accent);
  font-weight: 700;
  cursor: pointer;
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm);
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}
button:not(:disabled):hover {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}
button:not(:disabled):active {
  transform: translateY(1px);
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.entry-secondary button {
  color: var(--color-accent-strong);
  background: transparent;
  border-color: var(--color-border-strong);
}
.error {
  padding: var(--space-3);
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-surface) 84%, var(--color-danger-surface));
  border: 1px solid color-mix(in srgb, var(--color-danger) 36%, var(--color-border));
  border-radius: var(--radius-sm);
}
@media (max-width: 480px) {
  .home {
    width: min(100% - 24px, 480px);
    padding-top: 48px;
  }
  .entry-card {
    padding: var(--space-4);
  }
}
</style>
