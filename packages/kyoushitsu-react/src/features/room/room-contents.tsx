import { Alert, Status } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { t } from "houkago-kyoushitsu/i18n"
import { useState, useSyncExternalStore } from "react"
import { ChatPanel } from "./chat-panel"
import { GovernancePanel } from "./governance-panel"
import { QueuePanel } from "./queue-panel"
import type { RoomRuntime } from "./room-runtime"

export function RoomContents({ room }: { room: RoomRuntime }) {
  const state = useSyncExternalStore(room.subscribe, room.getSnapshot)
  const [copied, setCopied] = useState(false)
  const entered = state.admission === "entered"
  const canQueue = room.can("playlist")
  const current = state.current ?? state.queue.find((item) => item.id === state.currentId)

  return (
    <main className="room-page">
      <header className="room-topbar">
        <div>
          <span className="card-kicker">放課後 · 部室</span>
          <h1>{state.room?.name ?? t("enteringBushitsu")}</h1>
          <p>
            {t("roomInfoStatus")}:{" "}
            {state.connection === "open" ? t("roomStatusNormal") : t("roomStatusConnecting")}
          </p>
        </div>
        <div className="room-actions">
          <Button
            variant="secondary"
            onClick={() =>
              void navigator.clipboard.writeText(location.href).then(() => setCopied(true))
            }
          >
            {copied ? "已复制" : t("copyRoomLinkAria")}
          </Button>
          <a href="/">{t("backHome")}</a>
        </div>
      </header>
      {state.error && <Alert>{state.error}</Alert>}
      {state.notice && <Alert>{state.notice}</Alert>}
      {!entered ? (
        <Card className="room-gate">
          <Status>
            {state.admission === "waiting"
              ? t("waitingApproval")
              : state.admission === "closed"
                ? t("nyuushitsuClosed")
                : state.admission === "rejected"
                  ? t("nyuushitsuRejected")
                  : t("enteringBushitsu")}
          </Status>
          <p>
            {t("roomInfoStatus")}: {state.connection}
          </p>
          <Button variant="secondary" onClick={() => room.reconnect()}>
            {t("retry")}
          </Button>
        </Card>
      ) : (
        <div className="room-grid">
          <div className="room-main">
            <Card className="room-current">
              <span className="card-kicker">{t("current")}</span>
              <h2>{current?.title ?? t("waitingBuchouJouei")}</h2>
              <p>视频播放暂不可用，将在 M5 迁入。</p>
              {state.currentId && canQueue && (
                <Button
                  variant="secondary"
                  disabled={state.command !== null}
                  onClick={() => room.select(null)}
                >
                  取消当前节目
                </Button>
              )}
            </Card>
            <QueuePanel room={room} state={state} />
          </div>
          <div className="room-side">
            <Card>
              <h2>
                {t("shusseki")} · {state.members.length}
              </h2>
              <ul className="room-list">
                {state.members.map((member) => (
                  <li key={member.id}>
                    {member.nickname} ·{" "}
                    {member.yakuwari === "buchou" ? t("buchouRole") : t("memberYakuwari")}
                  </li>
                ))}
              </ul>
            </Card>
            <ChatPanel room={room} state={state} />
            <GovernancePanel room={room} state={state} />
          </div>
        </div>
      )}
    </main>
  )
}
