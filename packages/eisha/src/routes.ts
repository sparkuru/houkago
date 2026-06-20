import { Elysia } from "elysia"
import { fetchDanmakuCues } from "./danmaku"
import { dashManifestResponse, decodeDashManifestRef } from "./dash"
import { decodeProxyRef, proxyUpstream } from "./proxy"

export const eishaRoutes = new Elysia({ prefix: "/eisha" })
  .get("/proxy/:token", ({ params, request }) =>
    proxyUpstream(decodeProxyRef(params.token), request),
  )
  .get("/dash/:token", ({ params, request }) =>
    dashManifestResponse(decodeDashManifestRef(params.token), request),
  )
  .get("/danmaku/:ref", ({ params }) => fetchDanmakuCues(params.ref))
