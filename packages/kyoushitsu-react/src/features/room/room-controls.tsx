import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useNavigate } from "@tanstack/react-router"
import { t } from "houkago-kyoushitsu/i18n"
import { useEffect, useRef, useState } from "react"
import { GovernancePanel } from "./governance-panel"
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
          if (event.target === event.currentTarget) event.currentTarget.close()
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
        <RoomInformation room={room} state={state} />
        {room.isHost && <GovernancePanel room={room} state={state} />}
      </dialog>
    </>
  )
}

function RoomInformation({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const connectionLabel =
    state.connection === "open"
      ? t("roomStatusNormal")
      : state.connection === "closed"
        ? t("roomStatusClosed")
        : state.connection === "error"
          ? t("roomStatusError")
          : t("roomStatusConnecting")
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
          <dd>{connectionLabel}</dd>
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
      <ul className="room-list">
        {state.members.length === 0 ? (
          <li>{t("noOnlineMembers")}</li>
        ) : (
          state.members.map((member) => (
            <li key={member.id}>
              {member.nickname} ·{" "}
              {member.yakuwari === "buchou" ? t("buchouRole") : t("memberYakuwari")}
            </li>
          ))
        )}
      </ul>
      <h4>{t("kengenPolicyCurrent")}</h4>
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
