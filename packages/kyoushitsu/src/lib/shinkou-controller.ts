import { createOffsetEstimator } from "@/lib/clock-offset"
import type { PlayerHandle } from "@/lib/player"
import { zureHosei } from "@/lib/zure"
import type { KousokuMessage, Shinkou } from "houkago-kousoku"

const TSUIJUU_MS = 200

export type ShinkouAuthoritativeState = {
  shinkou: Shinkou | null
  serverTime: number
}

export type ShinkouControllerOptions = {
  send: (message: KousokuMessage) => void
  getPlayer: () => PlayerHandle | null
  canControl: () => boolean
  isBuchou: () => boolean
  senderId: () => string
  getAuthoritativeState: () => ShinkouAuthoritativeState
  now?: () => number
  schedule?: (task: () => void, delayMs: number) => unknown
  cancelSchedule?: (handle: unknown) => void
}

export type ShinkouController = {
  onLocalShinkou: (state: Shinkou) => void
  handleRemote: (message: KousokuMessage) => void
  catchUp: () => void
  dispose: () => void
}

function projected(state: Shinkou, serverTime: number, offset: number, now: () => number): number {
  const serverNow = now() + offset
  const elapsed = state.isPlaying ? (serverNow - serverTime) / 1000 : 0
  return state.currentTime + elapsed * state.playbackRate
}

export function createShinkouController(options: ShinkouControllerOptions): ShinkouController {
  const now = options.now ?? Date.now
  const schedule = options.schedule ?? ((task, delayMs) => setTimeout(task, delayMs))
  const cancelSchedule =
    options.cancelSchedule ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))
  const offsetEstimator = createOffsetEstimator()
  let tsuijuuChuu = false
  let nudging = false
  let disposed = false
  let suppressionTimer: unknown = null
  let suppressionVersion = 0

  function suppressed(fn: (player: PlayerHandle) => void): void {
    if (disposed) return
    const player = options.getPlayer()
    if (!player) return
    tsuijuuChuu = true
    fn(player)
    const version = ++suppressionVersion
    if (suppressionTimer !== null) cancelSchedule(suppressionTimer)
    suppressionTimer = schedule(() => {
      if (disposed || version !== suppressionVersion) return
      tsuijuuChuu = false
      suppressionTimer = null
    }, TSUIJUU_MS)
  }

  function onLocalShinkou(state: Shinkou): void {
    if (disposed || !options.canControl() || tsuijuuChuu) return
    options.send({
      type: "SHINKOU",
      ts: now(),
      senderId: options.senderId(),
      payload: state,
    })
  }

  function applyShinkou(state: Shinkou, serverTime: number): void {
    if (disposed) return
    nudging = false
    suppressed((player) => {
      player.apply({
        ...state,
        currentTime: projected(state, serverTime, offsetEstimator.estimate(), now),
      })
    })
  }

  function applyGenjou(state: Shinkou, serverTime: number): void {
    if (disposed) return
    const player = options.getPlayer()
    if (!player) return
    const local = player.snapshot()
    const remote = projected(state, serverTime, offsetEstimator.estimate(), now)
    const zure = Math.abs(local.currentTime - remote)
    const behind = local.currentTime < remote
    const decision = zureHosei(zure, behind, state.isPlaying, state.playbackRate)

    suppressed((currentPlayer) => {
      currentPlayer.alignTransport(state)
      switch (decision.kind) {
        case "seek":
          currentPlayer.apply({ ...state, currentTime: remote })
          nudging = false
          break
        case "nudge":
          currentPlayer.setRate(decision.rate)
          nudging = true
          break
        case "ignore":
          if (nudging) {
            currentPlayer.setRate(state.playbackRate)
            nudging = false
          }
          break
      }
    })
  }

  function handleRemote(message: KousokuMessage): void {
    if (disposed) return
    if (message.senderId === "server") offsetEstimator.push(message.ts - now())
    switch (message.type) {
      case "SHINKOU":
        applyShinkou(message.payload, message.ts)
        break
      case "GENJOU":
        if (options.isBuchou()) return
        applyGenjou(message.payload.shinkou, message.payload.serverTime)
        break
      default:
        break
    }
  }

  function catchUp(): void {
    if (disposed || options.isBuchou()) return
    const authoritative = options.getAuthoritativeState()
    if (!authoritative.shinkou) return
    applyShinkou(authoritative.shinkou, authoritative.serverTime)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    suppressionVersion += 1
    if (suppressionTimer !== null) {
      cancelSchedule(suppressionTimer)
      suppressionTimer = null
    }
    tsuijuuChuu = false
    nudging = false
  }

  return { onLocalShinkou, handleRemote, catchUp, dispose }
}
