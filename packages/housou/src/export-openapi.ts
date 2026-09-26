import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

for (const name of [
  "HOUKAGO_BAIDU_CLIENT_ID",
  "HOUKAGO_BAIDU_CLIENT_SECRET",
  "HOUKAGO_BAIDU_REDIRECT_URI",
  "HOUKAGO_CREDENTIAL_KEY",
  "HOUKAGO_CREDENTIAL_KEY_VERSION",
  "HOUKAGO_CORS_ORIGIN",
  "HOUKAGO_KOMON_USERNAMES",
]) {
  delete process.env[name]
}
process.env.NODE_ENV = "test"
process.env.HOUSOU_DB = ":memory:"
process.env.HOUKAGO_OPENAPI = "1"

const { app } = await import("./index")
const response = await app.handle(new Request("http://contract.local/openapi/json"))

if (!response.ok) {
  throw new Error(`OpenAPI export failed with HTTP ${response.status}`)
}

const document: unknown = await response.json()
if (!isRecord(document) || !isRecord(document.paths)) {
  throw new Error("OpenAPI export did not contain paths")
}

// OpenAPI describes the HTTP upgrade, not a non-standard `ws` HTTP method.
const wsPath = document.paths["/ws"]
if (isRecord(wsPath) && isRecord(wsPath.ws)) {
  wsPath.get = {
    ...wsPath.ws,
    responses: { "101": { description: "Switching Protocols: room WebSocket" } },
    "x-transport": "websocket",
  }
  Reflect.deleteProperty(wsPath, "ws")
}

const expected = new Set<string>()
for (const route of app.routes) {
  if (route.method === "OPTIONS" && (route.path === "/" || route.path === "/*")) continue
  if (route.method === "GET" && route.path === "/openapi/json") continue
  const detail: unknown = route.hooks.detail
  if (
    !isRecord(detail) ||
    typeof detail.operationId !== "string" ||
    !Array.isArray(detail.tags) ||
    !detail.tags.some(
      (tag: unknown) =>
        typeof tag === "string" &&
        ["browser-json", "adaptor-json", "media", "html-callback", "websocket"].includes(tag),
    )
  ) {
    throw new Error(
      `Runtime route lacks HTTP contract classification: ${route.method} ${route.path}`,
    )
  }
  const path = route.path.replace(/:([^/]+)/g, "{$1}")
  expected.add(`${route.method === "WS" ? "get" : route.method.toLowerCase()} ${path}`)
}

const actual = new Set<string>()
const operationIds = new Set<string>()
for (const [path, pathItem] of Object.entries(document.paths)) {
  if (!isRecord(pathItem)) throw new Error(`Invalid exported path ${path}`)
  for (const [method, operation] of Object.entries(pathItem)) {
    if (method === "parameters") continue
    if (!isRecord(operation) || typeof operation.operationId !== "string") {
      throw new Error(`Missing stable operationId for ${method} ${path}`)
    }
    if (operationIds.has(operation.operationId)) {
      throw new Error(`Duplicate operationId: ${operation.operationId}`)
    }
    operationIds.add(operation.operationId)
    actual.add(`${method} ${path}`)
    const responses = operation.responses
    if (!isRecord(responses) || !isRecord(responses["200"])) continue
    const tags = operation.tags
    if (!Array.isArray(tags)) continue
    const success = responses["200"]
    const content = success.content
    if (!isRecord(content)) continue
    if (tags.includes("html-callback")) {
      success.content = { "text/html": { schema: { type: "string" } } }
    } else if (tags.includes("media")) {
      if (operation.operationId === "baiduMedia") {
        // The server always returns the typed adaptor-required sentinel error.
        Reflect.deleteProperty(responses, "200")
      } else {
        success.content = {
          [operation.operationId === "eishaDash"
            ? "application/dash+xml"
            : "application/octet-stream"]: { schema: { type: "string", format: "binary" } },
        }
      }
    }
  }
}
const missing = [...expected].filter((key) => !actual.has(key))
const unexpected = [...actual].filter((key) => !expected.has(key))
if (missing.length || unexpected.length) {
  throw new Error(
    `Exported operations differ from runtime routes; missing: ${missing.join(", ")}; unexpected: ${unexpected.join(", ")}`,
  )
}
if (app.server) throw new Error("OpenAPI export unexpectedly started a listener")
normalizeRecordSchemas(document)
const outputPath = process.env.HOUKAGO_OPENAPI_OUTPUT
  ? resolve(process.env.HOUKAGO_OPENAPI_OUTPUT)
  : resolve(dirname(fileURLToPath(import.meta.url)), "../openapi.json")

await Bun.write(outputPath, `${JSON.stringify(document, null, 2)}\n`)
console.log(`OpenAPI contract written to ${outputPath}`)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeRecordSchemas(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) normalizeRecordSchemas(item)
  } else if (isRecord(value)) {
    // TypeBox's catch-all record pattern covers every property. The equivalent
    // additionalProperties schema avoids Hey API widening record values to unknown.
    const patterns = value.patternProperties
    if (
      value.type === "object" &&
      isRecord(patterns) &&
      Object.keys(patterns).length === 1 &&
      "^(.*)$" in patterns &&
      !value.properties
    ) {
      value.additionalProperties = patterns["^(.*)$"]
      Reflect.deleteProperty(value, "patternProperties")
    }
    for (const item of Object.values(value)) normalizeRecordSchemas(item)
  }
}
