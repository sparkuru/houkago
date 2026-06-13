import { Elysia } from "elysia"
import "./db/client" // applies idempotent schema on module load
import { statusFor } from "./lib/errors"
import { bushitsuRoutes } from "./routes/bushitsu"
import { wsRoutes } from "./ws/handler"

export const app = new Elysia()
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
      return { error: { code: "VALIDATION", message: (error as Error).message } }
    }
    if (code === "NOT_FOUND") {
      set.status = 404
      return { error: { code: "NOT_FOUND", message: "not found" } }
    }
    set.status = 500
    return { error: { code: "INTERNAL", message: "internal error" } }
  })
  .get("/health", () => ({ ok: true }))
  .use(bushitsuRoutes)
  .use(wsRoutes)

// Eden contract: the frontend consumes this type via treaty<App>().
export type App = typeof app

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000)
  // Bind 0.0.0.0 so the container service is reachable from the host (dx).
  app.listen({ hostname: "0.0.0.0", port })
  console.log(`houkago-housou listening on :${app.server?.port ?? port}`)
}
