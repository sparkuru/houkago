import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BaiduPanel } from "@/features/baidu/baidu-panel"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useState } from "react"
import type { RoomRuntime, RoomState } from "./room-runtime"

const sources = [
  { id: "link", label: "roomSourceLink" },
  { id: "baidu", label: "baiduProvider" },
] as const

type SourceId = (typeof sources)[number]["id"]

export function RoomSources({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const [source, setSource] = useState<SourceId>("link")
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [preview, setPreview] = useState<string | null>(null)
  const canQueue = room.can("playlist")
  const busy = state.command !== null
  const activeSource = canQueue ? source : "baidu"
  return (
    <section className="room-source-section" aria-labelledby="room-source-heading">
      <h3 id="room-source-heading">{t("roomSourcesHeading")}</h3>
      <div className="room-form room-source-picker">
        <Label htmlFor="room-source-kind">{t("roomSourcePicker")}</Label>
        <select
          id="room-source-kind"
          value={activeSource}
          disabled={busy}
          onChange={(event) => {
            const next = sources.find((entry) => entry.id === event.target.value)
            if (next) setSource(next.id)
          }}
        >
          {sources
            .filter((entry) => canQueue || entry.id === "baidu")
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t(entry.label)}
              </option>
            ))}
        </select>
      </div>
      <div hidden={activeSource !== "link"}>
        <p className="room-source-hint">{t("roomSourceLinkHint")}</p>
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
              {t(state.command === "preview" ? "sourceResolving" : "sourceResolve")}
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
                  {t(state.command === "add" ? "sourceAdding" : "sourceAddQueue")}
                </Button>
              </output>
            )}
          </form>
        )}
      </div>
      <div hidden={activeSource !== "baidu"}>
        <BaiduPanel roomId={room.roomId} canPlaylist={canQueue} />
      </div>
    </section>
  )
}
