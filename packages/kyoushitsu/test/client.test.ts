import { afterEach, beforeEach, expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { KousokuClient } from "../src/ws/client"

// WS send バッファのテスト：CONNECTING(0) で send() すると DOMException(InvalidStateError)
// が投げられ JOUEI が下発されず放映が断する回帰の防止（prd: ws-send-client-send-flush）。
// 純ロジック検証のため globalThis.WebSocket をモックし readyState/open を手動制御する。

const READY = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 } as const

type OpenHandler = () => void
type EventHandler = () => void

class MockWebSocket {
  static readonly CONNECTING = READY.CONNECTING
  static readonly OPEN = READY.OPEN
  static readonly CLOSING = READY.CLOSING
  static readonly CLOSED = READY.CLOSED

  static last: MockWebSocket | null = null

  readyState: number = READY.CONNECTING
  sent: string[] = []
  closed = false
  private openHandlers: OpenHandler[] = []
  private closeHandlers: EventHandler[] = []
  private errorHandlers: EventHandler[] = []

  constructor(public readonly url: string | URL) {
    MockWebSocket.last = this
  }

  addEventListener(type: string, handler: (ev: unknown) => void): void {
    if (type === "open") this.openHandlers.push(handler as OpenHandler)
    if (type === "close") this.closeHandlers.push(handler as EventHandler)
    if (type === "error") this.errorHandlers.push(handler as EventHandler)
  }

  // テスト用：接続完了をシミュレートし open を発火。
  fireOpen(): void {
    this.readyState = READY.OPEN
    for (const h of this.openHandlers) h()
  }

  fireError(): void {
    for (const h of this.errorHandlers) h()
  }

  send(data: string): void {
    if (this.readyState !== READY.OPEN) {
      throw new Error("InvalidStateError: object is not, or is no longer, usable")
    }
    this.sent.push(data)
  }

  close(): void {
    this.closed = true
    this.readyState = READY.CLOSING
    for (const h of this.closeHandlers) h()
  }
}

const oshaberi = (content: string): KousokuMessage => ({
  type: "OSHABERI",
  ts: 0,
  senderId: "b1",
  payload: { content },
})

const savedWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket

beforeEach(() => {
  MockWebSocket.last = null
  ;(globalThis as { WebSocket: unknown }).WebSocket = MockWebSocket
})

afterEach(() => {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = savedWebSocket
})

function makeClient(): { client: KousokuClient; ws: MockWebSocket } {
  const client = new KousokuClient("http://x", () => {})
  client.connect("rA", "b1")
  const ws = MockWebSocket.last
  if (!ws) throw new Error("mock ws not created")
  return { client, ws }
}

function makeClientWithStatus(): {
  client: KousokuClient
  ws: MockWebSocket
  statuses: string[]
} {
  const statuses: string[] = []
  const client = new KousokuClient(
    "http://x",
    () => {},
    (status) => {
      statuses.push(status)
    },
  )
  client.connect("rA", "b1")
  const ws = MockWebSocket.last
  if (!ws) throw new Error("mock ws not created")
  return { client, ws, statuses }
}

test("CONNECTING 中の send は入队し底層 send を呼ばず投げない", () => {
  const { client, ws } = makeClient()
  expect(ws.readyState).toBe(READY.CONNECTING)
  expect(() => client.send(oshaberi("a"))).not.toThrow()
  expect(ws.sent).toEqual([])
})

test("open 発火後にバッファを FIFO で flush、以降は直送", () => {
  const { client, ws } = makeClient()
  client.send(oshaberi("a"))
  client.send(oshaberi("b"))
  expect(ws.sent).toEqual([])

  ws.fireOpen()
  expect(ws.sent).toEqual([JSON.stringify(oshaberi("a")), JSON.stringify(oshaberi("b"))])

  client.send(oshaberi("c"))
  expect(ws.sent).toEqual([
    JSON.stringify(oshaberi("a")),
    JSON.stringify(oshaberi("b")),
    JSON.stringify(oshaberi("c")),
  ])
})

test("OPEN 中の send は即時送信", () => {
  const { client, ws } = makeClient()
  ws.fireOpen()
  client.send(oshaberi("x"))
  expect(ws.sent).toEqual([JSON.stringify(oshaberi("x"))])
})

test("CLOSING/CLOSED では send が投げず送らない", () => {
  const { client, ws } = makeClient()
  ws.readyState = READY.CLOSING
  expect(() => client.send(oshaberi("a"))).not.toThrow()
  ws.readyState = READY.CLOSED
  expect(() => client.send(oshaberi("b"))).not.toThrow()
  expect(ws.sent).toEqual([])
})

test("close 後の send は ws=null で安全に破棄", () => {
  const { client, ws } = makeClient()
  client.close()
  expect(ws.closed).toBe(true)
  expect(() => client.send(oshaberi("a"))).not.toThrow()
  expect(ws.sent).toEqual([])
})

test("connection status callback follows websocket lifecycle", () => {
  const { client, ws, statuses } = makeClientWithStatus()
  expect(statuses).toEqual(["connecting"])
  ws.fireOpen()
  expect(statuses).toEqual(["connecting", "open"])
  ws.fireError()
  expect(statuses).toEqual(["connecting", "open", "error"])
  client.close()
  expect(statuses.at(-1)).toBe("closed")
})
