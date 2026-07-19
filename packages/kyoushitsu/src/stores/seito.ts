import { housou } from "@/api"
import type { Seito } from "houkago-kousoku"
import { defineStore } from "pinia"
import { ref } from "vue"

export const useSeitoStore = defineStore("seito", () => {
  const seito = ref<Seito | null>(null)
  const restoring = ref(false)

  async function restore(): Promise<Seito | null> {
    restoring.value = true
    try {
      const { data } = await housou.seitoshou.me.get()
      seito.value = data ?? null
      return seito.value
    } finally {
      restoring.value = false
    }
  }

  async function authenticate(
    mode: "register" | "sign-in",
    username: string,
    password: string,
  ): Promise<boolean> {
    const route = mode === "register" ? housou.seitoshou.register : housou.seitoshou["sign-in"]
    const { data } = await route.post({ username, password })
    seito.value = data ?? null
    return data !== null
  }

  async function signOut(): Promise<void> {
    await housou.seitoshou["sign-out"].post({})
    seito.value = null
  }

  return { seito, restoring, restore, authenticate, signOut }
})
