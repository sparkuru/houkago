import { Elysia } from "elysia"
import { decodeProxyRef, proxyUpstream } from "./proxy"

export const eishaRoutes = new Elysia({ prefix: "/eisha" }).get(
  "/proxy/:token",
  ({ params, request }) => proxyUpstream(decodeProxyRef(params.token), request),
)
