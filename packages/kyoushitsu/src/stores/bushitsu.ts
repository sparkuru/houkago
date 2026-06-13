import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import { defineStore } from "pinia"
import { ref } from "vue"

// useBushitsuStore: server-authoritative room/session state, fed by the WS
// client (state-management spec). The WS client is the writer; components read.
// Sync math is deliberately absent (P0 task) — we only hold last-known truth.

type ChatLine = { senderId: string; content: string; ts: number }

export const useBushitsuStore = defineStore("bushitsu", () => {
  const bushitsuId = ref<string | null>(null)
  const nickname = ref("")
  const senderId = ref("")
  const shusseki = ref(0) // 出席数 presence count
  const enmokuId = ref<string | null>(null) // 上映中
  const chat = ref<ChatLine[]>([])

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
        // P0 TODO: apply to player with tsuijuuChuu echo suppression.
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
    shusseki,
    enmokuId,
    chat,
    shinkou,
    shinkouServerTime,
    apply,
  }
})
