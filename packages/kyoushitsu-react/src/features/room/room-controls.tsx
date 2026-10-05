import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useNavigate } from "@tanstack/react-router"
import { t } from "houkago-kyoushitsu-core/i18n"
import {
  formatLastSeen,
  formatOnlineDuration,
  historicalMembers,
  onlineMembers,
} from "houkago-kyoushitsu-core/member-presence"
import { useEffect, useRef, useState } from "react"
import { GovernancePanel, PermissionSummary } from "./governance-panel"
import { roomConnectionLabel } from "./room-connection-label"
import type { RoomRuntime, RoomState } from "./room-runtime"
import { RoomSpeedDial } from "./room-speed-dial"
import type { RoomSpeedDialAction } from "./room-speed-dial"

export function RoomControls({
  room,
  state,
  copied,
  onCopyRoomLink,
  cinemaMode = false,
  hidden = false,
}: {
  room: RoomRuntime
  state: RoomState
  copied: boolean
  onCopyRoomLink: () => void
  cinemaMode?: boolean
  hidden?: boolean
}) {
  const navigate = useNavigate()
  const [controlsOpen, setControlsOpen] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!hidden) return
    setControlsOpen(false)
    if (dialogRef.current?.open) dialogRef.current.close()
  }, [hidden])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (controlsOpen && !dialog.open) {
      dialog.showModal()
      closeButtonRef.current?.focus()
    } else if (!controlsOpen && dialog.open) {
      dialog.close()
    }
  }, [controlsOpen])

  const actions: RoomSpeedDialAction[] = [
    {
      id: "room-information",
      label: room.isHost ? t("roomControlHeading") : t("roomInfoHeading"),
      icon: <SettingsIcon />,
      onActivate: () => setControlsOpen(true),
      opensDialog: true,
    },
    {
      id: "copy-room-link",
      label: copied ? "已复制" : t("copyRoomLinkAria"),
      icon: <LinkIcon />,
      onActivate: onCopyRoomLink,
    },
    {
      id: "back-home",
      label: t("backHome"),
      icon: <BackIcon />,
      onActivate: () => void navigate({ to: "/", search: { revoked: undefined } }),
    },
  ]

  return (
    <>
      <RoomSpeedDial
        actions={actions}
        launcherRef={launcherRef}
        launcherLabel={room.isHost ? t("roomControlHeading") : t("roomInfoHeading")}
        closeLabel={t("providerDialogClose")}
        cinemaMode={cinemaMode}
        hidden={hidden}
      />
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Native dialog Escape handling remains available; this click only dismisses when the native backdrop is the event target. */}
      <dialog
        ref={dialogRef}
        className="room-controls-dialog"
        aria-labelledby="room-controls-dialog-title"
        onCancel={() => setControlsOpen(false)}
        onClose={() => {
          setControlsOpen(false)
          window.requestAnimationFrame(() => launcherRef.current?.focus())
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < left ||
            event.clientX > right ||
            event.clientY < top ||
            event.clientY > bottom
          ) {
            event.currentTarget.close()
          }
        }}
      >
        <header className="room-controls-dialog-header">
          <h2 id="room-controls-dialog-title">
            {room.isHost ? t("roomControlHeading") : t("roomInfoHeading")}
          </h2>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            aria-label={t("providerDialogClose")}
            onClick={() => dialogRef.current?.close()}
          >
            <span aria-hidden="true">×</span>
          </Button>
        </header>
        {state.error && <Alert>{state.error}</Alert>}
        <RoomInformation room={room} state={state} active={controlsOpen && !hidden} />
        {room.isHost && <GovernancePanel room={room} state={state} />}
      </dialog>
    </>
  )
}

function RoomInformation({
  room,
  state,
  active,
}: { room: RoomRuntime; state: RoomState; active: boolean }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  const online = onlineMembers(state.presenceById)
  const history = historicalMembers(state.presenceById)
  const modeLabel = {
    open: t("nyuushitsuModeOpen"),
    approval: t("nyuushitsuModeApproval"),
    closed: t("nyuushitsuModeClosed"),
    password: t("nyuushitsuModePassword"),
  }[state.mode]

  return (
    <section className="room-controls-info" aria-labelledby="room-controls-info-heading">
      <h3 id="room-controls-info-heading">{t("roomInfoHeading")}</h3>
      <dl className="room-controls-info-list">
        <div>
          <dt>{t("roomInfoName")}</dt>
          <dd>{state.room?.name ?? room.roomId}</dd>
        </div>
        <div>
          <dt>{t("roomInfoStatus")}</dt>
          <dd>{roomConnectionLabel(state.connection)}</dd>
        </div>
        <div>
          <dt>{t("roomInfoAdmissionMode")}</dt>
          <dd>{modeLabel}</dd>
        </div>
        <div>
          <dt>{t("roomInfoAdmissionStatus")}</dt>
          <dd>{t("nyuushitsuStatusEntered")}</dd>
        </div>
        {room.isHost && (
          <div>
            <dt>{t("roomInfoPending")}</dt>
            <dd>{state.pending.length}</dd>
          </div>
        )}
      </dl>
      <h4>
        {t("roomMembersHeading")} · {state.members.length}
      </h4>
      <section aria-labelledby="room-online-members-heading">
        <h4 id="room-online-members-heading">{t("onlineMembersHeading")}</h4>
        {online.length === 0 ? (
          <p>{t("noOnlineMembers")}</p>
        ) : (
          <table className="w-full table-fixed text-left">
            <thead>
              <tr>
                <th scope="col">{t("memberName")}</th>
                <th scope="col">{t("memberRole")}</th>
                <th scope="col">{t("memberOnlineDuration")}</th>
              </tr>
            </thead>
            <tbody>
              {online.map((member) => (
                <tr key={member.id}>
                  <td className="break-words">{member.nickname}</td>
                  <td>{member.yakuwari === "buchou" ? t("buchouRole") : t("memberYakuwari")}</td>
                  <td data-testid="member-online-duration">
                    {formatOnlineDuration(member.joinedAt, now, {
                      hour: t("durationHour"),
                      minute: t("durationMinute"),
                      second: t("durationSecond"),
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section aria-labelledby="room-history-members-heading">
        <h4 id="room-history-members-heading">{t("historyMembersHeading")}</h4>
        {history.length === 0 ? (
          <p>{t("noHistoryMembers")}</p>
        ) : (
          <table className="w-full table-fixed text-left">
            <thead>
              <tr>
                <th scope="col">{t("memberName")}</th>
                <th scope="col">{t("memberRole")}</th>
                <th scope="col">{t("memberLastLogin")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((member) => (
                <tr key={member.id}>
                  <td className="break-words">{member.nickname}</td>
                  <td>{member.yakuwari === "buchou" ? t("buchouRole") : t("memberYakuwari")}</td>
                  <td>
                    <time dateTime={new Date(member.lastSeenAt).toISOString()}>
                      {formatLastSeen(member.lastSeenAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <PermissionSummary permissions={state.permissions} />
      <ul className="room-controls-permissions">
        {(["chat", "playlist", "playback"] as const).map((key) => (
          <li key={key}>
            {key === "chat"
              ? t("chatPermission")
              : key === "playlist"
                ? t("playlistPermission")
                : t("playbackControl")}
            : {state.permissions[key] ? t("allowed") : t("blocked")}
          </li>
        ))}
      </ul>
    </section>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="8" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="10" cy="18" r="2" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M10 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.72 1.72M14 10.5a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 19.16l1.72-1.72" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M19 12H5m6-6-6 6 6 6" />
    </svg>
  )
}
