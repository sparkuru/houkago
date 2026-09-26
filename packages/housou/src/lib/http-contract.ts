import type { TSchema } from "@sinclair/typebox"
import {
  HttpAdaptorTokenSchema,
  HttpBaiduAdaptorGrantSchema,
  HttpBaiduDlinkRequestSchema,
  HttpBaiduDlinkResponseSchema,
  HttpBaiduOAuthStartBodySchema,
  HttpBaiduOAuthStartSchema,
  HttpBaiduPairingSchema,
  HttpBaiduTokenBundleSchema,
  HttpClearPendingSchema,
  HttpErrorSchema,
  HttpHtmlSchema,
  HttpMediaSchema,
  HttpOkSchema,
  HttpPreviewEnmokuSchema,
} from "houkago-kousoku"

export {
  HttpAdaptorTokenSchema,
  HttpBaiduAdaptorGrantSchema,
  HttpBaiduDlinkRequestSchema,
  HttpBaiduDlinkResponseSchema,
  HttpBaiduOAuthStartSchema,
  HttpBaiduOAuthStartBodySchema,
  HttpBaiduPairingSchema,
  HttpBaiduTokenBundleSchema,
  HttpClearPendingSchema,
  HttpErrorSchema,
  HttpHtmlSchema,
  HttpMediaSchema,
  HttpOkSchema,
  HttpPreviewEnmokuSchema,
} from "houkago-kousoku"

export type HttpResponses<Success extends TSchema> = {
  200: Success
  400: typeof HttpErrorSchema
  401: typeof HttpErrorSchema
  403: typeof HttpErrorSchema
  404: typeof HttpErrorSchema
  409: typeof HttpErrorSchema
  422: typeof HttpErrorSchema
  428: typeof HttpErrorSchema
  500: typeof HttpErrorSchema
  502: typeof HttpErrorSchema
  503: typeof HttpErrorSchema
}

export function httpResponses<Success extends TSchema>(success: Success): HttpResponses<Success> {
  return {
    200: success,
    400: HttpErrorSchema,
    401: HttpErrorSchema,
    403: HttpErrorSchema,
    404: HttpErrorSchema,
    409: HttpErrorSchema,
    422: HttpErrorSchema,
    428: HttpErrorSchema,
    500: HttpErrorSchema,
    502: HttpErrorSchema,
    503: HttpErrorSchema,
  }
}

export function httpDetail(
  operationId: string,
  tags: string[],
  authentication: "session" | "adaptor" | "none" | "optional-session" = "session",
) {
  const security: Record<string, string[]>[] =
    authentication === "none"
      ? []
      : authentication === "optional-session"
        ? [{}, { cookieSession: [] }]
        : authentication === "adaptor"
          ? [{ adaptorBearer: [] }]
          : [{ cookieSession: [] }]
  return { detail: { operationId, tags, security } }
}
