import { Elysia, t } from "elysia"
import { DanmakuCueSchema, HttpErrorSchema } from "houkago-kousoku"
import { fetchDanmakuCues } from "./danmaku"
import { dashManifestResponse, decodeDashManifestRef } from "./dash"
import { decodeProxyRef, proxyUpstream } from "./proxy"

export const eishaRoutes = new Elysia({ prefix: "/eisha" })
  .get(
    "/proxy/:token",
    ({ params, request }) => proxyUpstream(decodeProxyRef(params.token), request),
    {
      response: t.Any(),
      detail: { operationId: "eishaProxy", tags: ["media", "eisha"], security: [] },
    },
  )
  .get(
    "/dash/:token",
    ({ params, request }) => dashManifestResponse(decodeDashManifestRef(params.token), request),
    {
      response: t.Any(),
      detail: { operationId: "eishaDash", tags: ["media", "eisha"], security: [] },
    },
  )
  .get("/danmaku/:ref", ({ params }) => fetchDanmakuCues(params.ref), {
    response: {
      200: t.Array(DanmakuCueSchema),
      400: HttpErrorSchema,
      422: HttpErrorSchema,
      500: HttpErrorSchema,
      502: HttpErrorSchema,
    },
    detail: { operationId: "eishaDanmaku", tags: ["browser-json", "eisha"], security: [] },
  })
