# Directory Structure

> How backend code is organized in this project.

---

## Overview

The backend is a **Bun workspaces monorepo**. Each module from the design
(放送室 / 映写室 / 黒板) is its own package under `packages/`. The control
plane (`houkago-housou`) and the media plane (`houkago-eisha` / `houkago-kokuban`)
are physically separated into different packages so the sync core never touches
media bytes.

The single source of truth for module names and responsibilities is
`design.md` §3 and §9. This file documents the **within-package** layout that
new code must follow.

---

## Repo Layout

```
houkago/
├── packages/
│   ├── kousoku/      # 校則 · shared TS contract (WS protocol types, Enmoku model)
│   ├── housou/       # 放送室 · control-plane server: Bun + Elysia.js + bun:sqlite
│   ├── eisha/        # 映写室 · resolver + stream proxy (parsers/ plugin dir)
│   └── kokuban/      # 黒板 · danmaku aggregation (may co-deploy with eisha in v1)
├── archive/refer/    # synctv / synctv-web — local reference ONLY, gitignored (AGPL)
├── design.md
└── package.json      # workspace root
```

`kousoku` is the only package both backend and frontend depend on. Backend
packages import domain types from `houkago-kousoku`; they never redefine them.

---

## Within `houkago-housou` (control-plane server)

```
packages/housou/
├── src/
│   ├── index.ts          # Elysia app composition + app.listen(); exports `type App` for Eden
│   ├── ws/               # WebSocket sync hub (the only hard part — design §5)
│   │   ├── handler.ts    # .ws('/ws', { body: TypeBox envelope, message, open, close })
│   │   ├── shinkou.ts    # 進行制御 ShinkouSeigyo: host-authority, projected progress
│   │   └── housou.ts     # 放送 broadcast helpers over room:<bushitsuId> topics
│   ├── routes/           # REST route groups, one Elysia plugin per resource
│   │   ├── bushitsu.ts   # 部室 room lifecycle
│   │   ├── enmoku.ts     # 演目 metadata CRUD
│   │   └── seitoshou.ts  # 生徒証 auth (JWT/token in v1)
│   ├── db/               # bun:sqlite access (see database-guidelines.md)
│   │   ├── client.ts     # single Database instance
│   │   ├── schema.sql    # table DDL
│   │   └── queries/      # prepared-statement query modules, one per entity
│   ├── domain/           # BushitsuKanri, BuinService, etc. — pure logic, no I/O
│   └── lib/              # generic mechanical helpers (English names)
└── package.json
```

**Layer rule (design §2):** routes and WS handlers are thin — parse, validate,
delegate to `domain/`. Business state lives in `domain/`. I/O lives in `db/`.
A route handler must not contain sync math or SQL string-building inline.

`eisha` and `kokuban` follow the same `src/{index,routes,domain,lib}` skeleton;
`eisha` adds `src/parsers/` (one file per platform, pluggable — design §3) and
`src/proxy/` (stable stream endpoint, m3u8 rewrite).

---

## Naming Conventions

- **Files/dirs:** `kebab-case.ts`. Domain modules may use the romaji term
  (`shinkou.ts`, `bushitsu.ts`); generic infra uses English (`logger.ts`).
- **Identifiers:** romaji ASCII, never CJK (design §12). `class BushitsuKanri`,
  `function nyuubu()`. CJK only appears in comments: `class Bushitsu // 部室`.
- **One word, one meaning (design §12.4):** the naming dictionary in design.md
  §13 is authoritative. A member is always `Buin` — never also `Member`/`User`.
- **Business concept → houkago dictionary; generic mechanical code → English.**
  A retry loop or HTTP pipeline helper stays English.

---

## Examples

- WS sync hub (the reference for "hard part" structure): `packages/housou/src/ws/`
- Pluggable resolver pattern: `packages/eisha/src/parsers/` (one platform = one file)
