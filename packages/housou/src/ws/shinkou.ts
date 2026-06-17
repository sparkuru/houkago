import type { Shinkou } from "houkago-kousoku"
import { NotBuchou } from "../lib/errors"

// ShinkouSeigyo（進行制御）: server-side authority state for the sync core.
// Holds the last authoritative Shinkou + its receive time per 部室 and projects
// progress for late joiners (OIKAKE → GENJOU). Host-authority is enforced here:
// only the room's 部長 may record a Shinkou (design §5). Drift tiers (TENKO /
// zure) are the next slice — TENKO stays a no-op for now.

type AuthorityState = {
  enmokuId: string | null
  shinkou: Shinkou
  shinkouServerTime: number // server wall-clock when this Shinkou was received
}

const DEFAULT_SHINKOU: Shinkou = { isPlaying: false, currentTime: 0, playbackRate: 1 }

export class ShinkouSeigyo {
  private state = new Map<string, AuthorityState>()

  // True once a 部長 has driven this room. The heartbeat (tenko) only beats
  // rooms that have real authority state — never a room that has never played,
  // so it does not spam a default paused GENJOU.
  has(bushitsuId: string): boolean {
    return this.state.has(bushitsuId)
  }

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

  // Record an authoritative Shinkou. Only the room's 部長 may drive sync — a
  // non-host sender is rejected with NotBuchou (design §5), which the WS handler
  // maps to a KEIHOU back to that sender. Pure + in-memory so the authority gate
  // and recording are unit-testable without a socket. `now` is injectable for
  // deterministic projected-progress tests.
  //
  // SHINKOU is transport-only (play/pause/seek/rate) and must NOT clear the
  // current 演目: enmokuId is set by JOUEI, not here. Passing null/undefined
  // preserves the existing enmokuId so a play/pause does not drop the source.
  shinkou(
    bushitsuId: string,
    shinkou: Shinkou,
    enmokuId: string | null,
    senderId: string,
    buchouId: string,
    now = Date.now(),
  ): void {
    if (senderId !== buchouId) throw new NotBuchou("only 部長 may control playback")
    const prev = this.state.get(bushitsuId)
    this.state.set(bushitsuId, {
      enmokuId: enmokuId ?? prev?.enmokuId ?? null,
      shinkou,
      shinkouServerTime: now,
    })
  }

  // 上映：set the room's current 演目 (design §6). Only the 部長 may drive sync, so
  // only the 部長 may pick the source — non-host is rejected with NotBuchou
  // (→ KEIHOU). A source switch resets transport to a fresh paused state; reusing
  // the previous source's play/time state would make followers autoplay or seek
  // into the new media before the driver intentionally starts it.
  jouei(
    bushitsuId: string,
    enmokuId: string,
    senderId: string,
    buchouId: string,
    now = Date.now(),
  ): void {
    if (senderId !== buchouId) throw new NotBuchou("only 部長 may control playback")
    this.state.set(bushitsuId, {
      enmokuId,
      shinkou: DEFAULT_SHINKOU,
      shinkouServerTime: now,
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
