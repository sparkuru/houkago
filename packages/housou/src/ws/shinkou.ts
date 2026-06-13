import type { Shinkou } from "houkago-kousoku"

// ShinkouSeigyo（進行制御）: server-side authority state for the sync core.
// SCAFFOLD STAGE — this holds the last authoritative Shinkou + its receive time
// per 部室 and projects progress for late-joiners (OIKAKE → GENJOU). The full
// P0 sync state machine (host-authority enforcement on SHINKOU, drift tiers,
// echo handling) is the next task; the hooks are marked below.

type AuthorityState = {
  enmokuId: string | null
  shinkou: Shinkou
  shinkouServerTime: number // server wall-clock when this Shinkou was received
}

const DEFAULT_SHINKOU: Shinkou = { isPlaying: false, currentTime: 0, playbackRate: 1 }

export class ShinkouSeigyo {
  private state = new Map<string, AuthorityState>()

  // Authoritative state for a room, defaulting to a fresh paused state.
  genjou(bushitsuId: string): AuthorityState {
    return (
      this.state.get(bushitsuId) ?? {
        enmokuId: null,
        shinkou: DEFAULT_SHINKOU,
        shinkouServerTime: Date.now(),
      }
    )
  }

  // Record an authoritative Shinkou. P0 TODO: only accept from the room's 部長
  // (NotBuchou otherwise); broadcast SHINKOU to room:<bushitsuId>.
  shinkou(bushitsuId: string, shinkou: Shinkou, enmokuId: string | null): void {
    this.state.set(bushitsuId, {
      enmokuId,
      shinkou,
      shinkouServerTime: Date.now(),
    })
  }

  // 追いかけ projected progress for a late joiner (design §5).
  projected(bushitsuId: string, now = Date.now()): number {
    const { shinkou, shinkouServerTime } = this.genjou(bushitsuId)
    if (!shinkou.isPlaying) return shinkou.currentTime
    return shinkou.currentTime + ((now - shinkouServerTime) / 1000) * shinkou.playbackRate
  }
}

export const shinkouSeigyo = new ShinkouSeigyo()
