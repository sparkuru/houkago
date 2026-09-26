import type { SiteConfig } from "houkago-kousoku"
import { type InjectionKey, inject } from "vue"
export {
  createSiteConfigLoader,
  applySiteConfigTitle,
  type SiteConfigFetcher,
} from "./site-config-core"
export const SITE_CONFIG_KEY: InjectionKey<SiteConfig> = Symbol("site-config")

export function useSiteConfig(): SiteConfig {
  const config = inject(SITE_CONFIG_KEY)
  if (!config) throw new Error("public site configuration was not provided")
  return config
}
