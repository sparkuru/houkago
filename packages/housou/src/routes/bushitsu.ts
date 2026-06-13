import { Elysia, t } from "elysia"
import { EnmokuTypeSchema } from "houkago-kousoku"
import { addEnmoku, createBushitsu, fetchBangumi, fetchBushitsu } from "../domain/bushitsu"

// 部室 REST: thin handlers — validate (TypeBox), delegate to domain. No SQL or
// business logic inline (directory-structure layer rule).

export const bushitsuRoutes = new Elysia({ prefix: "/bushitsu" })
  // 部室を作る
  .post("", ({ body }) => createBushitsu(body.name, body.buchouId), {
    body: t.Object({ name: t.String(), buchouId: t.String() }),
  })
  // 部室を取る
  .get("/:id", ({ params }) => fetchBushitsu(params.id))
  // 番組表：list a room's enmoku
  .get("/:id/bangumi", ({ params }) => fetchBangumi(params.id))
  // 演目を投稿する：add a direct-link enmoku
  .post(
    "/:id/enmoku",
    ({ params, body }) =>
      addEnmoku(params.id, {
        title: body.title,
        type: body.type,
        url: body.url,
        addedBy: body.addedBy,
      }),
    {
      body: t.Object({
        title: t.String(),
        type: EnmokuTypeSchema,
        url: t.String(),
        addedBy: t.String(),
      }),
    },
  )
