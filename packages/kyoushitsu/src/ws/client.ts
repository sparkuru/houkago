import type { KousokuMessage } from "houkago-kousoku"

// WS client skeleton (frontend/directory-structure: the hard part lives in
// src/ws/). SCAFFOLD STAGE: connect to /ws, send/receive kousoku envelopes,
// decode incoming into the store. The sync algorithm (echo suppression /
// tsuijuuChuu, OIKAKE→GENJOU catch-up, drift tiers) is the P0 task — NOT here.

type OnMessage = (msg: KousokuMessage) => void
export type KousokuConnectionStatus = "connecting" | "open" | "closed" | "error"
type OnStatus = (status: KousokuConnectionStatus) => void

type ConnectParams = {
  bushitsuId: string
  senderId: string
  nickname?: string
}

type ReconnectOptions = {
  minDelayMs?: number
  maxDelayMs?: number
}

const DEFAULT_RECONNECT_MIN_DELAY_MS = 500
const DEFAULT_RECONNECT_MAX_DELAY_MS = 8_000

export class KousokuClient {
  private ws: WebSocket | null = null
  // CONNECTING(0)→OPEN(1) 窓だけを埋める送信バッファ。open で FIFO flush。
  // 跨重連の持久化はしない（prd: Out of Scope）。
  private sendQueue: string[] = []
  private connectParams: ConnectParams | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private shouldReconnect = false
  private networkListenersBound = false
  private readonly minReconnectDelayMs: number
  private readonly maxReconnectDelayMs: number

  constructor(
    private readonly baseUrl: string,
    private readonly onMessage: OnMessage,
    private readonly onStatus: OnStatus = () => {},
    reconnect: ReconnectOptions = {},
  ) {
    this.minReconnectDelayMs = reconnect.minDelayMs ?? DEFAULT_RECONNECT_MIN_DELAY_MS
    this.maxReconnectDelayMs = reconnect.maxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS
  }

  connect(bushitsuId: string, senderId: string, nickname?: string): void {
    const oldWs = this.ws
    this.ws = null
    oldWs?.close()
    this.sendQueue = []
    this.connectParams = { bushitsuId, senderId, nickname }
    this.shouldReconnect = true
    this.reconnectAttempt = 0
    this.clearReconnectTimer()
    this.bindNetworkListeners()
    if (this.isBrowserOffline()) {
      this.onStatus("closed")
      return
    }
    this.openSocket()
  }

  private openSocket(): void {
    const params = this.connectParams
    if (!params) return
    this.onStatus("connecting")
    const url = new URL(this.baseUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.pathname = "/ws"
    url.searchParams.set("bushitsuId", params.bushitsuId)
    url.searchParams.set("senderId", params.senderId)
    // nickname rides the connect query so housou's open() has it atomically (prd Decision §1).
    if (params.nickname) url.searchParams.set("nickname", params.nickname)

    const ws = new WebSocket(url)
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data) as KousokuMessage
      this.onMessage(msg)
    })
    ws.addEventListener("open", () => {
      this.reconnectAttempt = 0
      this.onStatus("open")
      this.flush()
    })
    ws.addEventListener("error", () => {
      this.onStatus("error")
    })
    ws.addEventListener("close", () => {
      if (this.ws !== ws) return
      this.ws = null
      this.sendQueue = []
      this.onStatus("closed")
      this.scheduleReconnect()
    })
    this.ws = ws
  }

  // 放送：send a client-originated envelope to housou.
  // OPEN なら即送、CONNECTING ならバッファ、CLOSING/CLOSED/null なら安全に破棄。
  // CONNECTING 中の send() は DOMException(InvalidStateError) を投げるため必ず分岐する。
  send(msg: KousokuMessage): void {
    const ws = this.ws
    if (!ws) return
    const data = JSON.stringify(msg)
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    } else if (ws.readyState === WebSocket.CONNECTING) {
      this.sendQueue.push(data)
    }
  }

  private flush(): void {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const queued = this.sendQueue
    this.sendQueue = []
    for (const data of queued) {
      ws.send(data)
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) return
    if (this.isBrowserOffline()) return
    const delay = Math.min(
      this.minReconnectDelayMs * 2 ** this.reconnectAttempt,
      this.maxReconnectDelayMs,
    )
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.shouldReconnect) return
      this.openSocket()
    }, delay)
  }

  private dropSocketForReconnect(): void {
    const ws = this.ws
    if (!ws) return
    this.ws = null
    this.sendQueue = []
    this.onStatus("closed")
    ws.close()
    this.scheduleReconnect()
  }

  private readonly onBrowserOffline = (): void => {
    if (!this.shouldReconnect) return
    this.dropSocketForReconnect()
  }

  private readonly onBrowserOnline = (): void => {
    if (!this.shouldReconnect || this.ws) return
    this.clearReconnectTimer()
    this.openSocket()
  }

  private bindNetworkListeners(): void {
    if (this.networkListenersBound || typeof window === "undefined") return
    window.addEventListener("offline", this.onBrowserOffline)
    window.addEventListener("online", this.onBrowserOnline)
    this.networkListenersBound = true
  }

  private unbindNetworkListeners(): void {
    if (!this.networkListenersBound || typeof window === "undefined") return
    window.removeEventListener("offline", this.onBrowserOffline)
    window.removeEventListener("online", this.onBrowserOnline)
    this.networkListenersBound = false
  }

  private isBrowserOffline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine === false
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  close(): void {
    this.shouldReconnect = false
    this.clearReconnectTimer()
    this.unbindNetworkListeners()
    const ws = this.ws
    this.ws = null
    ws?.close()
    this.sendQueue = []
    this.onStatus("closed")
  }
}
