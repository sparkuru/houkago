# Logging Guidelines

> How logging is done in this project.

---

## Overview

- v1 uses a thin structured logger in `src/lib/logger.ts` wrapping `console`
  with JSON output. No heavy logging dependency until there is a real need.
- Logs are **structured objects**, not interpolated strings, so room/session
  context is queryable.
- The sync hub is the hot path. Per-message logging at `info` is forbidden — it
  would dwarf real signal. Use `debug` (off in production) for per-message traces.

---

## Log Levels

- **debug** — per-WS-message traces, drift (`zure`) calculations, projected-time
  math. Off in production. The place to inspect sync behavior during dev.
- **info** — lifecycle events worth keeping: server start, 部室 created/closed,
  部員 入部/退部, 演目 switched (上映中), platform resolve succeeded.
- **warn** — recoverable anomalies: large drift forcing a hard seek, a 部員
  attempting a host-only action, upstream URL re-resolved after expiry.
- **error** — unexpected failures, unhandled exceptions, DB errors, upstream
  fetch failures in eisha. Always include the error and correlation context.

---

## Structured Logging

Every log carries context fields where available:

```ts
log.info("nyuubu", { bushitsuId, buinId, shusseki })  // 入部：member joined room
log.warn("zure_hard_seek", { bushitsuId, buinId, zure })  // ずれ over 1.5s → hard seek
```

Required/standard fields when in scope: `bushitsuId`（部室）, `buinId`（部員）,
and a `reqId`/`connId` correlation id for REST and WS respectively. Event name is
the first arg and uses the romaji domain verb (`nyuubu`, `taibu`, `housou`,
`tenko`) so logs line up with the dictionary (design §13).

---

## What to Log

- Room and session lifecycle (create/close, join/leave, presence count changes).
- Authority decisions that reject an action (host-only enforcement).
- Sync corrections that are user-visible (hard seeks, rate nudges) at `warn`.
- Upstream resolve/proxy outcomes in eisha (success at `info`, expiry/retry at
  `warn`, failure at `error`).

## What NOT to Log

- **生徒証 / JWTs / auth tokens, cookies, signed upstream URLs** — never. Log a
  token id or a redacted prefix if correlation is needed.
- **Chat / danmaku message content** (`OSHABERI` / `DANMAKU` payloads) — it is
  user content; log the event and ids, not the text.
- Full media manifests or stream bytes.
- Per-message firehose at `info`/`warn` on the sync hub (use `debug`).
