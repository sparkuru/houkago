import type { KousokuMessage } from "houkago-kousoku"

// WS client skeleton (frontend/directory-structure: the hard part lives in
// src/ws/). SCAFFOLD STAGE: connect to /ws, send/receive kousoku envelopes,
// decode incoming into the store. The sync algorithm (echo suppression /
// tsuijuuChuu, OIKAKE→GENJOU catch-up, drift tiers) is the P0 task — NOT here.

type OnMessage = (msg: KousokuMessage) => void

export class KousokuClient {
  private ws: WebSocket | null = null
  // CONNECTING(0)→OPEN(1) 窓だけを埋める送信バッファ。open で FIFO flush。
  // 跨重連の持久化はしない（prd: Out of Scope）。
  private sendQueue: string[] = []

  constructor(
    private readonly baseUrl: string,
    private readonly onMessage: OnMessage,
  ) {}

  connect(bushitsuId: string, senderId: string): void {
    const url = new URL(this.baseUrl)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    url.pathname = "/ws"
    url.searchParams.set("bushitsuId", bushitsuId)
    url.searchParams.set("senderId", senderId)

    const ws = new WebSocket(url)
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data) as KousokuMessage
      this.onMessage(msg)
    })
    ws.addEventListener("open", () => {
      this.flush()
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

  close(): void {
    this.ws?.close()
    this.ws = null
    this.sendQueue = []
  }
}
