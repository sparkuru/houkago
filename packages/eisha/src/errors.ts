export class EishaBadRequest extends Error {
  code = "EISHA_BAD_REQUEST" as const
}

export class EishaUpstreamError extends Error {
  code = "EISHA_UPSTREAM_ERROR" as const
}

export class EishaUnsupportedSource extends Error {
  code = "EISHA_UNSUPPORTED_SOURCE" as const
}

export class EishaPrivateUpstream extends Error {
  code = "EISHA_PRIVATE_UPSTREAM" as const
}
