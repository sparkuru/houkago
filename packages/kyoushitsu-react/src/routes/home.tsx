import { useIdentity, useResourceState } from "@/app/context"
import { Alert, Status } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ClassroomScene } from "@/features/entry/classroom-scene"
import { EntryPanel } from "@/features/entry/entry-panel"
import { IdentityPanel } from "@/features/identity/identity-panel"
import { useSearch } from "@tanstack/react-router"
import type { SiteConfig } from "houkago-kousoku"
import { siteConfigKey } from "houkago-kyoushitsu-core/http"
import { t } from "houkago-kyoushitsu-core/i18n"
import { applySiteConfigTitle } from "houkago-kyoushitsu-core/site-config"
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
        <div className="home-masthead">
          {config?.data && (
            <>
              <h1>{config.data.site.name}</h1>
              <div className="floor-marker">
                <span className="floor-code">{config.data.entry.floorCode}</span>
                <span>{config.data.entry.floorLabel}</span>
              </div>
            </>
          )}
        </div>
        <div className="home-invitation">
          {config?.data ? (
            <header className="floor-sign">
              <p className="floor-overline">
                {t("entryOverline")
                  .split(/(?<=，)/u)
                  .map((phrase) => (
                    <span key={phrase}>{phrase}</span>
                  ))}
              </p>
              {config.data.site.subtitle && (
                <p className="brand-romanized">{config.data.site.subtitle}</p>
              )}
            </header>
          ) : (
            <header className="floor-sign">
              <Status>{t(configError ? "siteConfigFailed" : "loadingSiteConfig")}</Status>
            </header>
          )}
          {config?.data && (
            <figure className="home-scene">
              <ClassroomScene />
              <figcaption>{config.data.entry.hint}</figcaption>
            </figure>
          )}
        </div>
        <div className="entry-station" aria-busy={state.phase === "restoring" || !!state.command}>
          {search.revoked === 1 && <Alert>{t("membershipRevoked")}</Alert>}
          {state.feedback && <Alert>{t(state.feedback)}</Alert>}
          {configError ? (
            <Alert>{t("siteConfigFailed")}</Alert>
          ) : !config?.data ? (
            <Card className="entry-loading-card">
              <Status>{t("loadingSiteConfig")}</Status>
            </Card>
          ) : state.phase === "error" ? (
            <Card>
              <Button onClick={() => void runtime.restore()}>{t("retry")}</Button>
            </Card>
          ) : state.phase === "restoring" && !state.command ? (
            <Card className="entry-loading-card">
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
        {config?.data && (
          <footer className="home-footer">
            <p className="floor-privacy">{config.data.entry.privacyNote}</p>
          </footer>
        )}
      </div>
    </main>
  )
}
