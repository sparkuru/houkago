# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is `houkago-kyoushitsu`（教室）: **Vue 3 + Vite**, ArtPlayer +
hls.js/dash.js for playback, Vue/CSS overlays for the P1 local-first danmaku
validation layer, and later `weizhenye/Danmaku` (MIT canvas engine) for dense
flying danmaku (design §8). It is one package in the Bun workspaces monorepo and depends on
`houkago-kousoku` for all WS protocol / domain types.

Vue is chosen partly so synctv-web (also Vue) can be read as a structural
reference — `archive/refer/synctv-web/src/` — but **its code is not copied**
(Apache: borrow ideas, keep attribution; design §3 part 3).

---

## Directory Layout

```
packages/kyoushitsu/
├── src/
│   ├── main.ts            # app bootstrap (Vue + Pinia + router)
│   ├── App.vue
│   ├── views/             # route-level pages (BushitsuView, BrowseView)
│   ├── components/        # presentational + feature components
│   │   ├── player/        # ArtPlayer wrapper, subtitle/source switch UI
│   │   ├── danmaku/       # danmaku overlays; later weizhenye/Danmaku binding
│   │   ├── chat/          # B-station-live-style side panel
│   │   └── bushitsu/      # room UI: member list, 番組表, host control bar
│   ├── composables/       # useXxx state/logic (see hook-guidelines.md)
│   ├── stores/            # Pinia stores (see state-management.md)
│   ├── ws/                # WS client speaking houkago-kousoku protocol
│   ├── api/               # REST client (Eden Treaty over houkago-kousoku App type)
│   ├── lib/               # generic helpers (English names)
│   └── assets/
└── package.json
```

---

## Module Organization

- **Feature components** group under a domain folder (`player/`, `chat/`,
  `danmaku/`, `bushitsu/`) keyed to the design's UI breakdown (design §3 教室).
- **Logic that is reused or stateful** goes in `composables/`, not inside a
  component. The sync client logic (echo suppression, seek catch-up, drift) is
  the prime example — it lives in a composable / `ws/`, never inline in a `.vue`.
- **Pinia stores** hold cross-component room/playback state; components and
  composables read from them (synctv-web's `stores/room.ts` is the structural
  reference, not the code).

---

## Naming Conventions

- **Components:** `PascalCase.vue`. Domain components carry the romaji term:
  `BushitsuPanel.vue`, `BangumiList.vue`, `DanmakuOverlay.vue`.
- **Composables:** `useXxx.ts`, camelCase file (`useShinkou.ts`, `useBushitsu.ts`).
- **Stores:** `xxxStore` defined in `stores/xxx.ts` (`useBushitsuStore`).
- **Identifiers romaji ASCII**, 汉字 only in comments (design §12). Domain names
  follow the §13 dictionary; one word, one meaning across the whole stack.
- Generic/mechanical files use English (`lib/clock.ts`, `lib/format.ts`).

---

## Examples

- Player composition reference (structure, not copy): `components/player/`
- Sync client (the hard part): `src/ws/` + `composables/useShinkou.ts`
