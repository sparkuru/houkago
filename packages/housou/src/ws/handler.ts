import { Elysia, t } from "elysia"
import { type KousokuMessage, KousokuMessageSchema } from "houkago-kousoku"
import {
  nyuubu as enterPresence,
  taibu as leavePresence,
  roomTopic,
  serverMsg,
  shusseki,
} from "./housou"
import { shinkouSeigyo } from "./shinkou"

// WS sync hub (design §5). SCAFFOLD STAGE: proves the pub/sub path
// (OSHABERI/DANMAKU echo within a room), validates the envelope via TypeBox
// (malformed → error event, never disconnect), and wires the SHINKOU/OIKAKE/
// GENJOU channels onto ShinkouSeigyo so the P0 sync task has its hooks ready.
//
// Room membership comes from the ?bushitsuId= query param at connect time; the
// connection subscribes to room:<bushitsuId>.

const ConnectQuery = t.Object({
  bushitsuId: t.String(),
  senderId: t.Optional(t.String()),
})

type Conn = { bushitsuId: string; senderId: string }

// Per-connection state keyed by the stable ws.id. Elysia hands a fresh ws
// wrapper object to each callback, so identity-based keying (WeakMap by ws) does
// not survive across open/message/close — ws.id does.
const conns = new Map<string, Conn>()

export const wsRoutes = new Elysia().ws("/ws", {
  query: ConnectQuery,
  body: KousokuMessageSchema,
  // Malformed envelope → KEIHOU (警報), never a silent drop or disconnect
  // (error-handling spec). Whatever this returns is sent back to the client.
  error() {
    return serverMsg("KEIHOU", { message: "invalid envelope" })
  },
  open(ws) {
    const { bushitsuId, senderId } = ws.data.query
    conns.set(ws.id, { bushitsuId, senderId: senderId ?? "anon" })

    const topic = roomTopic(bushitsuId)
    ws.subscribe(topic)
    const n = enterPresence(bushitsuId)
    ws.publish(topic, serverMsg("SHUSSEKI", { n }))
    ws.send(serverMsg("SHUSSEKI", { n }))
  },
  message(ws, message) {
    const conn = conns.get(ws.id)
    if (!conn) return
    const topic = roomTopic(conn.bushitsuId)
    const msg = message as KousokuMessage

    switch (msg.type) {
      // Chat / danmaku: echo to the whole room (proves pub/sub path). publish
      // reaches other subscribers; send delivers back to the sender too.
      case "OSHABERI":
      case "DANMAKU":
        ws.publish(topic, msg)
        ws.send(msg)
        break

      // Sync primitive — scaffold records authority state and echoes.
      // P0 TODO: enforce 部長 authority before accepting; apply drift logic.
      case "SHINKOU":
        shinkouSeigyo.shinkou(conn.bushitsuId, msg.payload, null)
        ws.publish(topic, msg)
        break

      // 追いかけ: late joiner asks for authority state → reply GENJOU.
      case "OIKAKE": {
        const { enmokuId, shinkou, shinkouServerTime } = shinkouSeigyo.genjou(conn.bushitsuId)
        ws.send(serverMsg("GENJOU", { enmokuId, shinkou, serverTime: shinkouServerTime }))
        break
      }

      // 点呼 heartbeat — P0 TODO drives drift correction; scaffold no-op.
      case "TENKO":
        break

      // NYUUBU/TAIBU lifecycle is presence-driven on open/close in scaffold.
      default:
        break
    }
  },
  close(ws) {
    const conn = conns.get(ws.id)
    if (!conn) return
    conns.delete(ws.id)
    const n = leavePresence(conn.bushitsuId)
    ws.publish(
      roomTopic(conn.bushitsuId),
      serverMsg("SHUSSEKI", { n: shusseki(conn.bushitsuId) || n }),
    )
  },
})
