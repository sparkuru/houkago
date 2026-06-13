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

// 生徒証 invalid (auth deferred past scaffold, but the channel exists).
export class Unauthorized extends Error {
  code = "UNAUTHORIZED" as const
}

const STATUS: Record<string, number> = {
  BUSHITSU_NOT_FOUND: 404,
  ENMOKU_NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  NOT_BUCHOU: 403,
}

export function statusFor(code: string): number {
  return STATUS[code] ?? 500
}
