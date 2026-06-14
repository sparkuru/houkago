import { URL, fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Dev over LAN: accept any Host header (e.g. a teammate hitting the dev box
    // by IP), not just localhost. Tighten if exposed beyond a trusted network.
    allowedHosts: true,
  },
})
