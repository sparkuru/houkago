import { useIdentity, useResourceState } from "@/app/context"
import { Alert, Status } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EntryPanel } from "@/features/entry/entry-panel"
import { IdentityPanel } from "@/features/identity/identity-panel"
import { useSearch } from "@tanstack/react-router"
import type { SiteConfig } from "houkago-kousoku"
import { siteConfigKey } from "houkago-kyoushitsu/http"
import { t } from "houkago-kyoushitsu/i18n"
import { applySiteConfigTitle } from "houkago-kyoushitsu/site-config"
import { useEffect } from "react"

export function Home() {
  const search = useSearch({ from: "/" })
  const { runtime, state, identity } = useIdentity()
  const config = useResourceState<SiteConfig>(siteConfigKey())
  const configError = config?.status === "error"
  useEffect(() => {
    if (config?.data) applySiteConfigTitle(config.data)
  }, [config?.data])
  return (
    <main className="home">
      <div className="home-architecture" aria-hidden="true" />
      <div className="home-shell">
        {config?.data ? (
          <header className="floor-sign">
            <div className="floor-marker">
              <span className="floor-code">{config.data.entry.floorCode}</span>
              <span>{config.data.entry.floorLabel}</span>
            </div>
            <h1>{config.data.site.name}</h1>
            {config.data.site.subtitle && (
              <p className="brand-romanized">{config.data.site.subtitle}</p>
            )}
            <p className="floor-hint">{config.data.entry.hint}</p>
            <p className="floor-privacy">{config.data.entry.privacyNote}</p>
          </header>
        ) : (
          <header className="floor-sign">
            <Status>{t(configError ? "siteConfigFailed" : "loadingSiteConfig")}</Status>
          </header>
        )}
        <div className="entry-station" aria-busy={state.phase === "restoring" || !!state.command}>
          {search.revoked === 1 && <Alert>{t("membershipRevoked")}</Alert>}
          {state.feedback && <Alert>{t(state.feedback)}</Alert>}
          {configError ? (
            <Alert>{t("siteConfigFailed")}</Alert>
          ) : !config?.data ? (
            <Status>{t("loadingSiteConfig")}</Status>
          ) : state.phase === "error" ? (
            <Card>
              <Button onClick={() => void runtime.restore()}>{t("retry")}</Button>
            </Card>
          ) : state.phase === "restoring" && !state.command ? (
            <Card>
              <Status>
                <h2>{t("restoringSession")}</h2>
                <p>{t("restoringSessionHint")}</p>
              </Status>
            </Card>
          ) : identity ? (
            <EntryPanel key={state.epoch} config={config.data} />
          ) : (
            <IdentityPanel />
          )}
        </div>
      </div>
    </main>
  )
}
