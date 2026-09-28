import type {
  Bushitsu,
  DanmakuDefault,
  Enmoku,
  Kengen,
  KousokuMessage,
  MeiboBuin,
  NyuushitsuMode,
  NyuushitsuRequest,
  Shinkou,
  Yakuwari,
} from "houkago-kousoku"
import {
  clearPendingRoomBangumi,
  createRoomEnmoku,
  deleteRoomEnmoku,
  deleteRoomMember,
  fetchRoom,
  fetchRoomBangumi,
  moveRoomBangumi,
  previewRoomEnmoku,
} from "houkago-kyoushitsu/http"
import { canDo } from "houkago-kyoushitsu/kengen"
import type { PlayerHandle } from "houkago-kyoushitsu/player"
import {
  type RoomSessionAdmission,
  type RoomSessionConnectionStatus,
  type RoomSessionTransport,
  createRoomSessionController,
} from "houkago-kyoushitsu/room-session"
import { createShinkouController } from "houkago-kyoushitsu/shinkou-controller"
import { KousokuClient } from "houkago-kyoushitsu/ws-client"

export type ChatLine = { senderId: string; content: string; ts: number; kind: "chat" | "danmaku" }
type RoomCommandType =
  | "OSHABERI"
  | "DANMAKU"
  | "JOUEI"
  | "SETTEI"
  | "NYUUSHITSU_SETTEI"
  | "NYUUSHITSU_HANTEI"
type RoomCommandMessage = {
  [T in RoomCommandType]: {
    type: T
    payload: Extract<KousokuMessage, { type: T }>["payload"]
  }
}[RoomCommandType]
type PendingReply =
  | { kind: "permissions"; value: Kengen }
  | { kind: "admission"; mode: NyuushitsuMode }
  | { kind: "decision"; senderId: string }
export type RoomState = {
  room: Bushitsu | null
  queue: readonly Enmoku[]
  currentId: string | null
  current: Enmoku | null
  playback: Shinkou | null
  playbackServerTime: number
  danmakuDefaults: Readonly<Record<string, DanmakuDefault>>
  danmakuDefaultsAuthoritative: boolean
  admission: RoomSessionAdmission
  connection: RoomSessionConnectionStatus
  permissions: Kengen
  mode: NyuushitsuMode
  pending: readonly NyuushitsuRequest[]
  members: readonly { id: string; nickname: string; yakuwari: Yakuwari }[]
  meibo: readonly MeiboBuin[]
  names: Readonly<Record<string, string>>
  chat: readonly ChatLine[]
  notice: string | null
  command: string | null
  error: string | null
}

const initialState: RoomState = {
  room: null,
  queue: [],
  currentId: null,
  current: null,
  playback: null,
  playbackServerTime: 0,
  danmakuDefaults: {},
  danmakuDefaultsAuthoritative: false,
  admission: "idle",
  connection: "connecting",
  permissions: { playback: false, chat: true, playlist: false },
  mode: "open",
  pending: [],
  members: [],
  meibo: [],
  names: {},
  chat: [],
  notice: null,
  command: null,
  error: null,
}

export type RoomServices = {
  transport: (
    onMessage: (message: KousokuMessage) => void,
    onStatus: (status: RoomSessionConnectionStatus) => void,
  ) => RoomSessionTransport
  room: typeof fetchRoom
  queue: typeof fetchRoomBangumi
}

export class RoomRuntime {
  private state: RoomState = initialState
  private listeners = new Set<() => void>()
  private abort = new AbortController()
  private disposed = false
  private pendingReply: PendingReply | null = null
  private commandController: AbortController | null = null
  private player: PlayerHandle | null = null
  private playbackController = createShinkouController({
    send: (message) => {
      if (message.type === "SHINKOU" && this.can("playback")) this.session.send(message)
    },
    getPlayer: () => this.player,
    canControl: () => this.can("playback"),
    isBuchou: () => this.isHost,
    senderId: () => this.identityId,
    getAuthoritativeState: () => ({
      shinkou: this.state.playback,
      serverTime: this.state.playbackServerTime,
    }),
  })
  private session

  constructor(
    readonly roomId: string,
    readonly identityId: string,
    private readonly onRevoked: () => void,
    services: RoomServices = {
      transport: (onMessage, onStatus) =>
        new KousokuClient(
          import.meta.env.VITE_HOUSOU_URL ?? `http://${location.hostname}:3000`,
          onMessage,
          onStatus,
        ),
      room: fetchRoom,
      queue: fetchRoomBangumi,
    },
  ) {
    this.session = createRoomSessionController({
      roomId,
      identityKey: identityId,
      senderId: () => identityId,
      createTransport: (onMessage, onStatus) => services.transport(onMessage, onStatus),
      fetchRoom: () => services.room(roomId, { signal: this.abort.signal }),
      fetchBangumi: () => services.queue(roomId, { signal: this.abort.signal }),
      applyMessage: (message) => this.apply(message),
      resetRoom: () => this.update({ ...initialState }),
      setRoom: (room) => this.update({ room }),
      setBangumi: (queue) =>
        this.update({ queue: [...new Map(queue.map((item) => [item.id, item])).values()] }),
      getBangumi: () => this.state.queue,
      getCurrentEnmokuId: () => this.state.currentId,
      onCurrentEnmoku: (current) => this.update({ current }),
      onStatus: (connection) => {
        this.update({ connection })
        if (connection === "closed" || connection === "error") this.clearCommandPending()
      },
      onAdmission: (admission) => {
        this.update({ admission })
        if (admission !== "entered") this.clearCommandPending()
      },
      onRevoked: () => {
        this.abort.abort()
        this.onRevoked()
      },
      onError: (error) =>
        this.update({ error: error instanceof Error ? error.message : "Room request failed" }),
      onAfterMessage: (message) => {
        this.playbackController.handleRemote(message)
        if (message.senderId === "server" && this.matchesPendingReply(message))
          this.clearCommandPending()
        if (message.type === "KEIHOU") {
          this.clearCommandPending()
          this.update({ error: message.payload.message })
        }
      },
    })
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  readonly getSnapshot = () => this.state
  attachPlayer(player: PlayerHandle): () => void {
    if (this.disposed) return () => {}
    this.player = player
    return () => {
      if (this.player === player) this.player = null
    }
  }
  localPlayback(state: Shinkou): void {
    this.playbackController.onLocalShinkou(state)
  }
  userPlayback(state: Shinkou): void {
    this.playbackController.onUserShinkou(state)
  }
  catchUpPlayback(): void {
    this.playbackController.catchUp()
  }
  start() {
    return this.session.start()
  }
  reconnect() {
    this.clearCommandPending()
    return this.session.reconnect()
  }
  get isHost() {
    return this.state.room?.buchouId === this.identityId
  }
  can(action: keyof Kengen) {
    return (
      this.state.admission === "entered" &&
      this.state.connection === "open" &&
      canDo(this.isHost, this.state.permissions, action)
    )
  }
  private update(next: Partial<RoomState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }
  private clearCommandPending() {
    this.pendingReply = null
    this.commandController?.abort()
    this.commandController = null
    if (this.state.command) this.update({ command: null })
  }
  private matchesPendingReply(message: KousokuMessage): boolean {
    const reply = this.pendingReply
    if (!reply) return false
    if (reply.kind === "permissions" && message.type === "KENGEN")
      return (Object.keys(reply.value) as (keyof Kengen)[]).every(
        (key) => message.payload[key] === reply.value[key],
      )
    if (reply.kind === "admission" && message.type === "NYUUSHITSU")
      return message.payload.mode === reply.mode
    if (reply.kind === "decision" && message.type === "NYUUSHITSU")
      return !message.payload.pending.some((request) => request.senderId === reply.senderId)
    return false
  }
  private apply(message: KousokuMessage) {
    switch (message.type) {
      case "NYUUSHITSU":
        this.update({ mode: message.payload.mode, pending: message.payload.pending })
        break
      case "KENGEN":
        this.update({ permissions: message.payload })
        break
      case "BANGUMI":
        this.update({
          queue: [...new Map(message.payload.enmoku.map((item) => [item.id, item])).values()],
        })
        break
      case "JOUEI":
        // The server resets transport when it accepts a new programme. Clear the
        // previous item's progress before a new player can mount and catch up.
        this.update({
          currentId: message.payload.enmokuId,
          playback: { isPlaying: false, currentTime: 0, playbackRate: 1 },
          playbackServerTime: message.ts,
        })
        break
      case "GENJOU":
        this.update({
          currentId: message.payload.enmokuId,
          playback: message.payload.shinkou,
          playbackServerTime: message.payload.serverTime,
        })
        break
      case "SHINKOU":
        this.update({ playback: message.payload, playbackServerTime: message.ts })
        break
      case "DANMAKU_DEFAULT":
        if (message.payload.bushitsuId !== this.roomId) break
        this.update({
          danmakuDefaults: Object.fromEntries(
            message.payload.defaults.map((item) => [item.enmokuId, item]),
          ),
          danmakuDefaultsAuthoritative: true,
        })
        break
      case "SHUSSEKI": {
        const names = { ...this.state.names }
        for (const member of message.payload.members) names[member.id] = member.nickname
        this.update({ members: message.payload.members, names })
        break
      }
      case "MEIBO":
        this.update({ meibo: message.payload.members })
        break
      case "OSHABERI":
      case "DANMAKU":
        this.update({
          chat: [
            ...this.state.chat.slice(-199),
            {
              senderId: message.senderId,
              content: message.payload.content,
              ts: message.ts,
              kind: message.type === "DANMAKU" ? "danmaku" : "chat",
            },
          ],
        })
        break
      case "KEIHOU":
        this.update({ notice: message.payload.message })
        break
    }
  }
  private send(message: RoomCommandMessage): boolean {
    if (this.state.admission !== "entered" || this.state.connection !== "open") return false
    return this.session.send({
      ...message,
      ts: Date.now(),
      senderId: this.identityId,
    })
  }
  private message(message: RoomCommandMessage, action: keyof Kengen | "host") {
    if (this.state.command || (action === "host" ? !this.isHost : !this.can(action))) {
      this.update({ error: "Action unavailable" })
      return false
    }
    const sent = this.send(message)
    if (!sent) this.update({ error: "Room connection is unavailable" })
    else this.update({ error: null })
    return sent
  }
  chat(content: string) {
    return this.message({ type: "OSHABERI", payload: { content } }, "chat")
  }
  danmaku(content: string) {
    return this.message({ type: "DANMAKU", payload: { content } }, "chat")
  }
  select(enmokuId: string | null) {
    return this.message({ type: "JOUEI", payload: { enmokuId } }, "playlist")
  }
  setPermissions(permissions: Kengen) {
    if (this.message({ type: "SETTEI", payload: permissions }, "host")) {
      this.pendingReply = { kind: "permissions", value: permissions }
      this.update({ command: "permissions" })
    }
  }
  setAdmission(mode: NyuushitsuMode, password?: string) {
    if (
      this.message(
        {
          type: "NYUUSHITSU_SETTEI",
          payload: password === undefined ? { mode } : { mode, password },
        },
        "host",
      )
    ) {
      this.pendingReply = { kind: "admission", mode }
      this.update({ command: "admission" })
    }
  }
  decide(senderId: string, approved: boolean) {
    if (this.message({ type: "NYUUSHITSU_HANTEI", payload: { senderId, approved } }, "host")) {
      this.pendingReply = { kind: "decision", senderId }
      this.update({ command: "decision" })
    }
  }
  async command<T>(
    name: string,
    action: keyof Kengen | "host",
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    if (
      this.state.command ||
      this.state.admission !== "entered" ||
      this.state.connection !== "open" ||
      (action === "host" ? !this.isHost : !this.can(action))
    ) {
      this.update({ error: "Action unavailable" })
      return
    }
    const controller = new AbortController()
    const abortCommand = () => controller.abort()
    this.abort.signal.addEventListener("abort", abortCommand, { once: true })
    this.commandController = controller
    this.update({ command: name, error: null })
    try {
      const result = await work(controller.signal)
      return controller.signal.aborted ? undefined : result
    } catch (error) {
      if (!this.disposed && !controller.signal.aborted)
        this.update({ error: error instanceof Error ? error.message : "Request failed" })
    } finally {
      this.abort.signal.removeEventListener("abort", abortCommand)
      if (this.commandController === controller) this.commandController = null
      if (!this.disposed && this.state.command === name) this.update({ command: null })
    }
  }
  preview(url: string, title?: string) {
    return this.command("preview", "playlist", (signal) =>
      previewRoomEnmoku(this.roomId, url, title, { signal }),
    )
  }
  add(url: string, title?: string) {
    return this.command("add", "playlist", (signal) =>
      createRoomEnmoku(this.roomId, url, title, { signal }),
    )
  }
  move(id: string, direction: "up" | "down") {
    return this.command("move", "host", (signal) =>
      moveRoomBangumi(this.roomId, id, direction, { signal }),
    )
  }
  delete(id: string) {
    return this.command("delete", "playlist", (signal) =>
      deleteRoomEnmoku(this.roomId, id, { signal }),
    )
  }
  clearPending() {
    return this.command("clear", "host", (signal) =>
      clearPendingRoomBangumi(this.roomId, { signal }),
    )
  }
  removeMember(id: string) {
    return this.command("remove", "host", (signal) => deleteRoomMember(this.roomId, id, { signal }))
  }
  dispose() {
    if (this.disposed) return
    this.clearCommandPending()
    this.abort.abort()
    this.playbackController.dispose()
    this.player = null
    this.session.dispose()
    this.disposed = true
    this.listeners.clear()
  }
}
