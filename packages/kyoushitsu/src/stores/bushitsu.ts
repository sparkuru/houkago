import { canDo } from "@/lib/kengen"
import { loadNickname, saveNickname } from "@/lib/nickname"
import type {
  Enmoku,
  Kengen,
  KousokuMessage,
  NyuushitsuMode,
  NyuushitsuRequest,
  NyuushitsuStatus,
  Shinkou,
  Yakuwari,
} from "houkago-kousoku"
import { defineStore } from "pinia"
import { computed, ref } from "vue"

// Guest-permission default mirrors housou's DEFAULT_KENGEN: guests may chat,
// host keeps playback + source. Used until the first KENGEN arrives.
const DEFAULT_KENGEN: Kengen = { playback: false, chat: true, playlist: false }
const DEFAULT_NYUUSHITSU_MODE: NyuushitsuMode = "open"

// useBushitsuStore: server-authoritative room/session state, fed by the WS
// client (state-management spec). The WS client is the writer; components read.
// Sync math is deliberately absent (P0 task) — we only hold last-known truth.

type ChatLine = {
  senderId: string
  content: string
  ts: number
  kind: "oshaberi" | "danmaku"
  color?: string
}
type DanmakuLine = { senderId: string; content: string; ts: number; color?: string; mode?: string }
type BuinPresence = {
  id: string
  nickname: string
  yakuwari: Yakuwari
  joinedAt: number
  lastSeenAt: number
  online: boolean
}

function uniqueEnmokuById(enmoku: readonly Enmoku[]): Enmoku[] {
  const seen = new Set<string>()
  const unique: Enmoku[] = []
  for (const item of enmoku) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }
  return unique
}

export const useBushitsuStore = defineStore("bushitsu", () => {
  const bushitsuId = ref<string | null>(null)
  const nickname = ref(loadNickname()) // persisted, so reload/direct-link keeps the name
  const senderId = ref("") // server-issued account id, never browser-generated
  const buchouId = ref<string | null>(null) // 部長 id, from GET /bushitsu/:id
  const shusseki = ref(0) // 出席数 presence count
  const roster = ref<Record<string, string>>({}) // 名簿: senderId→nickname, accumulated from SHUSSEKI
  // 役割: senderId→yakuwari (部長/ゲスト), accumulated from SHUSSEKI alongside the
  // roster so departed members' roles resolve for historical lines too.
  const yakuwari = ref<Record<string, Yakuwari>>({})
  const presenceById = ref<Record<string, BuinPresence>>({})
  const enmokuId = ref<string | null>(null) // 上映中
  const bangumi = ref<Enmoku[]>([])
  const chat = ref<ChatLine[]>([])
  const danmaku = ref<DanmakuLine[]>([])
  // 権限: the room's guest-permission snapshot, written by KENGEN. Defaults to the
  // housou default so gating is sane before the first KENGEN arrives.
  const kengen = ref<Kengen>({ ...DEFAULT_KENGEN })
  const nyuushitsuMode = ref<NyuushitsuMode>(DEFAULT_NYUUSHITSU_MODE)
  const nyuushitsuStatus = ref<NyuushitsuStatus | "idle">("idle")
  const pendingNyuushitsu = ref<NyuushitsuRequest[]>([])

  // 部長か：am I the host? Derived authority — only my player drives sync.
  const isBuchou = computed(() => buchouId.value !== null && senderId.value === buchouId.value)

  // 派生権限: the host may always do everything; a guest follows the room switch
  // (canDo pure function, shared with housou's gate). UI gating reads these.
  const canControl = computed(() => canDo(isBuchou.value, kengen.value, "playback"))
  const canChat = computed(() => canDo(isBuchou.value, kengen.value, "chat"))
  const canPlaylist = computed(() => canDo(isBuchou.value, kengen.value, "playlist"))
  const onlineBuinInfo = computed(() =>
    Object.values(presenceById.value)
      .filter((member) => member.online)
      .sort((a, b) => a.joinedAt - b.joinedAt),
  )
  const historyBuinInfo = computed(() =>
    Object.values(presenceById.value)
      .filter((member) => !member.online)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt),
  )

  // last authoritative Shinkou + its server time, for P0 projected-progress math.
  const shinkou = ref<Shinkou | null>(null)
  const shinkouServerTime = ref(0)

  // Commit a decoded server/peer envelope into the store. The WS client calls
  // this; UI never writes server-truth fields directly.
  function apply(msg: KousokuMessage): void {
    switch (msg.type) {
      case "OSHABERI":
        chat.value.push({
          senderId: msg.senderId,
          content: msg.payload.content,
          ts: msg.ts,
          kind: "oshaberi",
        })
        break
      case "DANMAKU":
        danmaku.value.push({
          senderId: msg.senderId,
          content: msg.payload.content,
          ts: msg.ts,
          color: msg.payload.color,
          mode: msg.payload.mode,
        })
        chat.value.push({
          senderId: msg.senderId,
          content: msg.payload.content,
          ts: msg.ts,
          kind: "danmaku",
          color: msg.payload.color,
        })
        break
      case "SHUSSEKI": {
        // SHUSSEKI carries the live count + present members. The count (出席数)
        // tracks presence exactly. The roster名簿 (display-name lookup), however,
        // is MERGED — never rebuilt — so a departed member's nickname is retained
        // for their historical chat/danmaku lines (otherwise nicknameOf falls back
        // to the raw uuid). Accumulating display names is harmless; only presence
        // counting needs to reflect departures.
        shusseki.value = msg.payload.n
        const merged = { ...roster.value }
        const mergedYakuwari = { ...yakuwari.value }
        const nextPresence = { ...presenceById.value }
        const onlineIds = new Set(msg.payload.members.map((m) => m.id))
        for (const member of Object.values(nextPresence)) {
          if (onlineIds.has(member.id) || !member.online) continue
          nextPresence[member.id] = {
            ...member,
            online: false,
            lastSeenAt: msg.ts,
          }
        }
        for (const m of msg.payload.members) {
          merged[m.id] = m.nickname
          mergedYakuwari[m.id] = m.yakuwari
          const existing = nextPresence[m.id]
          nextPresence[m.id] = {
            id: m.id,
            nickname: m.nickname,
            yakuwari: m.yakuwari,
            joinedAt: existing?.online ? existing.joinedAt : msg.ts,
            lastSeenAt: msg.ts,
            online: true,
          }
        }
        roster.value = merged
        yakuwari.value = mergedYakuwari
        presenceById.value = nextPresence
        break
      }
      case "KENGEN":
        kengen.value = msg.payload
        break
      case "NYUUSHITSU":
        nyuushitsuMode.value = msg.payload.mode
        nyuushitsuStatus.value = msg.payload.status
        pendingNyuushitsu.value = msg.payload.pending
        break
      case "JOUEI":
        enmokuId.value = msg.payload.enmokuId
        break
      case "BANGUMI":
        bangumi.value = uniqueEnmokuById(msg.payload.enmoku)
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

  // ニックネーム設定: set + persist together so every entry point stays in sync.
  function setNickname(name: string): void {
    nickname.value = name
    saveNickname(name)
  }

  function setSenderId(id: string): void {
    senderId.value = id
  }

  function setBangumi(enmoku: readonly Enmoku[]): void {
    bangumi.value = uniqueEnmokuById(enmoku)
  }

  // 名前解決: map a senderId to its nickname for display; fall back to the raw
  // senderId when the roster lacks it (no error, design: graceful degrade).
  function nicknameOf(id: string): string {
    return roster.value[id] ?? id
  }

  // 役割解決: map a senderId to its yakuwari for role display; default to ゲスト
  // (kengaku) when unknown so a label always renders (graceful degrade).
  function yakuwariOf(id: string): Yakuwari {
    return yakuwari.value[id] ?? "kengaku"
  }

  return {
    bushitsuId,
    nickname,
    senderId,
    buchouId,
    isBuchou,
    shusseki,
    roster,
    yakuwari,
    presenceById,
    onlineBuinInfo,
    historyBuinInfo,
    kengen,
    nyuushitsuMode,
    nyuushitsuStatus,
    pendingNyuushitsu,
    canControl,
    canChat,
    canPlaylist,
    enmokuId,
    bangumi,
    chat,
    danmaku,
    shinkou,
    shinkouServerTime,
    apply,
    setBangumi,
    setNickname,
    setSenderId,
    nicknameOf,
    yakuwariOf,
  }
})
