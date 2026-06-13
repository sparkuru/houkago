import { buinId } from "@/lib/identity"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import { defineStore } from "pinia"
import { computed, ref } from "vue"

// useBushitsuStore: server-authoritative room/session state, fed by the WS
// client (state-management spec). The WS client is the writer; components read.
// Sync math is deliberately absent (P0 task) — we only hold last-known truth.

type ChatLine = { senderId: string; content: string; ts: number }

export const useBushitsuStore = defineStore("bushitsu", () => {
  const bushitsuId = ref<string | null>(null)
  const nickname = ref("")
  const senderId = ref(buinId()) // stable identity = WS senderId (design §5)
  const buchouId = ref<string | null>(null) // 部長 id, from GET /bushitsu/:id
  const shusseki = ref(0) // 出席数 presence count
  const enmokuId = ref<string | null>(null) // 上映中
  const chat = ref<ChatLine[]>([])

  // 部長か：am I the host? Derived authority — only my player drives sync.
  const isBuchou = computed(() => buchouId.value !== null && senderId.value === buchouId.value)

  // last authoritative Shinkou + its server time, for P0 projected-progress math.
  const shinkou = ref<Shinkou | null>(null)
  const shinkouServerTime = ref(0)

  // Commit a decoded server/peer envelope into the store. The WS client calls
  // this; UI never writes server-truth fields directly.
  function apply(msg: KousokuMessage): void {
    switch (msg.type) {
      case "OSHABERI":
        chat.value.push({ senderId: msg.senderId, content: msg.payload.content, ts: msg.ts })
        break
      case "SHUSSEKI":
        shusseki.value = msg.payload.n
        break
      case "JOUEI":
        enmokuId.value = msg.payload.enmokuId
        break
      case "GENJOU":
        enmokuId.value = msg.payload.enmokuId
        shinkou.value = msg.payload.shinkou
        shinkouServerTime.value = msg.payload.serverTime
        break
      case "SHINKOU":
        // Player application (hard apply + tsuijuuChuu echo suppression) is done
        // by useShinkou.handleRemote; the store only commits last-known truth.
        shinkou.value = msg.payload
        shinkouServerTime.value = msg.ts
        break
      default:
        break
    }
  }

  return {
    bushitsuId,
    nickname,
    senderId,
    buchouId,
    isBuchou,
    shusseki,
    enmokuId,
    chat,
    shinkou,
    shinkouServerTime,
    apply,
  }
})
