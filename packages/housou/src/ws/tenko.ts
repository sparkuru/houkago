import { activeRooms, roomTopic, serverMsg } from "./housou"
import { shinkouSeigyo } from "./shinkou"

// 点呼（tenko）: periodic authority-clock heartbeat (design §5). A single global
// timer beats every active room that has real authority state, broadcasting a
// GENJOU whose currentTime is the projected progress at `now`. 部員 compare it
// against their local position and zure-correct (drift tiers, next slice).
//
// The heartbeat reuses GENJOU rather than a new message: a periodic authority
// snapshot and an OIKAKE catch-up are the same "current state, downstream" —
// late joiners and drifting members converge on one path (prd ADR-lite). The
// tick source is the server authority clock, not the host tab, so sync holds
// even when the 部長 backgrounds their tab (Elysia spike #781: non-WS context
// may app.server?.publish).

const DEFAULT_INTERVAL_MS = 4000

// Only the publish capability of the running Bun server is needed here. Typing
// the parameter to this slice avoids coupling to Elysia's full app generics
// (which differ once routes are composed) and the index.ts import cycle.
type Publisher = { server?: { publish(topic: string, data: string): unknown } | null }

// Start the heartbeat; returns a stop handle (clearInterval) so callers — and
// tests — never leak the timer. Started only from import.meta.main in index.ts.
export function startTenko(app: Publisher, intervalMs = DEFAULT_INTERVAL_MS): () => void {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const bushitsuId of activeRooms()) {
      // Skip rooms that have never been driven — no default paused spam.
      if (!shinkouSeigyo.has(bushitsuId)) continue
      const { enmokuId, shinkou } = shinkouSeigyo.genjou(bushitsuId)
      const msg = serverMsg("GENJOU", {
        enmokuId,
        shinkou: { ...shinkou, currentTime: shinkouSeigyo.projected(bushitsuId, now) },
        serverTime: now,
      })
      app.server?.publish(roomTopic(bushitsuId), JSON.stringify(msg))
    }
  }, intervalMs)

  return () => clearInterval(timer)
}
