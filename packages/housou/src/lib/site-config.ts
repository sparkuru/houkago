import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { type SiteConfig, SiteConfigValidationError, normalizeSiteConfig } from "houkago-kousoku"

export const SITE_CONFIG_PATH = fileURLToPath(
  new URL("../../../../config/config.toml", import.meta.url),
)

export function loadSiteConfig(source = SITE_CONFIG_PATH): SiteConfig {
  let contents: string
  try {
    contents = readFileSync(source, "utf8")
  } catch {
    throw new Error(`public site configuration ${source} at /: unable to read source`)
  }

  let parsed: unknown
  try {
    parsed = Bun.TOML.parse(contents)
  } catch {
    throw new Error(`public site configuration ${source} at /: malformed TOML`)
  }

  try {
    return normalizeSiteConfig(parsed)
  } catch (error) {
    if (error instanceof SiteConfigValidationError) {
      throw new Error(`public site configuration ${source} at ${error.field}: invalid value`)
    }
    throw error
  }
}

export const siteConfig = loadSiteConfig()
