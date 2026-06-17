import { Elysia, t } from "elysia"
import { type KousokuMessage, KousokuMessageSchema, type NyuushitsuStatus } from "houkago-kousoku"
import { buchouIdOf } from "../domain/bushitsu"
import { Forbidden, NotBuchou } from "../lib/errors"
import { canDo, getKengen, setKengen } from "../lib/kengen"
import {
  addPendingNyuushitsu,
  getNyuushitsuMode,
  pendingNyuushitsuRequests,
  removePendingNyuushitsuConnection,
  setNyuushitsuMode,
  takePendingNyuushitsu,
} from "../lib/nyuushitsu"
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

type Conn = {
  bushitsuId: string
  senderId: string
  nickname: string
  admitted: boolean
  status: NyuushitsuStatus
}
type SocketOps = {
  send(message: KousokuMessage): void
  subscribe(topic: string): void
  publish(topic: string, message: KousokuMessage): void
}

// Per-connection state keyed by the stable ws.id. Elysia hands a fresh ws
// wrapper object to each callback, so identity-based keying (WeakMap by ws) does
// not survive across open/message/close — ws.id does.
const conns = new Map<string, Conn>()
const sockets = new Map<string, SocketOps>()

function shussekiSnapshot(bushitsuId: string): KousokuMessage {
  const buchouId = buchouIdOf(bushitsuId) ?? ""
  return serverMsg("SHUSSEKI", {
    n: shusseki(bushitsuId),
    members: members(bushitsuId, buchouId),
  })
}

function sendNyuushitsu(connId: string, status: NyuushitsuStatus): void {
  const conn = conns.get(connId)
  const socket = sockets.get(connId)
  if (!conn || !socket) return
  conn.status = status
  const buchouId = buchouIdOf(conn.bushitsuId)
  socket.send(
    serverMsg("NYUUSHITSU", {
      mode: getNyuushitsuMode(conn.bushitsuId),
      status,
      pending: conn.senderId === buchouId ? pendingNyuushitsuRequests(conn.bushitsuId) : [],
    }),
  )
}

function notifyNyuushitsu(bushitsuId: string): void {
  for (const [connId, conn] of conns) {
    if (conn.bushitsuId !== bushitsuId) continue
    sendNyuushitsu(connId, conn.admitted ? "entered" : conn.status)
  }
}

function admit(connId: string): void {
  const conn = conns.get(connId)
  const socket = sockets.get(connId)
  if (!conn || !socket || conn.admitted) return
  const topic = roomTopic(conn.bushitsuId)
  conn.admitted = true
  conn.status = "entered"
  socket.subscribe(topic)
  join(conn.bushitsuId, conn.senderId, conn.nickname)

  const snapshot = shussekiSnapshot(conn.bushitsuId)
  socket.publish(topic, snapshot)
  socket.send(snapshot)
  socket.send(serverMsg("KENGEN", getKengen(conn.bushitsuId)))
  sendNyuushitsu(connId, "entered")
}

function rejectPending(
  connId: string,
  status: Extract<NyuushitsuStatus, "rejected" | "closed">,
): void {
  const conn = conns.get(connId)
  if (!conn || conn.admitted) return
  removePendingNyuushitsuConnection(conn.bushitsuId, conn.senderId, connId)
  sendNyuushitsu(connId, status)
}

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
    const label = nickname || id
    conns.set(ws.id, {
      bushitsuId,
      senderId: id,
      nickname: label,
      admitted: false,
      status: "waiting",
    })
    sockets.set(ws.id, {
      send: (message) => ws.send(message),
      subscribe: (topic) => ws.subscribe(topic),
      publish: (topic, message) => ws.publish(topic, message),
    })

    const buchouId = buchouIdOf(bushitsuId)
    const mode = getNyuushitsuMode(bushitsuId)
    if (id === buchouId || mode === "open") {
      admit(ws.id)
      return
    }
    if (mode === "closed") {
      sendNyuushitsu(ws.id, "closed")
      return
    }
    addPendingNyuushitsu(bushitsuId, ws.id, id, label)
    sendNyuushitsu(ws.id, "waiting")
    notifyNyuushitsu(bushitsuId)
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
      if (!conn.admitted) {
        throw new Forbidden("入室が承認されていません")
      }
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

        // 入室設定: host-only room admission mode. Switching to open admits all
        // pending sockets; switching to closed rejects pending sockets.
        case "NYUUSHITSU_SETTEI": {
          if (conn.senderId !== buchouIdOf(conn.bushitsuId)) {
            throw new NotBuchou("only 部長 may set admission")
          }
          setNyuushitsuMode(conn.bushitsuId, msg.payload.mode)
          if (msg.payload.mode === "open") {
            for (const request of pendingNyuushitsuRequests(conn.bushitsuId)) {
              for (const connId of takePendingNyuushitsu(conn.bushitsuId, request.senderId)) {
                admit(connId)
              }
            }
          } else if (msg.payload.mode === "closed") {
            for (const request of pendingNyuushitsuRequests(conn.bushitsuId)) {
              for (const connId of takePendingNyuushitsu(conn.bushitsuId, request.senderId)) {
                rejectPending(connId, "closed")
              }
            }
          }
          notifyNyuushitsu(conn.bushitsuId)
          break
        }

        // 入室判定: host approves/rejects a pending guest. Only the 部長 decides
        // in this MVP; delegated moderators are deliberately out of scope.
        case "NYUUSHITSU_HANTEI": {
          if (conn.senderId !== buchouIdOf(conn.bushitsuId)) {
            throw new NotBuchou("only 部長 may approve admission")
          }
          const connIds = takePendingNyuushitsu(conn.bushitsuId, msg.payload.senderId)
          for (const connId of connIds) {
            if (msg.payload.approved) {
              admit(connId)
            } else {
              sendNyuushitsu(connId, "rejected")
            }
          }
          notifyNyuushitsu(conn.bushitsuId)
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
    sockets.delete(ws.id)
    if (conn.admitted) {
      leave(conn.bushitsuId, conn.senderId)
      ws.publish(roomTopic(conn.bushitsuId), shussekiSnapshot(conn.bushitsuId))
    } else {
      removePendingNyuushitsuConnection(conn.bushitsuId, conn.senderId, ws.id)
      notifyNyuushitsu(conn.bushitsuId)
    }
  },
})
