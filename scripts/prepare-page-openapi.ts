const inputPath = process.env.HOUKAGO_OPENAPI_INPUT ?? "packages/housou/openapi.json"
const outputPath = process.env.HOUKAGO_PAGE_OPENAPI_OUTPUT ?? "packages/kyoushitsu/openapi.json"
const operationMethods = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
  "ws",
])
const boundaryTags = new Set(["adaptor-json", "media", "html-callback", "websocket"])

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${context} must be an array of strings`)
  }
  return value
}

function hasTag(tags: readonly string[], tag: string): boolean {
  return tags.includes(tag)
}

const raw: unknown = JSON.parse(await Bun.file(inputPath).text())
if (!isRecord(raw) || !isRecord(raw.paths)) {
  throw new Error("authoritative OpenAPI document must contain an object-valued paths field")
}

const selectedPaths: JsonRecord = {}
let browserOperationCount = 0
let boundaryOperationCount = 0

for (const [path, pathItemValue] of Object.entries(raw.paths)) {
  if (!isRecord(pathItemValue)) throw new Error(`OpenAPI path item ${path} is invalid`)

  const selectedPath: JsonRecord = {}
  for (const [method, operationValue] of Object.entries(pathItemValue)) {
    if (method === "parameters") continue
    if (!operationMethods.has(method))
      throw new Error(`unsupported OpenAPI method ${method} on ${path}`)
    if (!isRecord(operationValue)) throw new Error(`OpenAPI operation ${method} ${path} is invalid`)

    const operationId = operationValue.operationId
    if (typeof operationId !== "string" || operationId.length === 0) {
      throw new Error(`OpenAPI operation ${method} ${path} has no stable operationId`)
    }
    const tags = stringArray(operationValue.tags, `tags for ${method} ${path}`)
    if (hasTag(tags, "browser-json")) {
      selectedPath[method] = operationValue
      browserOperationCount += 1
      continue
    }
    if (tags.some((tag) => boundaryTags.has(tag))) {
      boundaryOperationCount += 1
      continue
    }
    if (method === "ws" || hasTag(tags, "ws")) {
      boundaryOperationCount += 1
      continue
    }
    throw new Error(`unclassified OpenAPI operation ${method} ${path} (${operationId})`)
  }

  if (Object.keys(selectedPath).length > 0) {
    if ("parameters" in pathItemValue) selectedPath.parameters = pathItemValue.parameters
    selectedPaths[path] = selectedPath
  }
}

if (browserOperationCount === 0)
  throw new Error("page OpenAPI transform selected no browser operations")

const pageDocument: JsonRecord = { ...raw, paths: selectedPaths }
await Bun.write(outputPath, `${JSON.stringify(pageDocument, null, 2)}\n`)
console.log(
  `Page OpenAPI written to ${outputPath} (${browserOperationCount} browser operations; ${boundaryOperationCount} boundary operations excluded)`,
)
