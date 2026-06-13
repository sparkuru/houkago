import { zureHosei } from "@/lib/zure"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import type { Ref } from "vue"

// 進行制御（client side, design §5): the sync controller. Lives here — never in a
// .vue — because echo suppression + drift correction is stateful logic shared
// across the player's lifetime. The host drives (emits SHINKOU); 部員 follow.
//
// Two remote channels are routed explicitly by message type (no blanket store
// watch): an explicit SHINKOU (host pressed play/seek/rate) is a hard apply; a
// periodic GENJOU heartbeat (also the OIKAKE catch-up reply) aligns transport
// and corrects time through zureHosei's three tiers (design §5, §14).

// Echo-suppression window: applying remote authority state makes ArtPlayer fire
// its own play/seek/rate events; ignore locally-originated events for this long
// so they are not re-broadcast (追従中, design §5).
const TSUIJUU_MS = 200

// The player owns all imperative art.* calls (component-guidelines); useShinkou
// only drives it through these handles.
export type PlayerHandle = {
  apply: (s: Shinkou) => void // hard apply: seek (>0.3s) + play/pause/rate
  alignTransport: (s: Shinkou) => void // play/pause/rate only, no seek
  setRate: (rate: number) => void // temporary nudge rate
  snapshot: () => Shinkou // read local playback position/state
}

// Project the authority position forward by elapsed wall-clock so a follower
// lands where the host is now (design §5). v1 trusts the server clock directly
// (no NTP-lite offset; RTT/2 negligible on the demo path).
function projected(s: Shinkou, serverTime: number): number {
  const elapsed = s.isPlaying ? (Date.now() - serverTime) / 1000 : 0
  return s.currentTime + elapsed * s.playbackRate
}

export function useShinkou(send: (m: KousokuMessage) => void, player: Ref<PlayerHandle | null>) {
  const bushitsu = useBushitsuStore()
  let tsuijuuChuu = false // 追従中：applying remote authority state right now
  let nudging = false // 軟校正中：playbackRate is temporarily nudged off authority

  // Run a player mutation inside the echo-suppression window so the resulting
  // local events are not re-broadcast.
  function suppressed(fn: (p: PlayerHandle) => void) {
    const p = player.value
    if (!p) return
    tsuijuuChuu = true
    fn(p)
    setTimeout(() => {
      tsuijuuChuu = false
    }, TSUIJUU_MS)
  }

  // A local player event. Only the 部長 broadcasts, and never while echoing a
  // remote apply.
  function onLocalShinkou(s: Shinkou) {
    if (!bushitsu.isBuchou || tsuijuuChuu) return
    send({ type: "SHINKOU", ts: Date.now(), senderId: bushitsu.senderId, payload: s })
  }

  // Explicit host operation: hard apply (seek to projected + play/pause/rate).
  function applyShinkou(s: Shinkou, serverTime: number) {
    nudging = false
    suppressed((p) => p.apply({ ...s, currentTime: projected(s, serverTime) }))
  }

  // Periodic heartbeat / OIKAKE catch-up: align transport, then correct time by
  // tier. Soft nudge self-reverts to the authority rate on the next ignore tick.
  function applyGenjou(s: Shinkou, serverTime: number) {
    const p = player.value
    if (!p) return
    const local = p.snapshot()
    const remote = projected(s, serverTime)
    const zure = Math.abs(local.currentTime - remote)
    const behind = local.currentTime < remote
    const decision = zureHosei(zure, behind, s.isPlaying, s.playbackRate)

    suppressed((pp) => {
      // Always follow authority play/pause; rate is owned by the nudge below.
      pp.alignTransport(s)
      switch (decision.kind) {
        case "seek":
          pp.apply({ ...s, currentTime: remote })
          nudging = false
          break
        case "nudge":
          pp.setRate(decision.rate)
          nudging = true
          break
        case "ignore":
          // Settled back inside tolerance — restore authority rate if we had
          // nudged it off (design §5 soft-correction self-revert).
          if (nudging) {
            pp.setRate(s.playbackRate)
            nudging = false
          }
          break
      }
    })
  }

  // Route a decoded remote envelope. The store has already committed it (truth);
  // here we drive the player. The 部長 is the authority and never follows.
  function handleRemote(msg: KousokuMessage) {
    if (bushitsu.isBuchou) return
    switch (msg.type) {
      case "SHINKOU":
        applyShinkou(msg.payload, msg.ts)
        break
      case "GENJOU":
        applyGenjou(msg.payload.shinkou, msg.payload.serverTime)
        break
      default:
        break
    }
  }

  // Catch up to whatever authority state the store currently holds — used once on
  // player `ready` so a late joiner snaps to position even before the next tick.
  function catchUp() {
    if (bushitsu.isBuchou || !bushitsu.shinkou) return
    applyShinkou(bushitsu.shinkou, bushitsu.shinkouServerTime)
  }

  return { onLocalShinkou, handleRemote, catchUp }
}
