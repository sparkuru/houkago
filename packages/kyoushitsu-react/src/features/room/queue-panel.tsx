import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "houkago-kyoushitsu/i18n"
import { useState } from "react"
import type { RoomRuntime, RoomState } from "./room-runtime"

export function QueuePanel({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const canQueue = room.can("playlist")
  const host = room.isHost
  const busy = state.command !== null
  const pendingCount = state.queue.filter((item) => item.id !== state.currentId).length
  return (
    <Card>
      <h2>
        {t("bangumiHeading")} · {state.queue.length}
      </h2>
      {canQueue && (
        <form
          className="room-form"
          onSubmit={(event) => {
            event.preventDefault()
            void room
              .preview(url.trim(), title.trim() || undefined)
              .then((result) => setPreview(result?.title ?? null))
          }}
        >
          <Label htmlFor="source-url">{t("sourceUrlLabel")}</Label>
          <Input
            id="source-url"
            type="url"
            required
            disabled={busy}
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              setPreview(null)
            }}
            placeholder={t("sourceUrlPlaceholder")}
          />
          <Label htmlFor="source-title">{t("sourceTitleLabel")}</Label>
          <Input
            id="source-title"
            disabled={busy}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setPreview(null)
            }}
          />
          <Button type="submit" disabled={busy || !url.trim()}>
            {t("sourceResolve")}
          </Button>
          {preview && (
            <output className="room-preview">
              <strong>{preview}</strong>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void room.add(url.trim(), title.trim() || undefined).then((result) => {
                    if (result) {
                      setUrl("")
                      setTitle("")
                      setPreview(null)
                    }
                  })
                }
              >
                {t("sourceAddQueue")}
              </Button>
            </output>
          )}
        </form>
      )}
      <ul className="room-list">
        {state.queue.map((item, index) => (
          <li key={item.id} className="room-row">
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
                  设为当前
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
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`删除「${item.title}」？`)) void room.delete(item.id)
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
          variant="secondary"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("clearPendingTitle"))) void room.clearPending()
          }}
        >
          {t("clearPending")}
        </Button>
      )}
    </Card>
  )
}
