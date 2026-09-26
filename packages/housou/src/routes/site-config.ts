import { Elysia } from "elysia"
import { SiteConfigSchema } from "houkago-kousoku"
import { httpDetail, httpResponses } from "../lib/http-contract"
import { siteConfig } from "../lib/site-config"

export const siteConfigRoutes = new Elysia().get(
  "/site-config",
  ({ set }) => {
    set.headers["cache-control"] = "no-store"
    return siteConfig
  },
  {
    response: httpResponses(SiteConfigSchema),
    ...httpDetail("siteConfig", ["browser-json", "public"], "none"),
  },
)
