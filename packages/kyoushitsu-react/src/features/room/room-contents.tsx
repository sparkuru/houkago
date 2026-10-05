import { Alert, Status } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useBaiduPlayback } from "@/features/baidu/use-baidu-playback"
import { DanmakuFeature } from "@/features/danmaku/danmaku-feature"
import { PlayerStage } from "@/features/player/player-stage"
import { RoomControls } from "@/features/room/room-controls"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { ChatPanel } from "./chat-panel"
import { QueuePanel } from "./queue-panel"
import { roomConnectionLabel } from "./room-connection-label"
import type { RoomRuntime } from "./room-runtime"

export function RoomContents({ room }: { room: RoomRuntime }) {
  const state = useSyncExternalStore(room.subscribe, room.getSnapshot)
  const [copied, setCopied] = useState(false)
  const [cinemaMode, setCinemaMode] = useState(false)
  const [playerFullscreen, setPlayerFullscreen] = useState(false)
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
        <div className="room-heading">
          <h1>{state.room?.name ?? t("enteringBushitsu")}</h1>
          <p className={`room-connection${state.connection === "open" ? " is-connected" : ""}`}>
            {t("roomInfoStatus")}: {roomConnectionLabel(state.connection)}
          </p>
        </div>
        {!entered && (
          <div className="room-actions">
            <a href="/">{t("backHome")}</a>
          </div>
        )}
      </header>
      {entered && (
        <RoomControls
          room={room}
          state={state}
          copied={copied}
          cinemaMode={cinemaMode}
          hidden={playerFullscreen}
          onCopyRoomLink={() =>
            void navigator.clipboard.writeText(location.href).then(() => setCopied(true))
          }
        />
      )}
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
            {t("roomInfoStatus")}: {roomConnectionLabel(state.connection)}
          </p>
          <Button variant="secondary" onClick={() => room.reconnect()}>
            {t("retry")}
          </Button>
        </Card>
      ) : (
        <div className="room-grid">
          <div className="room-main">
            <Card className={current ? "room-current" : "room-current room-current-empty"}>
              {!current && (
                <svg
                  className="room-projection-mark"
                  viewBox="0 0 80 64"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M8 10h64v40H8Zm-4-4h72M40 50v8m-12 0h24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="m34 23 16 8-16 8Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {current && <span className="card-kicker">{t("joueiChuu")}</span>}
              <h2>{current?.title ?? t("roomProgrammeWaiting")}</h2>
              {!current && <p className="room-waiting-hint">{t("roomWaitingHint")}</p>}
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
                  onFullscreenChange={setPlayerFullscreen}
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
                  {t("cancelCurrentProgramme")}
                </Button>
              )}
            </Card>
          </div>
          <div className="room-side">
            <div className="room-chat-rail room-dock">
              <Card className="room-dock-attendance">
                <h2>
                  {t("shusseki")} · {state.members.length}
                </h2>
                <ul className="room-list">
                  {state.members.map((member) => (
                    <li key={member.id}>
                      <span className="room-member-name">{member.nickname}</span>
                      <span className="room-member-role">
                        {member.yakuwari === "buchou" ? t("buchouRole") : t("memberYakuwari")}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <DanmakuFeature
                roomId={room.roomId}
                identityId={room.identityId}
                current={current}
                roomDefaults={state.danmakuDefaults}
                defaultsAuthoritative={state.danmakuDefaultsAuthoritative}
                isHost={room.isHost}
                canManageRoomDefault={room.isHost && room.can("playlist")}
                chat={state.chat}
                names={state.names}
                mediaTime={mediaTime}
                overlayContainer={overlayContainer}
                fingerprint={fingerprint}
              />
              <ChatPanel room={room} state={state} />
            </div>
          </div>
          <div className="room-queue">
            <QueuePanel room={room} state={state} />
          </div>
        </div>
      )}
    </main>
  )
}
