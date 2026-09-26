import { Alert } from "@/components/ui/alert"
import { Home } from "@/routes/home"
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router"
import { t } from "houkago-kyoushitsu/i18n"
import type { AppRuntime } from "./runtime"
export function createAppRouter(runtime: AppRuntime) {
  const root = createRootRouteWithContext<{ runtime: AppRuntime }>()({
    component: Outlet,
    notFoundComponent: () => (
      <main className="boundary">
        <Alert>
          {t("routeNotFound")} <a href="/">{t("backHome")}</a>
        </Alert>
      </main>
    ),
    errorComponent: () => (
      <main className="boundary">
        <Alert>
          {t("siteConfigFailed")} <a href="/">{t("backHome")}</a>
        </Alert>
      </main>
    ),
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    validateSearch: (search: Record<string, unknown>) => ({
      revoked: search.revoked === "1" || search.revoked === 1 ? 1 : undefined,
    }),
    beforeLoad: () => {
      void runtime.bootstrap()
    },
    component: Home,
  })
  const room = createRoute({
    getParentRoute: () => root,
    path: "/bushitsu/$id",
    component: lazyRouteComponent(() => import("@/routes/room-handoff"), "RoomHandoff"),
  })
  return createRouter({
    routeTree: root.addChildren([home, room]),
    context: { runtime },
    defaultPreload: "intent",
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
