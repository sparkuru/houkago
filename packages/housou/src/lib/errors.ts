// Domain errors carry a stable `code` consumers switch on. app.onError maps
// code → HTTP status / KEIHOU envelope (design error-handling spec).

export class BushitsuNotFound extends Error {
  code = "BUSHITSU_NOT_FOUND" as const
}

export class EnmokuNotFound extends Error {
  code = "ENMOKU_NOT_FOUND" as const
}

// 部長権限なし：only the host (部長) may drive sync (design §5).
export class NotBuchou extends Error {
  code = "NOT_BUCHOU" as const
}

// 権限なし：the action is gated by the room's guest-permission switch and this
// non-host sender is not allowed it right now (prd role-permissions). Distinct
// from NotBuchou (which is reserved for host-only actions like SETTEI) so a
// rejected guest action reads as "permission off", not "you are not the host".
export class Forbidden extends Error {
  code = "FORBIDDEN" as const
}

// 生徒証 invalid (auth deferred past scaffold, but the channel exists).
export class Unauthorized extends Error {
  code = "UNAUTHORIZED" as const
}

const STATUS: Record<string, number> = {
  BUSHITSU_NOT_FOUND: 404,
  ENMOKU_NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  NOT_BUCHOU: 403,
  FORBIDDEN: 403,
  EISHA_BAD_REQUEST: 400,
  EISHA_PRIVATE_UPSTREAM: 400,
  EISHA_UNSUPPORTED_SOURCE: 422,
  EISHA_UPSTREAM_ERROR: 502,
}

export function statusFor(code: string): number {
  return STATUS[code] ?? 500
}
