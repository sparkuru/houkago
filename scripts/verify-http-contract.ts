const fullDocumentPath = process.env.HOUKAGO_OPENAPI_INPUT ?? "packages/housou/openapi.json"
const pageDocumentPath =
  process.env.HOUKAGO_PAGE_OPENAPI_OUTPUT ?? "packages/kyoushitsu-core/openapi.json"

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
const adaptorTags = new Set(["adaptor-json"])
const compatibilityTags = new Set(["media", "html-callback", "websocket"])
const clientErrorStatuses = [400, 401, 403, 404, 409, 422, 428]
const serverErrorStatuses = [500, 502, 503]

type JsonRecord = Record<string, unknown>
type Operation = {
  path: string
  method: string
  value: JsonRecord
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${context} must be an array of strings`)
  }
  return value
}

function readOperations(document: unknown, label: string): Operation[] {
  if (!isRecord(document) || !isRecord(document.paths)) {
    throw new Error(`${label} must contain an object-valued paths field`)
  }

  const operations: Operation[] = []
  for (const [path, pathItemValue] of Object.entries(document.paths)) {
    if (!isRecord(pathItemValue)) throw new Error(`${label} path item ${path} is invalid`)
    for (const [method, operationValue] of Object.entries(pathItemValue)) {
      if (method === "parameters") continue
      if (!operationMethods.has(method))
        throw new Error(`unsupported OpenAPI method ${method} on ${path}`)
      if (!isRecord(operationValue))
        throw new Error(`${label} operation ${method} ${path} is invalid`)
      const operationId = operationValue.operationId
      if (typeof operationId !== "string" || operationId.length === 0) {
        throw new Error(`${label} operation ${method} ${path} has no stable operationId`)
      }
      readStringArray(operationValue.tags, `tags for ${method} ${path}`)
      operations.push({ path, method, value: operationValue })
    }
  }
  return operations
}

function tagsOf(operation: Operation): string[] {
  return readStringArray(operation.value.tags, `tags for ${operation.method} ${operation.path}`)
}

function isBrowserJson(operation: Operation): boolean {
  return tagsOf(operation).includes("browser-json")
}

function isAdaptorJson(operation: Operation): boolean {
  return tagsOf(operation).some((tag) => adaptorTags.has(tag))
}

function isCompatibility(operation: Operation): boolean {
  const tags = tagsOf(operation)
  return operation.method === "ws" || tags.some((tag) => compatibilityTags.has(tag))
}

function assertJsonResponseContract(operation: Operation): void {
  const responses = operation.value.responses
  if (!isRecord(responses) || !isRecord(responses["200"])) {
    throw new Error(`${operation.method} ${operation.path} is missing a 200 response schema`)
  }
  if (!clientErrorStatuses.some((status) => isRecord(responses[String(status)]))) {
    throw new Error(`${operation.method} ${operation.path} is missing a 4xx error response`)
  }
  if (!serverErrorStatuses.some((status) => isRecord(responses[String(status)]))) {
    throw new Error(`${operation.method} ${operation.path} is missing a 5xx error response`)
  }
}

function operationKey(operation: Operation): string {
  return `${operation.method.toUpperCase()} ${operation.path}`
}

function assertSameOperations(expected: Operation[], actual: Operation[], label: string): void {
  const representation = (operation: Operation) =>
    `${operationKey(operation)} ${JSON.stringify(operation.value)}`
  const expectedKeys = expected.map(representation).sort()
  const actualKeys = actual.map(representation).sort()
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    throw new Error(`${label} operation set differs from the authoritative browser JSON set`)
  }
}

const fullDocument: unknown = JSON.parse(await Bun.file(fullDocumentPath).text())
const pageDocument: unknown = JSON.parse(await Bun.file(pageDocumentPath).text())
const fullOperations = readOperations(fullDocument, "authoritative OpenAPI document")
const pageOperations = readOperations(pageDocument, "page OpenAPI document")
const browserOperations = fullOperations.filter(isBrowserJson)
const adaptorOperations = fullOperations.filter(isAdaptorJson)
const compatibilityOperations = fullOperations.filter(isCompatibility)
const classifiedOperations = new Set(
  [...browserOperations, ...adaptorOperations, ...compatibilityOperations].map(operationKey),
)

if (classifiedOperations.size !== fullOperations.length) {
  const unclassified = fullOperations
    .filter((operation) => !classifiedOperations.has(operationKey(operation)))
    .map(operationKey)
  throw new Error(`unclassified HTTP operations: ${unclassified.join(", ")}`)
}

for (const operation of [...browserOperations, ...adaptorOperations]) {
  assertJsonResponseContract(operation)
}

if (fullOperations.length !== 59) {
  throw new Error(`expected 59 authoritative operations, found ${fullOperations.length}`)
}
if (browserOperations.length !== 46) {
  throw new Error(`expected 46 browser JSON operations, found ${browserOperations.length}`)
}
if (adaptorOperations.length !== 8) {
  throw new Error(`expected 8 adaptor JSON operations, found ${adaptorOperations.length}`)
}
if (compatibilityOperations.length !== 5) {
  throw new Error(
    `expected 5 compatibility-boundary operations, found ${compatibilityOperations.length}`,
  )
}

if (pageOperations.some((operation) => !isBrowserJson(operation))) {
  throw new Error("page OpenAPI document contains a non-browser operation")
}
assertSameOperations(browserOperations, pageOperations, "page OpenAPI")

console.log(
  `HTTP contract verified: ${fullOperations.length} operations (${browserOperations.length} browser JSON, ${adaptorOperations.length} adaptor JSON, ${compatibilityOperations.length} compatibility boundary)`,
)
