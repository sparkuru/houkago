import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { applyTheme } from "houkago-kyoushitsu-core/theme"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RuntimeContext } from "./app/context"
import { createAppRouter } from "./app/router"
import { createAppRuntime } from "./app/runtime"
import "./styles/index.css"
applyTheme(document.documentElement)
const runtime = createAppRuntime()
const router = createAppRouter(runtime)
window.addEventListener("pagehide", () => runtime.dispose(), { once: true })
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload()
})
const root = document.getElementById("root")
if (!root) throw new Error("React root is missing")
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={runtime.queryClient}>
      <RuntimeContext.Provider value={runtime}>
        <RouterProvider router={router} />
      </RuntimeContext.Provider>
    </QueryClientProvider>
  </StrictMode>,
)
