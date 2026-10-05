import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { t } from "houkago-kyoushitsu-core/i18n"
import type { RoomRuntime, RoomState } from "./room-runtime"
import { RoomSources } from "./room-sources"

export function QueuePanel({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const canQueue = room.can("playlist")
  const host = room.isHost
  const busy = state.command !== null
  const pendingCount = state.queue.filter((item) => item.id !== state.currentId).length
  return (
    <Card className="room-queue-panel">
      <h2>
        {t("bangumiHeading")} · {state.queue.length}
      </h2>
      {state.queue.length === 0 && <p className="room-queue-empty">{t("roomQueueEmpty")}</p>}
      <ul className="room-list" aria-label={t("bangumiHeading")}>
        {state.queue.map((item, index) => (
          <li
            key={item.id}
            className={`room-row${item.id === state.currentId ? " is-current" : ""}`}
          >
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.type} {item.id === state.currentId ? `· ${t("current")}` : ""}
              </small>
            </div>
            <div className="room-actions">
              {canQueue && (
                <Button
                  variant="secondary"
                  disabled={busy || item.id === state.currentId}
                  onClick={() => room.select(item.id)}
                >
                  {t("selectCurrentProgramme")}
                </Button>
              )}
              {host && (
                <>
                  <Button
                    variant="ghost"
                    disabled={busy || index === 0}
                    onClick={() => void room.move(item.id, "up")}
                  >
                    {t("moveUp")}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || index === state.queue.length - 1}
                    onClick={() => void room.move(item.id, "down")}
                  >
                    {t("moveDown")}
                  </Button>
                </>
              )}
              {canQueue && item.id !== state.currentId && (
                <Button
                  variant="ghost"
                  className="room-danger-action"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`${t("deleteProgrammeConfirm")}\n${item.title}`))
                      void room.delete(item.id)
                  }}
                >
                  {t("delete")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {host && pendingCount > 0 && (
        <Button
          variant="ghost"
          className="room-danger-action room-queue-clear"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("clearPendingTitle"))) void room.clearPending()
          }}
        >
          {t("clearPending")}
        </Button>
      )}
      <RoomSources room={room} state={state} />
    </Card>
  )
}
