import { Elysia, t } from "elysia"
import { previewPublicUrlWithMetadata, resolveUrlWithMetadata } from "houkago-eisha"
import type { Enmoku } from "houkago-kousoku"
import { EnmokuProviderSchema, EnmokuTypeSchema } from "houkago-kousoku"
import {
  addEnmoku,
  createBushitsu,
  fetchBangumi,
  fetchBushitsu,
  removeEnmoku,
} from "../domain/bushitsu"
import { Forbidden } from "../lib/errors"
import { canDo, getKengen } from "../lib/kengen"
import { requireTrustedOrigin } from "../lib/origin"
import { seitoFromRequest } from "../lib/seitoshou"
import { isPresent, roomTopic, serverMsg } from "../ws/housou"

// 部室 REST: thin handlers — validate (TypeBox), delegate to domain. No SQL or
// business logic inline (directory-structure layer rule).

const DirectEnmokuBody = t.Object({
  title: t.String(),
  type: EnmokuTypeSchema,
  url: t.String(),
  subtitles: t.Optional(t.Record(t.String(), t.Object({ url: t.String(), type: t.String() }))),
  sources: t.Optional(t.Array(t.Object({ name: t.String(), url: t.String() }))),
  danmaku: t.Optional(
    t.Object({
      type: t.Union([t.Literal("file"), t.Literal("fetch")]),
      ref: t.String(),
    }),
  ),
  provider: t.Optional(EnmokuProviderSchema),
  live: t.Optional(t.Boolean()),
})

const ResolveEnmokuBody = t.Object({
  sourceUrl: t.String(),
  title: t.Optional(t.String()),
})

const PreviewEnmokuBody = t.Object({
  sourceUrl: t.String(),
  title: t.Optional(t.String()),
})

type DirectEnmokuInput = Pick<
  Enmoku,
  "title" | "type" | "url" | "subtitles" | "sources" | "danmaku" | "live" | "provider"
>

type ResolveEnmokuInput = {
  sourceUrl: string
  title?: string
}

export const bushitsuRoutes = new Elysia({ prefix: "/bushitsu" })
  // 部室を作る
  .post(
    "",
    ({ body, request }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      return createBushitsu(body.name, seitoFromRequest(request).id)
    },
    { body: t.Object({ name: t.String() }) },
  )
  // 部室を取る
  .get("/:id", ({ params }) => fetchBushitsu(params.id))
  // 番組表：list a room's enmoku
  .get("/:id/bangumi", ({ params }) => fetchBangumi(params.id))
  // 演目を下見する：parse a public URL without changing the room queue.
  .post(
    "/:id/enmoku/preview",
    async ({ params, body, request }) => {
      authorizePlaylistMutation(request, params.id)
      return previewEnmoku(params.id, body, new URL(request.url).origin)
    },
    { body: PreviewEnmokuBody },
  )
  // 演目を投稿する：add a legacy direct source or resolve a dev source URL.
  .post(
    "/:id/enmoku",
    async ({ params, body, request, server }) => {
      const actor = authorizePlaylistMutation(request, params.id)
      const enmoku = await createEnmoku(params.id, body, new URL(request.url).origin, actor)
      broadcastBangumi(params.id, server)
      return enmoku
    },
    {
      body: t.Union([DirectEnmokuBody, ResolveEnmokuBody]),
    },
  )
  // 演目を消す：delete a queued enmoku from this room.
  .delete("/:id/enmoku/:enmokuId", ({ params, request, server }) => {
    authorizePlaylistMutation(request, params.id)
    const result = removeEnmoku(params.id, params.enmokuId)
    broadcastBangumi(params.id, server)
    return result
  })

async function createEnmoku(
  bushitsuId: string,
  input: DirectEnmokuInput | ResolveEnmokuInput,
  proxyBase: string,
  addedBy: string,
): Promise<Enmoku> {
  if ("sourceUrl" in input) {
    const resolved = await resolveUrlWithMetadata(
      { title: input.title, url: input.sourceUrl },
      { proxyBase },
    )
    return addEnmoku(bushitsuId, {
      title: resolved.title,
      type: resolved.type,
      url: resolved.url,
      headers: resolved.headers,
      subtitles: resolved.subtitles,
      sources: resolved.sources,
      danmaku: resolved.danmaku,
      provider: resolved.provider,
      live: resolved.live,
      addedBy,
    })
  }
  return addEnmoku(bushitsuId, { ...input, addedBy })
}

function authorizePlaylistMutation(request: Request, bushitsuId: string): string {
  requireTrustedOrigin(request.headers.get("origin"))
  const actor = seitoFromRequest(request)
  const room = fetchBushitsu(bushitsuId)
  if (!isPresent(bushitsuId, actor.id)) {
    throw new Forbidden("room admission is required")
  }
  if (!canDo(room.buchouId === actor.id, getKengen(bushitsuId), "playlist")) {
    throw new Forbidden("playlist permission is required")
  }
  return actor.id
}

async function previewEnmoku(
  bushitsuId: string,
  input: { sourceUrl: string; title?: string },
  proxyBase: string,
) {
  fetchBushitsu(bushitsuId)
  const source = await previewPublicUrlWithMetadata(
    { title: input.title, url: input.sourceUrl },
    { proxyBase },
  )
  return {
    state: "ready" as const,
    title: source.title,
    type: source.type,
    provider: source.provider
      ? { kind: source.provider.kind, ownerName: source.provider.ownerName }
      : undefined,
    sourceCount: source.sources?.length,
    subtitleCount: source.subtitles ? Object.keys(source.subtitles).length : undefined,
    live: source.live,
  }
}

function broadcastBangumi(
  bushitsuId: string,
  server: { publish: (topic: string, message: string) => unknown } | null | undefined,
): void {
  const bangumi = serverMsg("BANGUMI", { enmoku: fetchBangumi(bushitsuId) })
  server?.publish(roomTopic(bushitsuId), JSON.stringify(bangumi))
}
