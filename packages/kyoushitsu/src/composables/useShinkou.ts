import { useBushitsuStore } from "@/stores/bushitsu"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import { type Ref, watch } from "vue"

// 進行制御（client side, design §5): the sync controller. Lives here — never in a
// .vue — because echo suppression + catch-up is stateful logic shared across the
// player's lifetime. The host drives (emits SHINKOU); 部員 follow (apply remote
// state, suppressing the resulting local echo).

// Echo-suppression window: applying a remote SHINKOU makes ArtPlayer fire its own
// play/seek events; ignore locally-originated events for this long so they are
// not re-broadcast (追従中, design §5).
const TSUIJUU_MS = 200

// The player exposes exactly one imperative entry point; all art.seek/play calls
// stay inside EnmokuPlayer (component-guidelines).
export type PlayerHandle = { apply: (s: Shinkou) => void }

export function useShinkou(send: (m: KousokuMessage) => void, player: Ref<PlayerHandle | null>) {
  const bushitsu = useBushitsuStore()
  let tsuijuuChuu = false // 追従中：applying remote authority state right now

  // A local player event. Only the 部長 broadcasts, and never while echoing a
  // remote apply.
  function onLocalShinkou(s: Shinkou) {
    if (!bushitsu.isBuchou || tsuijuuChuu) return
    send({ type: "SHINKOU", ts: Date.now(), senderId: bushitsu.senderId, payload: s })
  }

  // Apply the last authoritative Shinkou to the player, projecting elapsed
  // wall-clock so a late joiner lands at the right position (design §5). 部員
  // only — the host is the authority and never follows. v1 trusts the server
  // clock directly (no NTP-lite offset; RTT/2 negligible on the demo path).
  function applyLatest() {
    if (bushitsu.isBuchou) return
    const s = bushitsu.shinkou
    const p = player.value
    if (!s || !p) return
    const elapsed = s.isPlaying ? (Date.now() - bushitsu.shinkouServerTime) / 1000 : 0
    const projected = s.currentTime + elapsed * s.playbackRate
    tsuijuuChuu = true
    p.apply({ ...s, currentTime: projected })
    setTimeout(() => {
      tsuijuuChuu = false
    }, TSUIJUU_MS)
  }

  // Re-apply whenever authority state changes (remote SHINKOU / GENJOU landed in
  // the store). The store ref is replaced wholesale on apply, so a shallow watch
  // on [shinkou, serverTime] is enough.
  watch(() => [bushitsu.shinkou, bushitsu.shinkouServerTime], applyLatest)

  return { onLocalShinkou, applyLatest }
}
