export class EishaBadRequest extends Error {
  code = "EISHA_BAD_REQUEST" as const
}

export class EishaUpstreamError extends Error {
  code = "EISHA_UPSTREAM_ERROR" as const
}
