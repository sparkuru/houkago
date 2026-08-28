// Domain errors carry a stable `code` consumers switch on. app.onError maps
// code → HTTP status / KEIHOU envelope (design error-handling spec).

export class BushitsuNotFound extends Error {
  code = "BUSHITSU_NOT_FOUND" as const
}

export class EnmokuNotFound extends Error {
  code = "ENMOKU_NOT_FOUND" as const
}

export class BuinNotFound extends Error {
  code = "BUIN_NOT_FOUND" as const
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

export class BaiduUnavailable extends Error {
  code = "BAIDU_UNAVAILABLE" as const
}

export class BaiduConnectionRequired extends Error {
  code = "BAIDU_CONNECTION_REQUIRED" as const
}

export class BaiduStateInvalid extends Error {
  code = "BAIDU_STATE_INVALID" as const
}

export class BaiduAdaptorRequired extends Error {
  code = "BAIDU_ADAPTOR_REQUIRED" as const
}

export class BaiduSourceNotFound extends Error {
  code = "BAIDU_SOURCE_NOT_FOUND" as const
}

export class BaiduGrantInvalid extends Error {
  code = "BAIDU_GRANT_INVALID" as const
}

export class KomonRequired extends Error {
  code = "KOMON_REQUIRED" as const
}

export class DanmakuEpisodeNotFound extends Error {
  code = "DANMAKU_EPISODE_NOT_FOUND" as const
}

export class DanmakuReleaseNotFound extends Error {
  code = "DANMAKU_RELEASE_NOT_FOUND" as const
}

export class DanmakuTrackNotFound extends Error {
  code = "DANMAKU_TRACK_NOT_FOUND" as const
}

export class DanmakuRevisionNotFound extends Error {
  code = "DANMAKU_REVISION_NOT_FOUND" as const
}

export class DanmakuProposalNotFound extends Error {
  code = "DANMAKU_PROPOSAL_NOT_FOUND" as const
}

export class DanmakuMatchInvalid extends Error {
  code = "DANMAKU_MATCH_INVALID" as const
}

export class DanmakuPolicyInvalid extends Error {
  code = "DANMAKU_POLICY_INVALID" as const
}

export class DanmakuContentHashCollision extends Error {
  code = "DANMAKU_CONTENT_HASH_COLLISION" as const
}

const STATUS: Record<string, number> = {
  BUSHITSU_NOT_FOUND: 404,
  ENMOKU_NOT_FOUND: 404,
  BUIN_NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  SEITO_CONFLICT: 409,
  SEITO_INVALID: 422,
  NOT_BUCHOU: 403,
  FORBIDDEN: 403,
  EISHA_BAD_REQUEST: 400,
  EISHA_PRIVATE_UPSTREAM: 400,
  EISHA_UNSUPPORTED_SOURCE: 422,
  EISHA_UPSTREAM_ERROR: 502,
  BAIDU_UNAVAILABLE: 503,
  BAIDU_CONNECTION_REQUIRED: 409,
  BAIDU_STATE_INVALID: 400,
  BAIDU_ADAPTOR_REQUIRED: 428,
  BAIDU_SOURCE_NOT_FOUND: 404,
  BAIDU_GRANT_INVALID: 403,
  KOMON_REQUIRED: 403,
  DANMAKU_EPISODE_NOT_FOUND: 404,
  DANMAKU_RELEASE_NOT_FOUND: 404,
  DANMAKU_TRACK_NOT_FOUND: 404,
  DANMAKU_REVISION_NOT_FOUND: 404,
  DANMAKU_PROPOSAL_NOT_FOUND: 404,
  DANMAKU_MATCH_INVALID: 422,
  DANMAKU_POLICY_INVALID: 422,
  DANMAKU_CONTENT_HASH_COLLISION: 500,
}

export function statusFor(code: string): number {
  return STATUS[code] ?? 500
}
