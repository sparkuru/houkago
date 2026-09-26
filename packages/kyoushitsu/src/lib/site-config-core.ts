import { DEFAULT_SITE_CONFIG, type SiteConfig, normalizeSiteConfig } from "houkago-kousoku"

type SiteConfigResult = {
  data: unknown
  error: unknown
}

export type SiteConfigFetcher = () => PromiseLike<SiteConfigResult>
type SiteConfigWarning = (message: string) => void

export function createSiteConfigLoader(
  fetcher: SiteConfigFetcher,
  warn: SiteConfigWarning = console.warn,
  options: { shouldFallbackOnFailure?: (error: unknown) => boolean } = {},
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
          if (error) {
            if (options.shouldFallbackOnFailure && !options.shouldFallbackOnFailure(error))
              throw error
            return fallback()
          }
          if (data === null || data === undefined) return fallback()
          return normalizeSiteConfig(data)
        },
        (error: unknown) => {
          if (options.shouldFallbackOnFailure && !options.shouldFallbackOnFailure(error))
            throw error
          return fallback()
        },
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
