import { createOffsetEstimator } from "@/lib/clock-offset"
import { zureHosei } from "@/lib/zure"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"
import type { Ref } from "vue"

// 進行制御（client side, design §5 回填): the sync controller. Lives here — never
// in a .vue — because echo suppression + drift correction is stateful logic shared
// across the player's lifetime. 共有制御: anyone with 再生制御 権限 (host or an
// authorized guest, bushitsu.canControl) drives — their local play/seek emits
// SHINKOU; everyone (host included) follows a peer's SHINKOU (後写者勝ち). Only the
// periodic GENJOU heartbeat keeps the original single-host follow (host skips it
// to stay its own authority on its own heartbeat).
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
// lands where the host is now (design §5). NTP-lite: the follower's local clock
// (Date.now()) may differ from the server clock by an offset O (LAN RTC drift can
// be seconds, far larger than one-way latency). We estimate offset = serverClock −
// clientClock passively and use (Date.now() + offset) as the server-now, so the
// projection target no longer carries O. offset defaults to 0 → original behavior.
function projected(s: Shinkou, serverTime: number, offset: number): number {
  const serverNow = Date.now() + offset
  const elapsed = s.isPlaying ? (serverNow - serverTime) / 1000 : 0
  return s.currentTime + elapsed * s.playbackRate
}

export function useShinkou(send: (m: KousokuMessage) => void, player: Ref<PlayerHandle | null>) {
  const bushitsu = useBushitsuStore()
  let tsuijuuChuu = false // 追従中：applying remote authority state right now
  let nudging = false // 軟校正中：playbackRate is temporarily nudged off authority

  // NTP-lite clock-offset estimator (design §5). Fed only by server-stamped S→C
  // messages; read by every projected() call. offset = serverClock − clientClock.
  const offsetEstimator = createOffsetEstimator()

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

  // A local player event. Anyone holding 再生制御 権限 (bushitsu.canControl = host
  // or an authorized guest) broadcasts — 共有制御 (design §5 回填). Never while
  // echoing a remote apply (追従中) so the apply-induced local event is not
  // re-broadcast → no oscillation. Unauthorized guests never reach here (control
  // bar hidden + server enforcement), so the gate is canControl, not isBuchou.
  function onLocalShinkou(s: Shinkou) {
    if (!bushitsu.canControl || tsuijuuChuu) return
    send({ type: "SHINKOU", ts: Date.now(), senderId: bushitsu.senderId, payload: s })
  }

  // Explicit host operation: hard apply (seek to projected + play/pause/rate).
  function applyShinkou(s: Shinkou, serverTime: number) {
    nudging = false
    suppressed((p) =>
      p.apply({ ...s, currentTime: projected(s, serverTime, offsetEstimator.estimate()) }),
    )
  }

  // Periodic heartbeat / OIKAKE catch-up: align transport, then correct time by
  // tier. Soft nudge self-reverts to the authority rate on the next ignore tick.
  function applyGenjou(s: Shinkou, serverTime: number) {
    const p = player.value
    if (!p) return
    const local = p.snapshot()
    const remote = projected(s, serverTime, offsetEstimator.estimate())
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
  // here we drive the player. 共有制御 (design §5 回填): a peer's SHINKOU is applied
  // by EVERYONE, host included (後写者勝ち) — the host no longer early-returns. The
  // GENJOU heartbeat keeps the original rule (host skips it; it would be the host
  // chasing its own forwarded heartbeat), so the host stays stable on its own
  // ticks while still following an authorized peer's explicit SHINKOU. No
  // oscillation: the server's ws.publish never echoes to the sender, and an apply
  // runs inside 追従中 so the induced local event is suppressed before broadcast.
  function handleRemote(msg: KousokuMessage) {
    // NTP-lite offset sampling: only server-stamped S→C envelopes carry the
    // server wall-clock (senderId === "server"). A SHINKOU is the host client's
    // ts forwarded via publish — that is the host's clock, not the server's, so
    // it must NOT feed the estimate. Sample before any early-out (harmless; keeps
    // the estimate warm regardless of role).
    if (msg.senderId === "server") {
      offsetEstimator.push(msg.ts - Date.now())
    }
    switch (msg.type) {
      case "SHINKOU":
        applyShinkou(msg.payload, msg.ts)
        break
      case "GENJOU":
        if (bushitsu.isBuchou) break // 房主は自身の心跳を追わない（原権威の安定性維持）
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
