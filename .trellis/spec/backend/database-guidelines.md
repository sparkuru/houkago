# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

- **Driver:** `bun:sqlite` (Bun built-in) for v1. No ORM. Migration path to
  Postgres is planned but not in v1 (design §8).
- **Why:** single-file, zero-ops start; the control plane stores only small
  metadata (rooms, members, enmoku, sessions) — design §8.
- **What is stored:** 部室 / 部員 / 演目 metadata, 番組表 queues, auth tokens.
  **Media bytes are never stored** — that is the media plane's concern and it
  proxies, never persists.
- One `Database` instance per process, created in `src/db/client.ts` and
  imported everywhere. Do not open ad-hoc connections.

---

## Query Patterns

- Use **prepared statements** via `db.query(...)` / `db.prepare(...)`. Reuse the
  prepared statement; never interpolate user values into SQL strings.
- Group queries per entity under `src/db/queries/` (e.g. `bushitsu.ts`,
  `enmoku.ts`). Each exports plain functions returning typed rows.
- Map rows to `houkago-kousoku` domain types at the `db/` boundary. The rest of
  the app sees `Enmoku`, `Buin`, etc. — never raw row shapes.
- Small structured metadata on `Enmoku` (`headers`, `subtitles`, `sources`,
  `danmaku`, `provider`) is stored as JSON TEXT columns and parsed/stringified
  only in `src/db/queries/enmoku.ts`. `live` is stored as nullable integer `0 | 1`.
  Keep `undefined` as SQL `NULL`; do not turn missing metadata into `{}`, `[]`,
  or `false` on read.
- Multi-step writes that must be atomic use `db.transaction(fn)`.

```ts
// src/db/queries/enmoku.ts
import { db } from "../client"
import type { Enmoku } from "houkago-kousoku"

const insert = db.query(
  `INSERT INTO enmoku (id, bushitsu_id, title, type, url, added_by)
   VALUES ($id, $bushitsuId, $title, $type, $url, $addedBy)`,
)

// 演目を投稿する：add an Enmoku to a 部室
export function addEnmoku(e: Enmoku): void {
  insert.run({
    $id: e.id, $bushitsuId: e.bushitsuId, $title: e.title,
    $type: e.type, $url: e.url, $addedBy: e.addedBy,
  })
}
```

---

## Migrations

- v1: a single idempotent `src/db/schema.sql` applied on startup
  (`CREATE TABLE IF NOT EXISTS ...`). Bootstrap runs it once when the DB is empty.
- For small additive v1 schema changes, `src/db/client.ts` may do a guarded
  column upgrade after `schema.sql`: read `PRAGMA table_info(<table>)`, then
  `ALTER TABLE ... ADD COLUMN` only for missing constant column names. This keeps
  local developer databases working without manual deletion.
- No migration framework in v1. When schema evolves, add a numbered SQL file and
  apply in order; record applied version in a `schema_version` table. Defer the
  full tooling until the Postgres move.
- The authenticated schema deliberately does **not** migrate UUID-owned rooms.
  Bootstrap detects a `bushitsu.buchou_id` without a matching `seito` and stops
  with a `HOUSOU_DB` reset instruction. Do not silently claim, retain, or
  delete that legacy development data.

---

## Naming Conventions

- **Tables:** `snake_case`, singular noun keyed to the domain dictionary:
  `bushitsu`, `buin`, `enmoku`, `shusseki`, `seitoshou`.
- **Columns:** `snake_case` (`bushitsu_id`, `added_by`, `created_at`). TS code
  uses `camelCase`; map at the `db/` boundary, do not leak `snake_case` upward.
- **Primary keys:** string `id` (app-generated id), not autoincrement, so ids
  are stable across the eventual Postgres move.
- **Timestamps:** store server wall-clock as integer epoch ms (`created_at`).

---

## Common Mistakes

- Building SQL by string concatenation with user input → injection. Always bind.
- Returning raw row objects from `db/` into domain/route code → couples the
  whole app to column names. Map to domain types at the boundary.
- Opening a second `Database` handle in a helper instead of importing the shared
  client → file-lock contention and inconsistent pragmas.
- Storing media URLs/headers that expire as if permanent — those live in `eisha`
  and are re-resolved on demand; housou stores only the stable reference.
- Parsing JSON metadata in routes/domain code instead of at the DB boundary →
  leaks storage format upward and makes BANGUMI snapshots inconsistent.

## Scenario: Provider-neutral danmaku identity and content pool

### 1. Scope / Trigger

- Trigger: changes to canonical danmaku episodes, media-release evidence,
  release matching, track revisions, content collection, alignment, or the
  site-wide `Komon` grant.
- `housou` stores identity and small normalized cue blobs only. It must not
  store media bytes, provider credentials, private paths, fsids, dlinks, or
  adaptor tokens.

### 2. Signatures

- `POST /danmaku/episodes` accepts a Komon-authorized canonical episode draft;
  `GET /danmaku/episodes?q=<text>` searches only authenticated requests.
- `POST /danmaku/matches` accepts a shared
  `ReleaseEpisodeMatchInputSchema`; the service supplies ids, timestamps, and
  the authenticated personal/room/global authority subject.
- `POST /danmaku/proposals` accepts a release, optional episode target or
  suggested title, and 1–32 typed evidence records. Komon decisions are at
  `POST /danmaku/proposals/:proposalId/decision`.
- `POST /danmaku/alignments` accepts release, track, offset, and optional trim
  bounds; `POST /danmaku/policy` changes the singleton source policy as Komon.
- Komon revision controls are `POST
  /danmaku/tracks/:trackId/revisions/:revisionId/disable` with optional
  `{ reason?: string }`, `POST
  /danmaku/tracks/:trackId/revisions/:revisionId/rollback` with `{}`, and
  `POST /danmaku/revisions/:revisionId/pin` with `{ pinned: boolean }`.
  These routes require both a Seitoshou session and a trusted Origin.
- A provider refresh enters through
  `refreshBilibiliDanmakuTrack(trackId, reference, { now?, freshnessMs?,
  fetcher? })`; it must use the same persisted track/revision contract as a
  direct ingestion.
- `HOUKAGO_KOMON_USERNAMES` is an optional comma-separated deployment
  bootstrap list. Every normalized username must already resolve to one
  account before startup.
- `danmaku_content` is keyed by SHA-256 of canonical JSON (`scope` is
  `canonical-json/v1`); `danmaku_revision` retains the hash even after a
  historical blob is collected.

### 3. Contracts

- `danmaku_episode`, `media_release`, `media_release_evidence`,
  `release_episode_match`, `danmaku_track`, `danmaku_revision`,
  `danmaku_alignment`, `danmaku_proposal`, `danmaku_audit`, and `komon` are
  additive tables and use typed row-to-domain mapping at the DB boundary.
- Personal matches belong only to the acting Seito; room matches belong to a
  room Buchou and optional Enmoku; global matches require a Komon reviewer.
  Only global matches are reusable server-wide knowledge.
- Equal canonical cue JSON may reuse one content row, but tracks, revisions,
  provenance, proposals, and audit events remain separate records.
- Freshness failure creates a failed revision without changing the last valid
  active revision. Disable chooses the newest retained, unblocked valid
  revision or marks the track disabled. Rollback never mutates a revision and
  requires its content blob to still exist.
- A disabled track is a negative trust decision: refresh and ingestion must not
  fetch, reactivate, or attach a new revision to it. If an upstream refresh
  repeats content from a blocked revision, record a failed attempt and keep the
  current valid fallback; do not create a new valid revision for the blocked
  bytes.
- Collection is opt-in, bounded, and skips active or pinned content. It removes
  only the blob; revision hashes and audit metadata remain queryable.

### 4. Validation & Error Matrix

- Unknown configured Komon username -> startup fails and names the account;
  registration order never grants the role.
- Non-Komon canonical/policy/proposal-decision/global-promotion/revision
  mutation -> `KOMON_REQUIRED` or `FORBIDDEN`.
- Personal/room/global subject mismatch, missing release/episode, invalid
  evidence, or invalid alignment -> `DANMAKU_MATCH_INVALID` / 422.
- Digest algorithm, semantic scope, value, or byte count mismatch -> never
  equal; content hash collision with different canonical bytes -> typed
  integrity error.
- Missing or blocked revision content -> rollback/fallback cannot activate it.
- Disabled track ingestion -> `DANMAKU_MATCH_INVALID`; repeated blocked
  canonical content during refresh -> failed refresh state plus
  `DANMAKU_MATCH_INVALID` internally, with the last valid revision unchanged.
- Private provider material in pool metadata -> rejected before persistence.

### 5. Good/Base/Bad Cases

- Good: two releases point to one episode with distinct evidence and alignment;
  two tracks share one canonical blob while retaining separate provenance.
- Base: an unchanged refresh reuses the valid revision and appends a reuse
  audit; a failed refresh leaves playback on the previous revision.
- Base: disabling the active revision selects the newest retained safe revision;
  disabling the last safe revision marks the track disabled.
- Bad: selecting a candidate silently creates a public proposal, a Buchou
  promotes global knowledge, GC deletes an active/pinned blob, or rollback
  points at a collected blob. Re-fetching bytes a Komon blocked must not bypass
  the block by creating a fresh revision.

### 6. Tests Required

- Assert additive startup creates the pool tables while legacy `enmoku.danmaku_json`
  remains present.
- Assert digest scope mismatch, byte-equality collision defense, personal vs
  room vs global authority, proposal idempotence, and safe evidence rejection.
- Assert unchanged-content deduplication, failed-refresh fallback, disable,
  retained-content rollback, active/pinned GC protection, and audit records.
- Exercise Komon disable/rollback/pin routes with a session cookie and trusted
  Origin; assert ordinary Seito and untrusted Origin requests are rejected.
- Assert a disabled track makes no upstream request and a repeated blocked
  content hash becomes a failed refresh without changing the active revision.
- Exercise the real Elysia routes with session cookies and verify ordinary
  Seito requests cannot invoke Komon endpoints.

### 7. Wrong vs Correct

#### Wrong

```ts
fetchDanmakuCues(reference).then((cues) => ingestDanmakuRevision(trackId, cues))
```

#### Correct

```ts
if (track.status === "disabled") return { attempted: false, changed: false }
try {
  ingestDanmakuRevision(trackId, cues, provenance, now)
} catch (error) {
  recordDanmakuRefreshFailure(trackId, safeError(error), provenance, now)
}
```
