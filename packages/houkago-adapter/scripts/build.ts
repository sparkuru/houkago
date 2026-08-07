import { join } from "node:path"

const browser = process.argv[2]
if (browser !== "firefox" && browser !== "chromium") {
  throw new Error("usage: bun scripts/build.ts <firefox|chromium>")
}
const root = join(import.meta.dir, "..")
const outdir = join(root, "dist", browser)
const sourceRoot = browser === "firefox" ? join(root, "src") : join(root, "src", "chromium")
const pageOrigin = process.env.HOUKAGO_ADAPTER_ORIGIN
const serverOrigin = process.env.HOUKAGO_ADAPTER_SERVER_ORIGIN
if (!!pageOrigin !== !!serverOrigin) {
  throw new Error(
    "HOUKAGO_ADAPTER_ORIGIN and HOUKAGO_ADAPTER_SERVER_ORIGIN must be provided together",
  )
}
if (pageOrigin) validateDeploymentOrigin("HOUKAGO_ADAPTER_ORIGIN", pageOrigin)
if (serverOrigin) validateDeploymentOrigin("HOUKAGO_ADAPTER_SERVER_ORIGIN", serverOrigin)
const result = await Bun.build({
  entrypoints: [join(sourceRoot, "background.ts"), join(sourceRoot, "content.ts")],
  outdir,
  target: "browser",
  format: browser === "firefox" ? "iife" : "esm",
  minify: false,
  define: {
    __HOUKAGO_ADAPTER_PAGE_ORIGIN__:
      pageOrigin === undefined ? "undefined" : JSON.stringify(pageOrigin),
    __HOUKAGO_ADAPTER_SERVER_ORIGIN__:
      serverOrigin === undefined ? "undefined" : JSON.stringify(serverOrigin),
  },
})
if (!result.success) throw new Error(`adapter ${browser} build failed`)
const manifest = (await Bun.file(join(root, `manifest.${browser}.json`)).json()) as {
  permissions?: string[]
  host_permissions?: string[]
  content_scripts: Array<{ matches: string[] }>
}
if (pageOrigin && serverOrigin) {
  const pagePattern = extensionPattern(pageOrigin)
  const serverPattern = extensionPattern(serverOrigin)
  const permissions = browser === "firefox" ? manifest.permissions : manifest.host_permissions
  if (permissions) {
    const retained = permissions.filter((pattern) => !isDevelopmentOriginPattern(pattern))
    if (!retained.includes(serverPattern)) retained.push(serverPattern)
    permissions.splice(0, permissions.length, ...retained)
  }
  const matches = manifest.content_scripts[0]?.matches
  if (matches) matches.splice(0, matches.length, pagePattern)
}
await Bun.write(join(outdir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)

function validateDeploymentOrigin(name: string, value: string): void {
  const url = new URL(value)
  const loopbackHttp =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  if (url.origin !== value || (url.protocol !== "https:" && !loopbackHttp)) {
    throw new Error(`${name} must be an exact HTTPS or loopback HTTP origin`)
  }
}

function extensionPattern(origin: string): string {
  const url = new URL(origin)
  return `${url.protocol}//${url.hostname}/*`
}

function isDevelopmentOriginPattern(pattern: string): boolean {
  return pattern === "http://*/*" || pattern === "https://*/*"
}
