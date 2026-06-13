import { Elysia, t } from "elysia"
import { type KousokuMessage, KousokuMessageSchema } from "houkago-kousoku"
import { fetchBushitsu } from "../domain/bushitsu"
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

    // WS message-body domain errors have no onError fallback (that covers HTTP
    // and envelope validation only), so map them to a KEIHOU back to the sender
    // here — the WS-channel equivalent of central error mapping. A rejected
    // action is reported, never a silent drop or a disconnect (error-handling).
    try {
      switch (msg.type) {
        // Chat / danmaku: echo to the whole room (proves pub/sub path). publish
        // reaches other subscribers; send delivers back to the sender too.
        case "OSHABERI":
        case "DANMAKU":
          ws.publish(topic, msg)
          ws.send(msg)
          break

        // 進行: the sync primitive. Only the room's 部長 may drive playback —
        // ShinkouSeigyo throws NotBuchou otherwise (→ KEIHOU below). On accept,
        // broadcast to the room so 部員 follow.
        case "SHINKOU": {
          const { buchouId } = fetchBushitsu(conn.bushitsuId)
          shinkouSeigyo.shinkou(conn.bushitsuId, msg.payload, null, conn.senderId, buchouId)
          ws.publish(topic, msg)
          break
        }

        // 追いかけ: late joiner asks for authority state → reply GENJOU.
        case "OIKAKE": {
          const { enmokuId, shinkou, shinkouServerTime } = shinkouSeigyo.genjou(conn.bushitsuId)
          ws.send(serverMsg("GENJOU", { enmokuId, shinkou, serverTime: shinkouServerTime }))
          break
        }

        // 点呼 heartbeat — drives drift correction in the next slice; no-op now.
        case "TENKO":
          break

        // NYUUBU/TAIBU lifecycle is presence-driven on open/close in scaffold.
        default:
          break
      }
    } catch (err) {
      const code = (err as { code?: string }).code
      const text = code ? (err as Error).message : "internal error"
      ws.send(serverMsg("KEIHOU", { message: text }))
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
