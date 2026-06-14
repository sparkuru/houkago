import { Elysia, t } from "elysia"
import { type KousokuMessage, KousokuMessageSchema } from "houkago-kousoku"
import { buchouIdOf } from "../domain/bushitsu"
import { Forbidden, NotBuchou } from "../lib/errors"
import { canDo, getKengen, setKengen } from "../lib/kengen"
import { join, leave, members, roomTopic, serverMsg, shusseki } from "./housou"
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
  nickname: t.Optional(t.String()),
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
    const { bushitsuId, senderId, nickname } = ws.data.query
    const id = senderId ?? "anon"
    conns.set(ws.id, { bushitsuId, senderId: id })

    const topic = roomTopic(bushitsuId)
    ws.subscribe(topic)
    // roster join is atomic with the broadcast: no enter-then-name window.
    // nickname falls back to senderId so a member always has a label.
    join(bushitsuId, id, nickname || id)
    const buchouId = buchouIdOf(bushitsuId) ?? ""
    const snapshot = serverMsg("SHUSSEKI", {
      n: shusseki(bushitsuId),
      members: members(bushitsuId, buchouId),
    })
    ws.publish(topic, snapshot)
    ws.send(snapshot)
    // New joiner learns the room's current guest-permission snapshot so its UI
    // gating is correct before any change happens (prd §2). Sent only to this
    // socket; room-wide broadcast happens on SETTEI.
    ws.send(serverMsg("KENGEN", getKengen(bushitsuId)))
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
        // Gated by guestCan.chat: a guest with chat off is rejected (→ KEIHOU),
        // not silently dropped, so the client knows (error-handling spec).
        case "OSHABERI":
        case "DANMAKU": {
          const isHost = conn.senderId === buchouIdOf(conn.bushitsuId)
          if (!canDo(isHost, getKengen(conn.bushitsuId), "chat")) {
            throw new Forbidden("発言の権限がありません")
          }
          ws.publish(topic, msg)
          ws.send(msg)
          break
        }

        // 進行: the sync primitive. Gated by guestCan.playback — the host always
        // drives; a guest drives only when the room switch is on, else Forbidden
        // (→ KEIHOU). On accept, broadcast to the room so 部員 follow. enmokuId
        // stays null here so the current 演目 (set by JOUEI) is preserved.
        case "SHINKOU": {
          const isHost = conn.senderId === buchouIdOf(conn.bushitsuId)
          if (!canDo(isHost, getKengen(conn.bushitsuId), "playback")) {
            throw new Forbidden("再生制御の権限がありません")
          }
          // canDo already authorized this sender; pass senderId as buchouId so a
          // permitted guest is accepted by ShinkouSeigyo's own host gate too.
          shinkouSeigyo.shinkou(conn.bushitsuId, msg.payload, null, conn.senderId, conn.senderId)
          ws.publish(topic, msg)
          break
        }

        // 上映: set the room's current 演目. Gated by guestCan.playlist — host
        // always, guest only when on, else Forbidden (→ KEIHOU). On accept, set
        // authority enmokuId and broadcast JOUEI so every 部員 loads the source;
        // echo back to the sender so it follows the same enmokuId→play path.
        case "JOUEI": {
          const isHost = conn.senderId === buchouIdOf(conn.bushitsuId)
          if (!canDo(isHost, getKengen(conn.bushitsuId), "playlist")) {
            throw new Forbidden("ソース選択の権限がありません")
          }
          shinkouSeigyo.jouei(conn.bushitsuId, msg.payload.enmokuId, conn.senderId, conn.senderId)
          ws.publish(topic, msg)
          ws.send(msg)
          break
        }

        // 設定: the 部長 sets the room's guest-permission switches. Host-only —
        // a non-host is rejected with NotBuchou (→ KEIHOU). On accept, store the
        // new snapshot and broadcast KENGEN to the whole room (incl. the host)
        // so every client's UI gating updates in real time (prd §2).
        case "SETTEI": {
          if (conn.senderId !== buchouIdOf(conn.bushitsuId)) {
            throw new NotBuchou("only 部長 may set permissions")
          }
          setKengen(conn.bushitsuId, msg.payload)
          const kengen = serverMsg("KENGEN", getKengen(conn.bushitsuId))
          ws.publish(topic, kengen)
          ws.send(kengen)
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
    leave(conn.bushitsuId, conn.senderId)
    const buchouId = buchouIdOf(conn.bushitsuId) ?? ""
    ws.publish(
      roomTopic(conn.bushitsuId),
      serverMsg("SHUSSEKI", {
        n: shusseki(conn.bushitsuId),
        members: members(conn.bushitsuId, buchouId),
      }),
    )
  },
})
