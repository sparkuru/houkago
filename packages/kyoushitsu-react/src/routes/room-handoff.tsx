import { useRuntime } from "@/app/context"
import { Alert, Status } from "@/components/ui/alert"
import { createRoomHandoff, legacyRoomUrl } from "@/lib/legacy-room-url"
import { useParams } from "@tanstack/react-router"
import { t } from "houkago-kyoushitsu/i18n"
import { useEffect, useState } from "react"
const handoff = createRoomHandoff((target) => location.replace(target))
export function RoomHandoff() {
  const params = useParams({ strict: false })
  const runtime = useRuntime()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    try {
      const url = legacyRoomUrl(
        params.id ?? "",
        location.href,
        import.meta.env.VITE_LEGACY_FRONTEND_URL,
        import.meta.env.DEV,
      )
      handoff(url)
      runtime.dispose()
    } catch {
      setFailed(true)
    }
  }, [params.id, runtime])
  return (
    <main className="boundary">
      {failed ? (
        <Alert>
          {t("roomHandoffFailed")} <a href="/">{t("backHome")}</a>
        </Alert>
      ) : (
        <Status>{t("enteringBushitsu")}</Status>
      )}
    </main>
  )
}
