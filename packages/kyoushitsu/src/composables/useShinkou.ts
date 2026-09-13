import type { PlayerHandle } from "@/lib/player"
import { createShinkouController } from "@/lib/shinkou-controller"
import { useBushitsuStore } from "@/stores/bushitsu"
import type { KousokuMessage } from "houkago-kousoku"
import { type Ref, getCurrentInstance, onBeforeUnmount } from "vue"

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

export type { PlayerHandle } from "@/lib/player"

export function useShinkou(
  send: (message: KousokuMessage) => void,
  player: Ref<PlayerHandle | null>,
) {
  const bushitsu = useBushitsuStore()
  const controller = createShinkouController({
    send,
    getPlayer: () => player.value,
    canControl: () => bushitsu.canControl,
    isBuchou: () => bushitsu.isBuchou,
    senderId: () => bushitsu.senderId,
    getAuthoritativeState: () => ({
      shinkou: bushitsu.shinkou,
      serverTime: bushitsu.shinkouServerTime,
    }),
  })
  if (getCurrentInstance()) onBeforeUnmount(controller.dispose)
  return controller
}
