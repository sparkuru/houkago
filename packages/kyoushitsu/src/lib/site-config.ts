import { DEFAULT_SITE_CONFIG, type SiteConfig, normalizeSiteConfig } from "houkago-kousoku"
import { type InjectionKey, inject } from "vue"

type SiteConfigResult = {
  data: unknown
  error: unknown
}

export type SiteConfigFetcher = () => PromiseLike<SiteConfigResult>
type SiteConfigWarning = (message: string) => void

export const SITE_CONFIG_KEY: InjectionKey<SiteConfig> = Symbol("site-config")

export function createSiteConfigLoader(
  fetcher: SiteConfigFetcher,
  warn: SiteConfigWarning = console.warn,
): () => Promise<SiteConfig> {
  let pending: Promise<SiteConfig> | undefined

  function fallback(): SiteConfig {
    warn("Public site configuration is unavailable; using built-in defaults.")
    return DEFAULT_SITE_CONFIG
  }

  return () => {
    if (pending) return pending
    pending = Promise.resolve()
      .then(fetcher)
      .then(
        ({ data, error }) => {
          if (error || data === null || data === undefined) return fallback()
          return normalizeSiteConfig(data)
        },
        () => fallback(),
      )
    return pending
  }
}

export function applySiteConfigTitle(
  config: SiteConfig,
  target: Pick<Document, "title"> = document,
): void {
  target.title = config.site.browserTitle
}

export function useSiteConfig(): SiteConfig {
  const config = inject(SITE_CONFIG_KEY)
  if (!config) throw new Error("public site configuration was not provided")
  return config
}
