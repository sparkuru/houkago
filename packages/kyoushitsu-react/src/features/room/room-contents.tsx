import { Alert, Status } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BaiduPanel } from "@/features/baidu/baidu-panel"
import { useBaiduPlayback } from "@/features/baidu/use-baidu-playback"
import { DanmakuFeature } from "@/features/danmaku/danmaku-feature"
import { PlayerStage } from "@/features/player/player-stage"
import { t } from "houkago-kyoushitsu/i18n"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { ChatPanel } from "./chat-panel"
import { GovernancePanel } from "./governance-panel"
import { QueuePanel } from "./queue-panel"
import type { RoomRuntime } from "./room-runtime"

export function RoomContents({ room }: { room: RoomRuntime }) {
  const state = useSyncExternalStore(room.subscribe, room.getSnapshot)
  const [copied, setCopied] = useState(false)
  const [cinemaMode, setCinemaMode] = useState(false)
  const [mediaTime, setMediaTime] = useState(0)
  const [overlayContainer, setOverlayContainer] = useState<HTMLElement | null>(null)
  const entered = state.admission === "entered"
  const canQueue = room.can("playlist")
  const current = state.current ?? state.queue.find((item) => item.id === state.currentId) ?? null
  const baidu = useBaiduPlayback(room.roomId, entered ? current : null)
  const isBaidu = current?.provider?.kind === "baidu"
  const fingerprint = useCallback(
    async (item: NonNullable<typeof current>) =>
      current?.id === item.id ? baidu.fingerprint : null,
    [current?.id, baidu.fingerprint],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: current identity resets local cinema and danmaku time.
  useEffect(() => {
    setMediaTime(0)
    setCinemaMode(false)
  }, [current?.id])

  function baiduStatusMessage(): string {
    switch (baidu.state) {
      case "preparing":
        return t("baiduSourcePreparing")
      case "waiting-owner":
        return t("baiduSourceWaitingOwnerDevice")
      case "mobile":
        return t("baiduDesktopRequired")
      case "adaptor-missing":
        return t("baiduAdapterMissing")
      case "adaptor-incompatible":
        return t("baiduAdapterIncompatible")
      case "owner-offline":
        return t("baiduOwnerOffline")
      case "connection-revoked":
        return t("baiduReconnectRequired")
      default:
        return t("baiduSourcePrepareFailed")
    }
  }

  return (
    <main className={`room-page${cinemaMode ? " room-cinema" : ""}`}>
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
              {current && (!isBaidu || baidu.state === "ready") && (
                <PlayerStage
                  key={current.id}
                  room={room}
                  item={current}
                  url={isBaidu ? (baidu.grantUrl ?? undefined) : undefined}
                  onTime={setMediaTime}
                  onOverlayContainerChange={setOverlayContainer}
                  cinemaMode={cinemaMode}
                  onCinemaChange={setCinemaMode}
                />
              )}
              {current && isBaidu && baidu.state !== "ready" && (
                <output className="room-media-state">
                  <strong>{t("baiduProvider")}</strong>
                  <p>{baiduStatusMessage()}</p>
                  {baidu.state !== "preparing" &&
                    baidu.state !== "waiting-owner" &&
                    baidu.state !== "mobile" && (
                      <Button type="button" variant="secondary" onClick={baidu.retry}>
                        {t("retry")}
                      </Button>
                    )}
                </output>
              )}
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
            <DanmakuFeature
              roomId={room.roomId}
              identityId={room.identityId}
              current={current}
              roomDefaults={state.danmakuDefaults}
              defaultsAuthoritative={state.danmakuDefaultsAuthoritative}
              isHost={room.isHost}
              canManageRoomDefault={room.isHost && room.can("playlist")}
              canChat={room.can("chat")}
              chat={state.chat}
              names={state.names}
              sendLive={(content) => room.danmaku(content)}
              mediaTime={mediaTime}
              overlayContainer={overlayContainer}
              fingerprint={fingerprint}
            />
            <QueuePanel room={room} state={state} />
          </div>
          <div className="room-side">
            <BaiduPanel roomId={room.roomId} canPlaylist={canQueue} />
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
            <div className="room-chat-rail">
              <ChatPanel room={room} state={state} />
            </div>
            <GovernancePanel room={room} state={state} />
          </div>
        </div>
      )}
    </main>
  )
}
