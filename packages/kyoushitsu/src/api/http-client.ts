import { housouUrl } from "../lib/housou-url"
import { client } from "./generated/client.gen"

export type HousouHttpConfig = {
  baseUrl?: string
  fetch?: typeof fetch
}

export type HttpFailureKind = "http" | "network" | "aborted" | "protocol"

export type HttpResponseMetadata = {
  status: number
  statusText: string
  headers: Record<string, string>
}

export type HttpRequestMetadata = {
  method: string
  url: string
}

export class HoukagoHttpError extends Error {
  constructor(
    readonly kind: HttpFailureKind,
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly response?: HttpResponseMetadata,
    readonly request?: HttpRequestMetadata,
  ) {
    super(message)
    this.name = "HoukagoHttpError"
  }
}

export function configureHousouHttpClient(config: HousouHttpConfig = {}): void {
  client.setConfig({
    baseUrl: config.baseUrl ?? defaultBaseUrl(),
    credentials: "include",
    fetch: config.fetch ?? globalThis.fetch,
    parseAs: "json",
    responseValidator: async (data) => {
      if (!isSuccessBody(data)) {
        throw new HoukagoHttpError(
          "protocol",
          "Houkago HTTP response did not contain a valid success body",
        )
      }
    },
  })
}

export const housouHttpClient = client

configureHousouHttpClient()

export function unwrapResult<T>(result: {
  data: T | undefined
  error: unknown | undefined
  response?: Response
  request?: Request
}): T {
  if (result.error !== undefined) {
    throw normalizeHttpError(result.error, result.response, result.request)
  }
  if (result.data === undefined || !isSuccessBody(result.data)) {
    throw new HoukagoHttpError(
      "protocol",
      "Houkago HTTP response did not contain a success body",
      result.response?.status,
      undefined,
      responseMetadata(result.response),
      requestMetadata(result.request),
    )
  }
  return result.data
}

export function normalizeHttpError(
  error: unknown,
  response?: Response,
  request?: Request,
): HoukagoHttpError {
  if (error instanceof HoukagoHttpError) {
    return new HoukagoHttpError(
      error.kind,
      error.message,
      error.status ?? response?.status,
      error.code,
      error.response ?? responseMetadata(response),
      error.request ?? requestMetadata(request),
    )
  }
  const details = errorDetails(error)
  const status = response?.status
  const aborted = isAbortError(error)
  const kind: HttpFailureKind = aborted
    ? "aborted"
    : response?.ok
      ? "protocol"
      : status === undefined
        ? "network"
        : "http"
  return new HoukagoHttpError(
    kind,
    details.message ??
      (aborted ? "Houkago HTTP request was aborted" : "Houkago HTTP request failed"),
    status,
    details.code,
    responseMetadata(response),
    requestMetadata(request),
  )
}

function defaultBaseUrl(): string {
  return typeof location === "undefined" ? "http://127.0.0.1:3000" : housouUrl()
}

function errorDetails(value: unknown): { code?: string; message?: string } {
  if (value instanceof Error) return { message: value.message }
  if (typeof value === "string") return { message: value }
  if (!isRecord(value)) return {}

  const nested = value.error
  if (isRecord(nested)) {
    return {
      code: typeof nested.code === "string" ? nested.code : undefined,
      message: typeof nested.message === "string" ? nested.message : undefined,
    }
  }
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
  }
}

function responseMetadata(response: Response | undefined): HttpResponseMetadata | undefined {
  if (!response) return undefined
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  }
}

function requestMetadata(request: Request | undefined): HttpRequestMetadata | undefined {
  if (!request) return undefined
  return { method: request.method, url: request.url }
}

function isAbortError(value: unknown): boolean {
  return isRecord(value) && value.name === "AbortError"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSuccessBody(value: unknown): boolean {
  return Array.isArray(value) || (isRecord(value) && Object.keys(value).length > 0)
}
