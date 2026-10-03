import { useIdentity } from "@/app/context"
import { Alert, Status } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RoomContents } from "@/features/room/room-contents"
import { RoomRuntime } from "@/features/room/room-runtime"
import { safeRoomId } from "@/lib/room-id"
import { useNavigate, useParams } from "@tanstack/react-router"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useEffect, useState } from "react"

export function Room() {
  const { id: rawId } = useParams({ from: "/bushitsu/$id" })
  const { state, identity, runtime } = useIdentity()
  const navigate = useNavigate()
  const [room, setRoom] = useState<{ session: RoomRuntime; epoch: number } | null>(null)
  useEffect(() => {
    void runtime.bootstrap()
  }, [runtime])
  let id: string | null = null
  try {
    id = safeRoomId(rawId)
  } catch {
    /* Show a safe route error. */
  }
  useEffect(() => {
    if (state.phase === "ready" && !identity && !state.command)
      void navigate({ to: "/", search: { revoked: undefined } })
  }, [state.phase, state.command, identity, navigate])
  useEffect(() => {
    if (!id || !identity || state.phase !== "ready" || state.command) return
    const session = new RoomRuntime(id, identity.id, () => {
      if (runtime.getSnapshot().epoch === state.epoch)
        void navigate({ to: "/", search: { revoked: 1 } })
    })
    setRoom({ session, epoch: state.epoch })
    session.start()
    return () => {
      session.dispose()
      setRoom((current) => (current?.session === session ? null : current))
    }
  }, [id, identity, state.epoch, state.phase, state.command, navigate, runtime])
  if (!id)
    return (
      <main className="boundary">
        <Alert>
          无效的部室链接。 <a href="/">{t("backHome")}</a>
        </Alert>
      </main>
    )
  if (state.phase === "error")
    return (
      <main className="boundary">
        <Alert>{t("sessionRestoreFailed")}</Alert>
        <Button onClick={() => void runtime.restore()}>{t("retry")}</Button>
      </main>
    )
  if (
    !room ||
    room.epoch !== state.epoch ||
    state.phase !== "ready" ||
    state.command ||
    room.session.roomId !== id ||
    room.session.identityId !== identity?.id
  )
    return (
      <main className="boundary">
        <Status>{t("restoringSession")}</Status>
      </main>
    )
  return <RoomContents key={`${state.epoch}:${id}`} room={room.session} />
}
