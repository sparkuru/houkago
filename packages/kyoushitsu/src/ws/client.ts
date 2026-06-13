import type { KousokuMessage } from "houkago-kousoku"

// WS client skeleton (frontend/directory-structure: the hard part lives in
// src/ws/). SCAFFOLD STAGE: connect to /ws, send/receive kousoku envelopes,
// decode incoming into the store. The sync algorithm (echo suppression /
// tsuijuuChuu, OIKAKE→GENJOU catch-up, drift tiers) is the P0 task — NOT here.

type OnMessage = (msg: KousokuMessage) => void

export class KousokuClient {
  private ws: WebSocket | null = null

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
    this.ws = ws
  }

  // 放送：send a client-originated envelope to housou.
  send(msg: KousokuMessage): void {
    this.ws?.send(JSON.stringify(msg))
  }

  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
