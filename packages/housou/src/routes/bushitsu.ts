import { Elysia, t } from "elysia"
import { resolveUrl } from "houkago-eisha"
import type { Enmoku } from "houkago-kousoku"
import { EnmokuTypeSchema } from "houkago-kousoku"
import {
  addEnmoku,
  createBushitsu,
  fetchBangumi,
  fetchBushitsu,
  removeEnmoku,
} from "../domain/bushitsu"
import { roomTopic, serverMsg } from "../ws/housou"

// 部室 REST: thin handlers — validate (TypeBox), delegate to domain. No SQL or
// business logic inline (directory-structure layer rule).

const DirectEnmokuBody = t.Object({
  title: t.String(),
  type: EnmokuTypeSchema,
  url: t.String(),
  headers: t.Optional(t.Record(t.String(), t.String())),
  subtitles: t.Optional(t.Record(t.String(), t.Object({ url: t.String(), type: t.String() }))),
  sources: t.Optional(t.Array(t.Object({ name: t.String(), url: t.String() }))),
  danmaku: t.Optional(
    t.Object({
      type: t.Union([t.Literal("file"), t.Literal("fetch")]),
      ref: t.String(),
    }),
  ),
  live: t.Optional(t.Boolean()),
  addedBy: t.String(),
})

const ResolveEnmokuBody = t.Object({
  sourceUrl: t.String(),
  title: t.Optional(t.String()),
  headers: t.Optional(t.Record(t.String(), t.String())),
  addedBy: t.String(),
})

type DirectEnmokuInput = Pick<
  Enmoku,
  "title" | "type" | "url" | "headers" | "subtitles" | "sources" | "danmaku" | "live" | "addedBy"
>

type ResolveEnmokuInput = {
  sourceUrl: string
  title?: string
  headers?: Record<string, string>
  addedBy: string
}

export const bushitsuRoutes = new Elysia({ prefix: "/bushitsu" })
  // 部室を作る
  .post("", ({ body }) => createBushitsu(body.name, body.buchouId), {
    body: t.Object({ name: t.String(), buchouId: t.String() }),
  })
  // 部室を取る
  .get("/:id", ({ params }) => fetchBushitsu(params.id))
  // 番組表：list a room's enmoku
  .get("/:id/bangumi", ({ params }) => fetchBangumi(params.id))
  // 演目を投稿する：add a legacy direct source or resolve a dev source URL.
  .post(
    "/:id/enmoku",
    ({ params, body, request, server }) => {
      const enmoku = createEnmoku(params.id, body, new URL(request.url).origin)
      broadcastBangumi(params.id, server)
      return enmoku
    },
    {
      body: t.Union([DirectEnmokuBody, ResolveEnmokuBody]),
    },
  )
  // 演目を消す：delete a queued enmoku from this room.
  .delete("/:id/enmoku/:enmokuId", ({ params, server }) => {
    const result = removeEnmoku(params.id, params.enmokuId)
    broadcastBangumi(params.id, server)
    return result
  })

function createEnmoku(
  bushitsuId: string,
  input: DirectEnmokuInput | ResolveEnmokuInput,
  proxyBase: string,
): Enmoku {
  if ("sourceUrl" in input) {
    const resolved = resolveUrl(
      { title: input.title, url: input.sourceUrl, headers: input.headers },
      { proxyBase },
    )
    return addEnmoku(bushitsuId, {
      title: resolved.title,
      type: resolved.type,
      url: resolved.url,
      headers: resolved.headers,
      addedBy: input.addedBy,
    })
  }
  return addEnmoku(bushitsuId, input)
}

function broadcastBangumi(
  bushitsuId: string,
  server: { publish: (topic: string, message: string) => unknown } | null | undefined,
): void {
  const bangumi = serverMsg("BANGUMI", { enmoku: fetchBangumi(bushitsuId) })
  server?.publish(roomTopic(bushitsuId), JSON.stringify(bangumi))
}
