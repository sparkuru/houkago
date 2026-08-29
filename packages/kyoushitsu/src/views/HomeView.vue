<script setup lang="ts">
import { housou } from "@/api"
import { useEntryMotion } from "@/composables/use-entry-motion"
import { t } from "@/i18n"
import { normalizeRoomId } from "@/lib/room-id"
import { useSiteConfig } from "@/lib/site-config"
import { useBushitsuStore } from "@/stores/bushitsu"
import { useSeitoStore } from "@/stores/seito"
import { nextTick, onMounted, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"

const router = useRouter()
const route = useRoute()
const bushitsu = useBushitsuStore()
const seito = useSeitoStore()
const entryMotion = useEntryMotion()
const siteConfig = useSiteConfig()

const roomId = ref("")
const newRoomName = ref("")
const error = ref("")
const username = ref("")
const password = ref("")
const showPassword = ref(false)
const registering = ref(false)
const authenticating = ref(false)
const creating = ref(false)
const entryReady = ref(false)
const floorSign = ref<HTMLElement | null>(null)
const authPanel = ref<HTMLElement | null>(null)
const classroomPanel = ref<HTMLElement | null>(null)
const knownClassroom = ref<HTMLElement | null>(null)
const newClassroom = ref<HTMLElement | null>(null)
let roomViewPrefetched = false

function prefetchRoomView(): void {
  if (roomViewPrefetched) return
  roomViewPrefetched = true
  void import("@/views/BushitsuView.vue")
}

function enter(bushitsuId: string): void {
  prefetchRoomView()
  bushitsu.bushitsuId = bushitsuId
  void router.push({ name: "bushitsu", params: { id: bushitsuId } })
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
    if (!ok) error.value = t(registering.value ? "registerFailed" : "signInFailed")
  } catch {
    error.value = t(registering.value ? "registerFailed" : "signInFailed")
  } finally {
    authenticating.value = false
  }
}

async function signOut(): Promise<void> {
  await seito.signOut()
  roomId.value = ""
  newRoomName.value = ""
}

async function create(): Promise<void> {
  prefetchRoomView()
  error.value = ""
  if (!seito.seito || creating.value) return

  creating.value = true
  try {
    const { data, error: err } = await housou.bushitsu.post({
      name: newRoomName.value || siteConfig.entry.defaultBushitsuName,
    })
    if (err || !data) {
      error.value = t("createBushitsuFailed")
      return
    }
    enter(data.id)
  } catch {
    error.value = t("createBushitsuFailed")
  } finally {
    creating.value = false
  }
}

function join(): void {
  error.value = ""
  if (!seito.seito || !roomId.value) return
  const id = normalizeRoomId(roomId.value)
  if (!id) return
  enter(id)
}

function toggleRegistration(): void {
  error.value = ""
  registering.value = !registering.value
}

watch(registering, async () => {
  if (!entryReady.value) return
  await nextTick()
  entryMotion.replacePanel(authPanel.value)
})

watch(
  () => seito.seito?.id ?? null,
  async (current, previous) => {
    if (!entryReady.value || current === previous) return
    await nextTick()
    entryMotion.replacePanel(current ? classroomPanel.value : authPanel.value)
  },
)

onMounted(async () => {
  if (route.query.revoked === "1") error.value = t("membershipRevoked")

  try {
    await seito.restore()
  } catch {
    error.value = t("sessionRestoreFailed")
  } finally {
    entryReady.value = true
    await nextTick()
    entryMotion.enterFloor(
      floorSign.value,
      seito.seito ? [knownClassroom.value, newClassroom.value] : [authPanel.value],
    )
  }
})
</script>

<template>
  <main class="home">
    <div class="home-architecture" aria-hidden="true">
      <span class="corridor-line"></span>
      <span class="door-seam door-seam-near"></span>
      <span class="door-seam door-seam-far"></span>
    </div>

    <div class="home-shell">
      <header ref="floorSign" class="floor-sign" data-entry-motion="floor-sign">
        <div class="floor-marker">
          <span class="floor-code">{{ siteConfig.entry.floorCode }}</span>
          <span>{{ siteConfig.entry.floorLabel }}</span>
        </div>
        <h1>{{ siteConfig.site.name }}</h1>
        <p v-if="siteConfig.site.subtitle" class="brand-romanized">
          {{ siteConfig.site.subtitle }}
        </p>
        <p class="floor-hint">{{ siteConfig.entry.hint }}</p>
        <p class="floor-privacy">{{ siteConfig.entry.privacyNote }}</p>
      </header>

      <section class="entry-station" :aria-busy="!entryReady || seito.restoring">
        <section
          v-if="!entryReady || seito.restoring"
          class="entry-card restoring-card"
          role="status"
          aria-live="polite"
        >
          <span class="status-mark" aria-hidden="true"></span>
          <div>
            <h2>{{ t("restoringSession") }}</h2>
            <p>{{ t("restoringSessionHint") }}</p>
          </div>
        </section>

        <form
          v-else-if="!seito.seito"
          ref="authPanel"
          class="entry-card auth-card"
          data-entry-motion="auth-panel"
          @submit.prevent="authenticate"
        >
          <header class="card-heading">
            <p class="card-kicker">{{ t("authDeskLabel") }}</p>
            <h2>{{ registering ? t("registerHeading") : t("signInHeading") }}</h2>
            <p>{{ t("authDeskHint") }}</p>
          </header>

          <label class="field">
            <span>{{ t("usernameLabel") }}</span>
            <input
              v-model="username"
              autocomplete="username"
              required
              minlength="3"
              maxlength="32"
            />
          </label>

          <div class="field">
            <label for="seito-password">{{ t("passwordLabel") }}</label>
            <div class="password-row">
              <input
                id="seito-password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :autocomplete="registering ? 'new-password' : 'current-password'"
                :placeholder="t('passwordPlaceholder')"
                required
                minlength="8"
                maxlength="128"
              />
              <button
                type="button"
                class="entry-button button-quiet password-toggle"
                :aria-label="showPassword ? t('hidePassword') : t('showPassword')"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? t("hide") : t("show") }}
              </button>
            </div>
          </div>

          <div class="auth-actions">
            <button type="submit" class="entry-button button-primary" :disabled="authenticating">
              {{
                authenticating
                  ? t("authProcessing")
                  : registering
                    ? t("registerAndContinue")
                    : t("signInAndContinue")
              }}
            </button>
            <button
              type="button"
              class="entry-button button-quiet"
              :disabled="authenticating"
              @click="toggleRegistration"
            >
              {{ registering ? t("switchToSignIn") : t("switchToRegister") }}
            </button>
          </div>
        </form>

        <section
          v-else
          ref="classroomPanel"
          class="classroom-zone"
          data-entry-motion="classroom-zone"
          aria-labelledby="classroom-choice-heading"
        >
          <h2 id="classroom-choice-heading" class="visually-hidden">
            {{ t("classroomChoiceHeading") }}
          </h2>
          <div class="account-strip">
            <div>
              <span class="account-label">{{ t("currentAccount") }}</span>
              <p class="account-name">{{ t("signedInAs") }} {{ seito.seito.username }}</p>
            </div>
            <button type="button" class="entry-button button-quiet" @click="signOut">
              {{ t("signOut") }}
            </button>
          </div>

          <div class="classroom-grid">
            <form
              ref="knownClassroom"
              class="entry-card classroom-card known-classroom"
              data-entry-motion="known-classroom"
              @submit.prevent="join"
            >
              <header class="card-heading">
                <p class="classroom-sign">
                  <span class="room-glyph" aria-hidden="true">A</span>
                  {{ t("knownClassroomLabel") }}
                </p>
                <h3>{{ t("knownClassroomHeading") }}</h3>
                <p>{{ t("knownClassroomHint") }}</p>
              </header>
              <label class="field">
                <span>{{ t("bushitsuIdLabel") }}</span>
                <input
                  v-model="roomId"
                  :placeholder="t('bushitsuIdPlaceholder')"
                  @focus="prefetchRoomView"
                />
              </label>
              <button type="submit" class="entry-button button-primary" :disabled="!roomId">
                {{ t("joinBushitsu") }}
              </button>
            </form>

            <form
              ref="newClassroom"
              class="entry-card classroom-card new-classroom"
              data-entry-motion="new-classroom"
              @submit.prevent="create"
            >
              <header class="card-heading">
                <p class="classroom-sign">
                  <span class="room-glyph room-glyph-quiet" aria-hidden="true">+</span>
                  {{ t("newClassroomLabel") }}
                </p>
                <h3>{{ t("newClassroomHeading") }}</h3>
                <p>{{ t("newClassroomHint") }}</p>
              </header>
              <label class="field">
                <span>{{ t("bushitsuNameLabel") }}</span>
                <input
                  v-model="newRoomName"
                  :placeholder="t('bushitsuNamePlaceholder')"
                  @focus="prefetchRoomView"
                />
              </label>
              <button
                type="submit"
                class="entry-button button-secondary"
                :disabled="creating"
              >
                {{ creating ? t("createAndJoinPending") : t("createAndJoin") }}
              </button>
            </form>
          </div>
        </section>

        <p v-if="error" class="error-notice" role="alert">
          <span aria-hidden="true">!</span>
          {{ error }}
        </p>
      </section>
    </div>
  </main>
</template>

<style scoped>
.home {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--entry-environment-background);
  font-size: var(--type-body-size);
  line-height: var(--line-height-body);
}

.home-architecture {
  position: fixed;
  z-index: var(--layer-environment);
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.corridor-line,
.door-seam {
  position: absolute;
  display: block;
  background: var(--color-border);
  opacity: 0.52;
}

.corridor-line {
  right: 0;
  bottom: 11%;
  left: 0;
  height: 1px;
}

.door-seam {
  top: 12%;
  bottom: 11%;
  width: 1px;
}

.door-seam::after {
  position: absolute;
  right: -3px;
  bottom: 28%;
  width: 7px;
  height: 7px;
  content: "";
  background: var(--color-border-strong);
  border-radius: 50%;
}

.door-seam-near {
  right: 8%;
}

.door-seam-far {
  right: 28%;
  opacity: 0.32;
}

.home-shell {
  position: relative;
  z-index: var(--layer-content);
  display: grid;
  grid-template-columns: minmax(230px, 0.72fr) minmax(0, 1.55fr);
  gap: clamp(var(--space-6), 6vw, var(--space-8));
  align-items: center;
  width: min(calc(100% - (var(--layout-page-gutter) * 2)), var(--layout-entry-max));
  min-height: 100%;
  margin: 0 auto;
  padding: clamp(var(--space-5), 8vh, 72px) 0;
}

.floor-sign {
  position: relative;
  max-width: 320px;
  padding: var(--space-5);
  overflow: hidden;
  background: var(--entry-sign-surface);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-accent);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-panel);
}

.floor-sign::after {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
  width: 32px;
  height: 1px;
  content: "";
  background: var(--color-border-strong);
}

.floor-marker {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-5);
  color: var(--color-text-muted);
  font-size: var(--type-label-size);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.floor-code {
  display: inline-grid;
  min-width: var(--control-height);
  min-height: 32px;
  place-items: center;
  color: var(--color-on-accent);
  background: var(--color-accent);
  border-radius: calc(var(--radius-sm) / 2);
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-family: var(--font-display);
  font-size: min(var(--type-display-size), 48px);
  font-weight: 600;
  line-height: var(--line-height-display);
  letter-spacing: 0.05em;
  overflow-wrap: anywhere;
}

.brand-romanized {
  margin-top: var(--space-1);
  color: var(--color-accent-strong);
  font-size: var(--type-label-size);
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.floor-hint {
  margin-top: var(--space-5);
  font-weight: 700;
}

.floor-privacy {
  margin-top: var(--space-2);
  color: var(--color-text-muted);
  font-size: 14px;
}

.entry-station {
  width: 100%;
  min-width: 0;
}

.entry-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: clamp(var(--space-4), 3vw, var(--space-6));
  background: var(--entry-card-surface);
  border: 1px solid var(--entry-card-border);
  border-radius: var(--radius-lg);
}

.auth-card {
  width: min(100%, 540px);
  margin-left: auto;
  border-color: var(--entry-card-border-strong);
  box-shadow: var(--entry-card-elevation);
}

.restoring-card {
  flex-direction: row;
  align-items: center;
  width: min(100%, 540px);
  margin-left: auto;
  color: var(--color-text-muted);
  box-shadow: var(--elevation-panel);
}

.restoring-card h2 {
  color: var(--color-text);
  font-size: var(--type-title-size);
}

.status-mark {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  background: var(--color-accent);
  border: 3px solid var(--color-surface-muted);
  border-radius: 50%;
}

.card-heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.card-heading h2,
.card-heading h3 {
  font-family: var(--font-display);
  font-size: var(--type-title-size);
  line-height: var(--line-height-compact);
}

.card-heading > p:last-child {
  color: var(--color-text-muted);
  font-size: 14px;
}

.card-kicker,
.account-label {
  color: var(--color-accent-strong);
  font-size: var(--type-label-size);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: var(--type-label-size);
  font-weight: 700;
}

input {
  width: 100%;
  min-width: 0;
  min-height: var(--control-height);
  padding: 0 var(--space-3);
  color: var(--color-text);
  background: var(--entry-field-surface);
  border: 1px solid var(--entry-field-border);
  border-radius: var(--radius-sm);
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);
}

input:hover {
  border-color: var(--color-border-strong);
}

input:focus {
  border-color: var(--color-focus-ring);
  box-shadow: 0 0 0 1px var(--color-focus-ring);
}

input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.74;
}

.password-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
}

.entry-button {
  min-height: var(--control-height);
  padding: 0 var(--space-4);
  color: var(--entry-button-text);
  font-weight: 700;
  cursor: pointer;
  background: var(--entry-button-surface);
  border: 1px solid var(--entry-button-surface);
  border-radius: var(--radius-sm);
  transition:
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard),
    transform var(--duration-fast) var(--ease-standard);
}

.entry-button:not(:disabled):hover {
  background: var(--entry-button-hover);
  border-color: var(--entry-button-hover);
}

.entry-button:not(:disabled):active {
  transform: translateY(1px);
}

.entry-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.button-quiet,
.button-secondary {
  color: var(--color-accent-strong);
  background: var(--entry-button-quiet-surface);
  border-color: var(--color-border-strong);
}

.button-quiet:not(:disabled):hover,
.button-secondary:not(:disabled):hover {
  color: var(--color-accent-strong);
  background: var(--entry-button-quiet-hover);
  border-color: var(--color-accent-strong);
}

.password-toggle {
  min-width: 64px;
}

.auth-actions {
  display: grid;
  gap: var(--space-2);
}

.classroom-zone {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.account-strip {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  justify-content: space-between;
  min-height: var(--control-height);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  background: color-mix(in srgb, var(--color-surface) 72%, transparent);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.account-name {
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}

.classroom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.14fr) minmax(0, 0.86fr);
  gap: var(--space-4);
  align-items: stretch;
}

.classroom-card {
  position: relative;
  min-width: 0;
}

.known-classroom {
  border-color: var(--entry-card-border-strong);
  box-shadow: var(--entry-card-elevation);
}

.new-classroom {
  background: var(--entry-card-secondary-surface);
}

.classroom-card .entry-button {
  margin-top: auto;
}

.card-heading > .classroom-sign {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-bottom: var(--space-2);
  color: var(--color-accent-strong);
  font-size: var(--type-label-size);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.room-glyph {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  color: var(--color-on-accent);
  background: var(--color-accent);
  border-radius: calc(var(--radius-sm) / 2);
}

.room-glyph-quiet {
  color: var(--color-accent-strong);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
}

.error-notice {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--color-danger);
  background: var(--entry-notice-danger-surface);
  border: 1px solid var(--entry-notice-danger-border);
  border-radius: var(--radius-sm);
}

.error-notice > span {
  display: inline-grid;
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--color-on-accent);
  font-weight: 800;
  line-height: 1;
  background: var(--color-danger);
  border-radius: 50%;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 820px) {
  .home-shell {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
    align-content: center;
    width: min(calc(100% - (var(--space-5) * 2)), 680px);
  }

  .floor-sign {
    width: 100%;
    max-width: none;
    padding: var(--space-4) var(--space-5);
  }

  .floor-marker {
    margin-bottom: var(--space-3);
  }

  .floor-hint {
    margin-top: var(--space-3);
  }

  .auth-card,
  .restoring-card {
    width: 100%;
    margin-left: 0;
  }

  .door-seam-far {
    display: none;
  }
}

@media (max-width: 560px) {
  .home-shell {
    width: calc(100% - (var(--space-3) * 2));
    padding: var(--space-4) 0 var(--space-5);
  }

  .floor-sign {
    padding: var(--space-3) var(--space-4);
  }

  .floor-marker {
    margin-bottom: var(--space-2);
  }

  .floor-hint,
  .floor-privacy {
    font-size: var(--type-label-size);
  }

  .entry-card {
    padding: var(--space-4);
  }

  .classroom-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
  }

  .account-strip {
    align-items: flex-start;
  }

  .account-strip .entry-button {
    flex: 0 0 auto;
  }

  .door-seam {
    display: none;
  }
}
</style>
