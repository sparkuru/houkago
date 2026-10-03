import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import { Elysia } from "elysia"
import { eishaRoutes } from "houkago-eisha"
import "./db/client" // applies idempotent schema on module load
import { statusFor } from "./lib/errors"
import { HttpOkSchema, httpDetail, httpResponses } from "./lib/http-contract"
import { corsOrigin } from "./lib/origin"
import { baiduRoutes } from "./routes/baidu"
import { bushitsuRoutes } from "./routes/bushitsu"
import { danmakuRoutes } from "./routes/danmaku"
import { seitoshouRoutes } from "./routes/seitoshou"
import { siteConfigRoutes } from "./routes/site-config"
import { wsRoutes } from "./ws/handler"
import { startTenko } from "./ws/tenko"

export const app = new Elysia()
  .use(cors({ origin: corsOrigin(), credentials: true }))
  .use(
    openapi({
      enabled: process.env.HOUKAGO_OPENAPI === "1",
      path: "/openapi",
      specPath: "/openapi/json",
      provider: null,
      documentation: {
        info: {
          title: "Houkago HTTP API",
          version: "0.0.0",
        },
        servers: [{ url: "/", description: "Houkago housou HTTP origin" }],
        components: {
          securitySchemes: {
            cookieSession: { type: "apiKey", in: "cookie", name: "houkago_seitoshou" },
            adaptorBearer: { type: "http", scheme: "bearer" },
          },
        },
      },
    }),
  )
  // Central error mapping: domain error `code` → HTTP status + uniform body.
  // Unmapped / unexpected errors become 500 with a generic message.
  .onError(({ error, code, set }) => {
    const domainCode = (error as { code?: string }).code
    if (domainCode) {
      set.status = statusFor(domainCode)
      return { error: { code: domainCode, message: (error as Error).message } }
    }
    if (code === "VALIDATION") {
      set.status = 422
      return { error: { code: "VALIDATION", message: "invalid request" } }
    }
    if (code === "NOT_FOUND") {
      set.status = 404
      return { error: { code: "NOT_FOUND", message: "not found" } }
    }
    set.status = 500
    return { error: { code: "INTERNAL", message: "internal error" } }
  })
  .get("/health", () => ({ ok: true as const }), {
    response: httpResponses(HttpOkSchema),
    ...httpDetail("health", ["browser-json", "public"], "none"),
  })
  .use(siteConfigRoutes)
  .use(eishaRoutes)
  .use(seitoshouRoutes)
  .use(baiduRoutes)
  .use(bushitsuRoutes)
  .use(danmakuRoutes)
  .use(wsRoutes)

// Eden contract: the frontend consumes this type via treaty<App>().
export type App = typeof app

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000)
  app.listen({ hostname: process.env.HOST ?? "0.0.0.0", port })
  // 点呼: authority-clock heartbeat, only in the running server (not tests, which
  // start it explicitly with a stop handle to avoid leaking the timer).
  startTenko(app)
  console.log(`houkago-housou listening on :${app.server?.port ?? port}`)
}
