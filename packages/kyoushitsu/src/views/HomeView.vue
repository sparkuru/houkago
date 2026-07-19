<script setup lang="ts">
import { housou } from "@/api"
import { t } from "@/i18n"
import { normalizeRoomId } from "@/lib/room-id"
import { useBushitsuStore } from "@/stores/bushitsu"
import { useSeitoStore } from "@/stores/seito"
import { onMounted, ref } from "vue"
import { useRouter } from "vue-router"

// Account-gated room entry: the server-issued account owns room authority.
const router = useRouter()
const bushitsu = useBushitsuStore()
const seito = useSeitoStore()

const roomId = ref("")
const newRoomName = ref("")
const error = ref("")
const username = ref("")
const password = ref("")
const showPassword = ref(false)
const registering = ref(false)
const authenticating = ref(false)
let roomViewPrefetched = false

function prefetchRoomView(): void {
  if (roomViewPrefetched) return
  roomViewPrefetched = true
  void import("@/views/BushitsuView.vue")
}

function enter(bushitsuId: string) {
  prefetchRoomView()
  bushitsu.bushitsuId = bushitsuId
  router.push({ name: "bushitsu", params: { id: bushitsuId } })
}

async function authenticate(): Promise<void> {
  error.value = ""
  authenticating.value = true
  try {
    const ok = await seito.authenticate(
      registering.value ? "register" : "sign-in",
      username.value,
      password.value,
    )
    if (!ok)
      error.value = registering.value ? "注册失败，请检查用户名和密码。" : "用户名或密码不正确。"
  } finally {
    authenticating.value = false
  }
}

async function signOut(): Promise<void> {
  await seito.signOut()
  roomId.value = ""
  newRoomName.value = ""
}

// The authenticated server actor becomes 部長.
async function create() {
  prefetchRoomView()
  error.value = ""
  if (!seito.seito) return
  const { data, error: err } = await housou.bushitsu.post({
    name: newRoomName.value || t("defaultBushitsuName"),
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
  if (!seito.seito || !roomId.value) return
  // 净化: a pasted URL/path ("bushitsu/<uuid>") must not become the room id.
  const id = normalizeRoomId(roomId.value)
  if (!id) return
  enter(id)
}

onMounted(() => {
  void seito.restore()
})
</script>

<template>
  <main class="home">
    <header class="home-heading">
      <h1>{{ t("appTitle") }}</h1>
    </header>

    <form v-if="!seito.seito" class="entry-card entry-primary" @submit.prevent="authenticate">
      <h2>{{ registering ? "注册账号" : "登录" }}</h2>
      <label class="nickname-field">
        <span>用户名</span>
        <input v-model="username" autocomplete="username" required minlength="3" maxlength="32" />
      </label>
      <div class="nickname-field">
        <label for="seito-password">密码</label>
        <div class="password-row">
          <input id="seito-password" v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="registering ? 'new-password' : 'current-password'" placeholder="至少 8 位" required minlength="8" maxlength="128" />
          <button type="button" class="secondary-button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword">{{ showPassword ? "隐藏" : "显示" }}</button>
        </div>
      </div>
      <button type="submit" :disabled="authenticating">{{ authenticating ? "处理中…" : registering ? "注册并继续" : "登录并继续" }}</button>
      <button type="button" class="secondary-button" @click="registering = !registering">{{ registering ? "已有账号？登录" : "没有账号？注册" }}</button>
    </form>

    <template v-else>
      <p class="account-name">已登录为 {{ seito.seito.username }}</p>
      <button type="button" class="secondary-button" @click="signOut">退出登录</button>

      <form class="entry-card entry-primary" @submit.prevent="join">
        <h2>{{ t("joinBushitsuHeading") }}</h2>
        <input
          v-model="roomId"
          :aria-label="t('bushitsuIdLabel')"
          :placeholder="t('bushitsuIdPlaceholder')"
          @focus="prefetchRoomView"
        />
        <button type="submit" :disabled="!roomId">{{ t("joinBushitsu") }}</button>
      </form>

      <form class="entry-card entry-secondary" @submit.prevent="create">
        <h2>{{ t("createBushitsuHeading") }}</h2>
        <input
          v-model="newRoomName"
          :aria-label="t('bushitsuNameLabel')"
          :placeholder="t('bushitsuNamePlaceholder')"
          @focus="prefetchRoomView"
        />
        <button type="submit">{{ t("createAndJoin") }}</button>
      </form>

    </template>
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
.password-row { display: flex; gap: var(--space-2); }
.password-row input { min-width: 0; flex: 1; }
.secondary-button { color: var(--color-accent-strong); background: transparent; border-color: var(--color-border-strong); }
.secondary-button:not(:disabled):hover,
.entry-secondary button:not(:disabled):hover {
  color: var(--color-accent-strong);
  background: var(--color-surface-muted);
  border-color: var(--color-accent-strong);
}
.account-name { color: var(--color-text-muted); }
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
