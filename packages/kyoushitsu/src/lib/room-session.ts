import type { Bushitsu, Enmoku, KousokuMessage, NyuushitsuStatus } from "houkago-kousoku"
import { resolveEnmoku } from "./enmoku-resolve"

export type RoomSessionConnectionStatus = "connecting" | "open" | "closed" | "error"
export type RoomSessionAdmission = NyuushitsuStatus | "idle"
export type RoomResult = Bushitsu | null
export type BangumiResult = readonly Enmoku[] | null
export type MaybePromise<T> = T | PromiseLike<T>

export type RoomSessionTransport = {
  connect: (roomId: string) => void
  send: (message: KousokuMessage) => void
  close: () => void
}

export type RoomSessionDeps = {
  roomId: string
  identityKey: string
  createTransport: (
    onMessage: (message: KousokuMessage) => void,
    onStatus: (status: RoomSessionConnectionStatus) => void,
  ) => RoomSessionTransport
  fetchRoom: () => MaybePromise<RoomResult>
  fetchBangumi: () => MaybePromise<BangumiResult>
  applyMessage: (message: KousokuMessage) => void
  setRoom: (room: Bushitsu | null) => void
  setBangumi: (items: readonly Enmoku[]) => void
  getBangumi: () => readonly Enmoku[]
  getCurrentEnmokuId: () => string | null
  onCurrentEnmoku?: (enmoku: Enmoku | null) => void
  onStatus?: (status: RoomSessionConnectionStatus) => void
  onAdmission?: (status: RoomSessionAdmission) => void
  onRevoked?: () => void
  onAfterMessage?: (message: KousokuMessage) => void
  onError?: (error: unknown) => void
  resetRoom?: (roomId: string | null) => void
  isBuchou?: () => boolean
  senderId?: () => string
  now?: () => number
}

export type RoomSessionSnapshot = {
  sessionGeneration: number
  connectionEpoch: number
  queueRevision: number
  admission: RoomSessionAdmission
  started: boolean
  disposed: boolean
  hasTransport: boolean
}

function request<T>(factory: () => MaybePromise<T>): Promise<T> {
  try {
    return Promise.resolve(factory())
  } catch (error) {
    return Promise.reject(error)
  }
}

export class RoomSessionController {
  private transport: RoomSessionTransport | null = null
  private transportForCallbacks: RoomSessionTransport | null = null
  private started = false
  private disposed = false
  private admission: RoomSessionAdmission = "idle"
  private sessionGeneration = 0
  private connectionEpoch = 0
  private queueRevision = 0
  private currentRequestToken = 0
  private bootstrapStarted = false
  private skipNextConnecting = false
  private readonly now: () => number

  constructor(private readonly deps: RoomSessionDeps) {
    this.now = deps.now ?? Date.now
  }

  start(): boolean {
    if (this.started || this.disposed) return false
    this.started = true
    this.sessionGeneration += 1
    this.connectionEpoch = 0
    this.queueRevision = 0
    this.currentRequestToken += 1
    this.bootstrapStarted = false
    this.admission = "idle"
    this.deps.resetRoom?.(this.deps.roomId)
    if (!this.deps.resetRoom) {
      this.deps.setRoom(null)
      this.deps.setBangumi([])
    }
    this.deps.onCurrentEnmoku?.(null)
    this.deps.onAdmission?.("idle")

    let createdTransport: RoomSessionTransport | null = null
    const onMessage = (message: KousokuMessage) => {
      if (!createdTransport || !this.isCurrentTransport(createdTransport)) return
      this.receive(message)
    }
    const onStatus = (status: RoomSessionConnectionStatus) => {
      if (!createdTransport || !this.isCurrentTransport(createdTransport)) return
      this.receiveStatus(status)
    }

    try {
      createdTransport = this.deps.createTransport(onMessage, onStatus)
      this.transport = createdTransport
      this.transportForCallbacks = createdTransport
      this.connectTransport()
      return true
    } catch (error) {
      this.started = false
      this.transport = null
      this.transportForCallbacks = null
      this.skipNextConnecting = false
      this.deps.onError?.(error)
      this.deps.onStatus?.("error")
      return false
    }
  }

  reconnect(): boolean {
    if (!this.isActive() || !this.transport || this.admission === "revoked") return false
    this.connectTransport()
    return true
  }

  send(message: KousokuMessage): boolean {
    if (!this.isActive() || this.admission !== "entered" || !this.transport) return false
    this.transport.send(message)
    return true
  }

  getTransport(): RoomSessionTransport | null {
    return this.transport
  }

  getSnapshot(): RoomSessionSnapshot {
    return {
      sessionGeneration: this.sessionGeneration,
      connectionEpoch: this.connectionEpoch,
      queueRevision: this.queueRevision,
      admission: this.admission,
      started: this.started,
      disposed: this.disposed,
      hasTransport: this.transport !== null,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.sessionGeneration += 1
    this.connectionEpoch += 1
    this.currentRequestToken += 1
    this.bootstrapStarted = false
    this.admission = "idle"
    this.skipNextConnecting = false

    const transport = this.transport
    this.transport = null
    this.transportForCallbacks = null
    transport?.close()

    this.deps.resetRoom?.(null)
    if (!this.deps.resetRoom) {
      this.deps.setRoom(null)
      this.deps.setBangumi([])
    }
    this.deps.onCurrentEnmoku?.(null)
    this.deps.onAdmission?.("idle")
    this.deps.onStatus?.("closed")
  }

  private isActive(): boolean {
    return this.started && !this.disposed
  }

  private isCurrentTransport(transport: RoomSessionTransport): boolean {
    return (
      this.isActive() && this.transport === transport && this.transportForCallbacks === transport
    )
  }

  private connectTransport(): void {
    const transport = this.transport
    if (!transport || !this.isActive()) return
    this.beginConnectionEpoch()
    this.skipNextConnecting = true
    try {
      transport.connect(this.deps.roomId)
    } catch (error) {
      this.skipNextConnecting = false
      this.deps.onError?.(error)
      this.receiveStatus("error")
    }
  }

  private beginConnectionEpoch(): void {
    this.connectionEpoch += 1
    this.bootstrapStarted = false
    this.currentRequestToken += 1
    const wasAdmitted = this.admission === "entered"
    this.admission = "idle"
    if (wasAdmitted) this.deps.onAdmission?.("idle")
  }

  private receiveStatus(status: RoomSessionConnectionStatus): void {
    if (!this.isActive()) return
    if (status === "connecting") {
      if (this.skipNextConnecting) this.skipNextConnecting = false
      else this.beginConnectionEpoch()
    } else {
      // A transport may report closed/error before a later online-triggered
      // connecting callback. Do not let the one-shot marker for the explicit
      // connect() call suppress that new connection epoch.
      this.skipNextConnecting = false
      if (status === "closed" || status === "error") this.beginConnectionEpoch()
    }
    this.deps.onStatus?.(status)
  }

  private receive(message: KousokuMessage): void {
    if (!this.isActive()) return
    this.deps.applyMessage(message)
    this.deps.onAfterMessage?.(message)

    switch (message.type) {
      case "BANGUMI":
        this.queueRevision += 1
        if (this.admission === "entered" && this.deps.getCurrentEnmokuId()) {
          this.resolveCurrentEnmoku()
        }
        break
      case "NYUUSHITSU":
        if (message.senderId !== "server") break
        this.receiveAdmission(message.payload.status)
        break
      case "JOUEI":
      case "GENJOU":
        this.resolveCurrentEnmoku()
        break
      default:
        break
    }
  }

  private receiveAdmission(status: NyuushitsuStatus): void {
    if (!this.isActive()) return
    if (status === "entered") {
      this.admission = status
      this.deps.onAdmission?.(status)
      this.startBootstrap()
      return
    }

    if (this.admission === "entered") {
      this.connectionEpoch += 1
      this.currentRequestToken += 1
      this.bootstrapStarted = false
    }
    this.admission = status
    this.deps.onAdmission?.(status)
    if (status === "revoked") this.revoke()
  }

  private revoke(): void {
    if (!this.isActive()) return
    this.sessionGeneration += 1
    this.connectionEpoch += 1
    this.currentRequestToken += 1
    this.bootstrapStarted = false
    this.admission = "revoked"
    this.deps.onRevoked?.()

    const transport = this.transport
    this.transport = null
    this.transportForCallbacks = null
    transport?.close()
  }

  private isBootstrapCurrent(generation: number, epoch: number): boolean {
    return (
      this.isActive() &&
      this.admission === "entered" &&
      this.sessionGeneration === generation &&
      this.connectionEpoch === epoch
    )
  }

  private startBootstrap(): void {
    if (!this.isActive() || this.admission !== "entered" || this.bootstrapStarted) return
    this.bootstrapStarted = true
    const generation = this.sessionGeneration
    const epoch = this.connectionEpoch
    const revision = this.queueRevision
    const roomRequest = request(this.deps.fetchRoom)
    const bangumiRequest = request(this.deps.fetchBangumi)
    void this.finishBootstrap(generation, epoch, revision, roomRequest, bangumiRequest)
  }

  private async finishBootstrap(
    generation: number,
    epoch: number,
    revision: number,
    roomRequest: Promise<RoomResult>,
    bangumiRequest: Promise<BangumiResult>,
  ): Promise<void> {
    let room: RoomResult
    try {
      room = await roomRequest
    } catch (error) {
      if (this.isBootstrapCurrent(generation, epoch)) this.deps.onError?.(error)
      return
    }
    if (!this.isBootstrapCurrent(generation, epoch)) return
    const roomMatchesSession = room === null || room.id === this.deps.roomId
    if (roomMatchesSession && room) this.deps.setRoom(room)

    const isBuchou = this.deps.isBuchou
      ? this.deps.isBuchou()
      : roomMatchesSession &&
        room !== null &&
        room.buchouId === (this.deps.senderId?.() ?? this.deps.identityKey)
    if (!isBuchou) {
      this.send({
        type: "OIKAKE",
        ts: this.now(),
        senderId: this.deps.senderId?.() ?? this.deps.identityKey,
        payload: {},
      })
    }

    let bangumi: BangumiResult
    try {
      bangumi = await bangumiRequest
    } catch (error) {
      if (this.isBootstrapCurrent(generation, epoch)) this.deps.onError?.(error)
      return
    }
    if (!this.isBootstrapCurrent(generation, epoch) || this.queueRevision !== revision) return
    if (bangumi && !this.isBangumiForSession(bangumi)) return
    if (bangumi) this.deps.setBangumi(bangumi)
    this.resolveCurrentEnmoku()
  }

  private isBangumiForSession(bangumi: readonly Enmoku[]): boolean {
    return bangumi.every((item) => item.bushitsuId === this.deps.roomId)
  }

  private resolveCurrentEnmoku(): void {
    if (!this.isActive() || this.admission !== "entered") return
    const requestedId = this.deps.getCurrentEnmokuId()
    const token = ++this.currentRequestToken
    const generation = this.sessionGeneration
    const epoch = this.connectionEpoch
    const revision = this.queueRevision

    if (!requestedId) {
      this.deps.onCurrentEnmoku?.(null)
      return
    }

    const local = this.resolveLocalEnmoku(requestedId)
    if (local) {
      this.deps.onCurrentEnmoku?.(local)
      return
    }

    const bangumiRequest = request(this.deps.fetchBangumi)
    void bangumiRequest
      .then((bangumi) => {
        if (
          !this.isBootstrapCurrent(generation, epoch) ||
          this.currentRequestToken !== token ||
          this.queueRevision !== revision ||
          this.deps.getCurrentEnmokuId() !== requestedId
        ) {
          return
        }
        if (bangumi && !this.isBangumiForSession(bangumi)) return
        if (bangumi) this.deps.setBangumi(bangumi)
        const resolved = this.resolveLocalEnmoku(requestedId)
        this.deps.onCurrentEnmoku?.(resolved)
      })
      .catch((error: unknown) => {
        if (
          this.isBootstrapCurrent(generation, epoch) &&
          this.currentRequestToken === token &&
          this.deps.getCurrentEnmokuId() === requestedId
        ) {
          this.deps.onError?.(error)
        }
      })
  }

  private resolveLocalEnmoku(requestedId: string): Enmoku | null {
    const local = resolveEnmoku([...this.deps.getBangumi()], requestedId)
    return local?.bushitsuId === this.deps.roomId ? local : null
  }
}

export function createRoomSessionController(deps: RoomSessionDeps): RoomSessionController {
  return new RoomSessionController(deps)
}

export const createRoomSession = createRoomSessionController
