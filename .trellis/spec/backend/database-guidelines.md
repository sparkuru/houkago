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
- No migration framework in v1. When schema evolves, add a numbered SQL file and
  apply in order; record applied version in a `schema_version` table. Defer the
  full tooling until the Postgres move.

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
