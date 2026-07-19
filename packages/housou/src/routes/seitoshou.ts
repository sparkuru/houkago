import { Elysia, t } from "elysia"
import { requireTrustedOrigin } from "../lib/origin"
import {
  issueSeitoshou,
  registerSeito,
  resolveSeitoshou,
  revokeSeitoshou,
  signInSeito,
} from "../lib/seitoshou"

const COOKIE = "houkago_seitoshou"
const CookieSchema = t.Cookie({ houkago_seitoshou: t.Optional(t.String()) })

export const seitoshouRoutes = new Elysia({ prefix: "/seitoshou" })
  .post(
    "/register",
    async ({ body, cookie, request }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      const seito = await registerSeito(body.username, body.password)
      const session = issueSeitoshou(seito)
      cookie[COOKIE].set({
        value: session.token,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(session.expiresAt),
        secure: process.env.NODE_ENV === "production",
      })
      return seito
    },
    { body: t.Object({ username: t.String(), password: t.String() }), cookie: CookieSchema },
  )
  .post(
    "/sign-in",
    async ({ body, cookie, request }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      const seito = await signInSeito(body.username, body.password)
      const session = issueSeitoshou(seito)
      cookie[COOKIE].set({
        value: session.token,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(session.expiresAt),
        secure: process.env.NODE_ENV === "production",
      })
      return seito
    },
    { body: t.Object({ username: t.String(), password: t.String() }), cookie: CookieSchema },
  )
  .post(
    "/sign-out",
    ({ cookie, request }) => {
      requireTrustedOrigin(request.headers.get("origin"))
      revokeSeitoshou(tokenOf(cookie[COOKIE]?.value))
      cookie[COOKIE].set({
        value: "",
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
      })
      return { ok: true as const }
    },
    { cookie: CookieSchema },
  )
  .get("/me", ({ cookie }) => resolveSeitoshou(tokenOf(cookie[COOKIE]?.value)), {
    cookie: CookieSchema,
  })

export { COOKIE }

function tokenOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}
