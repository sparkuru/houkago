import { useIdentity } from "@/app/context"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { roomIdFromInput } from "@/lib/room-id"
import type { SiteConfig } from "houkago-kousoku"
import { t } from "houkago-kyoushitsu/i18n"
import { useEffect, useRef, useState } from "react"

export function EntryPanel({ config }: { config: SiteConfig }) {
  const { runtime, state, identity } = useIdentity()
  const [room, setRoom] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState(false)
  const joinInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const pending = state.command !== null
  useEffect(() => {
    mounted.current = true
    joinInput.current?.focus()
    return () => {
      mounted.current = false
    }
  }, [])
  function enter(id: string, epoch = state.epoch) {
    const current = runtime.getSnapshot()
    if (
      !mounted.current ||
      current.epoch !== epoch ||
      current.phase !== "ready" ||
      current.command ||
      !runtime.identity()
    )
      return
    try {
      location.assign(`/bushitsu/${encodeURIComponent(id)}`)
    } catch {
      setError(true)
    }
  }
  function prefetch() {
    void import("@/routes/room")
  }
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline bg-card p-4">
        <p>
          {t("signedInAs")} <strong>{identity?.username}</strong>
        </p>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setRoom("")
            setName("")
            void runtime.logout()
          }}
        >
          {t("signOut")}
        </Button>
      </div>
      {error && <Alert>{t("roomHandoffFailed")}</Alert>}
      <Card aria-labelledby="join-heading">
        <form
          className="grid gap-5"
          aria-busy={pending}
          onSubmit={(e) => {
            e.preventDefault()
            if (pending) return
            setError(false)
            try {
              enter(roomIdFromInput(room))
            } catch {
              setError(true)
              joinInput.current?.focus()
            }
          }}
        >
          <header className="card-heading">
            <p className="card-kicker">{t("knownClassroomLabel")}</p>
            <h2 id="join-heading">{t("knownClassroomHeading")}</h2>
            <p>{t("knownClassroomHint")}</p>
          </header>
          <div className="grid gap-2">
            <Label htmlFor="room-id">{t("bushitsuIdLabel")}</Label>
            <Input
              id="room-id"
              ref={joinInput}
              required
              value={room}
              disabled={pending}
              onFocus={prefetch}
              onChange={(e) => setRoom(e.target.value)}
              placeholder={t("bushitsuIdPlaceholder")}
            />
          </div>
          <Button type="submit" disabled={pending || !room.trim()}>
            {t("joinBushitsu")}
          </Button>
        </form>
      </Card>
      <Card className="secondary-card" aria-labelledby="create-heading">
        <form
          className="grid gap-5"
          aria-busy={pending}
          onSubmit={(e) => {
            e.preventDefault()
            if (pending) return
            setError(false)
            prefetch()
            const epoch = state.epoch
            void runtime.create(name.trim() || config.entry.defaultBushitsuName).then((id) => {
              if (id) enter(id, epoch)
            })
          }}
        >
          <header className="card-heading">
            <p className="card-kicker">{t("newClassroomLabel")}</p>
            <h2 id="create-heading">{t("newClassroomHeading")}</h2>
            <p>{t("newClassroomHint")}</p>
          </header>
          <div className="grid gap-2">
            <Label htmlFor="room-name">{t("bushitsuNameLabel")}</Label>
            <Input
              id="room-name"
              maxLength={256}
              value={name}
              disabled={pending}
              onFocus={prefetch}
              onChange={(e) => setName(e.target.value)}
              placeholder={config.entry.defaultBushitsuName}
            />
          </div>
          <Button variant="secondary" type="submit" disabled={pending}>
            {t(state.command === "create" ? "createAndJoinPending" : "createAndJoin")}
          </Button>
        </form>
      </Card>
    </div>
  )
}
