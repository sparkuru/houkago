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
    // We run vite inside a container with the repo bind-mounted (./dx). Host
    // inotify events do NOT reliably cross the bind mount, so native HMR misses
    // edits — the browser silently serves stale modules. Polling-based watch is
    // the reliable fix in containers; the CPU cost is acceptable for dev.
    watch: { usePolling: true, interval: 300 },
  },
})
