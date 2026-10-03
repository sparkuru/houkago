import { URL, fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  envDir: process.env.HOUKAGO_ISOLATED_PREVIEW === "1" ? false : undefined,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "portable-module-boundary",
      generateBundle() {
        const modules = [...this.getModuleIds()]
        const forbidden = modules.filter((id) =>
          /\.vue(?:\?|$)|\/node_modules\/(?:vue|@vue|pinia|@elysiajs\/eden)\/|\/packages\/(?:kyoushitsu|housou)\/src\//.test(
            id,
          ),
        )
        if (forbidden.length)
          this.error(`React portable boundary violated: ${forbidden.join(", ")}`)
        this.emitFile({
          type: "asset",
          fileName: "module-graph.json",
          source: JSON.stringify(modules, null, 2),
        })
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: { usePolling: true, interval: 300 },
  },
})
