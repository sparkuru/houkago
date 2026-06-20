# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Stack: **Vue 3 + Vite**, TypeScript strict, Pinia, ArtPlayer + hls.js/dash.js,
P1 Vue/CSS danmaku overlays, and later `weizhenye/Danmaku` (MIT) for dense
flying danmaku. Contract and domain types come from
`houkago-kousoku`; the REST client is Eden Treaty typed against housou's `App`
(design §8, Elysia spike). Quality means: the client faithfully follows
server-authoritative state, third-party imperative objects are contained, and the
naming dictionary is honored across the stack.

---

## Build & Run + dependency pins (this project)

**The host has no `bun`** — run every bun/vite/test command through the repo-root
`./dx` wrapper (`oven/bun:1` container, repo at `/app`, ports 3000/5173 published,
uid-mapped). Two `./dx` calls can't run concurrently (port re-bind). Vite must
bind `0.0.0.0` (`server.host: "0.0.0.0"`) to be reachable from the host. See
backend quality-guidelines for the full command list.

**Router: pin `vue-router` to `^4.x`** (the stable Vue 3 router). Do NOT use
`vue-router@5.x` — that line is the experimental unplugin/data-loaders variant;
it drags in `unplugin`/`@vue-macros`/`chokidar` and shipped a `createWebHistory`
that self-recurses (stack overflow on navigation). 4.x and 5.x share the
`createRouter`/`createWebHistory` API, so 4.x needs no code changes.

---

## Forbidden Patterns

- **CJK in identifiers.** romaji ASCII only; 汉字 in comments/docs (design §12).
- **Synonym drift.** One concept, one name from §13 (`Buin`, `Enmoku`,
  `Bushitsu`, `Shinkou`) — across components, stores, composables, and kousoku.
- **`any` / casts to dodge the contract**; redefining kousoku types locally
  (see type-safety.md).
- **Client acting as playback source of truth.** Only the 部長 drives sync; a
  member's player events must not emit `SHINKOU` (design §5).
- **Raw `fetch` in components.** Go through the Eden client in `src/api/`.
- **Polling REST for realtime data** the WS already pushes (playback, presence,
  chat, danmaku).
- **Imperative third-party calls scattered across components** — ArtPlayer and
  the Danmaku engine are each owned by one wrapper component/composable.
- **Self-rolling the final dense danmaku renderer.** Use `weizhenye/Danmaku`
  when implementing dense flying danmaku; do not reinvent it or reuse
  synctv-web's `artplayer-plugin-danmuku` (design §8). The existing Vue/CSS
  overlays (`DanmakuOverlay`, `FileDanmakuOverlay`) are a bounded P1
  local-first validation layer only: keep parsing/source state independent so
  they can be replaced by the engine later.
- **Comment noise / commented-out code / decorative banners** (see `common`).

---

## Required Patterns

- **`<script setup lang="ts">`** + Composition API; typed `defineProps`/`defineEmits`.
- **Stateful/reused logic in composables; shared persistent state in Pinia.**
  Components stay thin (component-guidelines.md, state-management.md).
- **WS client writes server state into stores** via actions; UI reads. Apply
  remote `SHINKOU` with `tsuijuuChuu`（追従中）echo suppression.
- **Derive projected playback time on read** from last `Shinkou` +
  `shinkouServerTime`; don't store a ticking value (state-management.md).
- **Contain third-party lifecycles:** create ArtPlayer / future Danmaku engine
  in `onMounted`, destroy in `onUnmounted`.
- **Room/cinema pages are fixed-viewport layouts:** reset `html`, `body`, and
  `#app` to `height: 100%`, `margin: 0`, and `overflow: hidden`; then put
  scrolling only inside intentional panes such as chat logs and 番組表 lists.
  A `100vh` room shell plus the browser's default body margin creates a stray
  page scrollbar and breaks chat/player bottom alignment.
- **Keep danmaku source data engine-agnostic.** Local file parsing belongs in
  `houkago-kokuban`; kyoushitsu stores only source selection, user display
  preference, and timeline cues. The long-term priority chain is 本地文件 /
  user-selected file > meta-derived fetch > danmubox/search; live chat danmaku
  always overlays (design §7).

---

## Testing Requirements

- **Pure sync/drift logic is unit-tested** (`bun test` / Vitest): projected-time
  math, drift tiers, "am I 部長" gating, echo-suppression window. Keep it pure and
  framework-free so it tests without a DOM/player — mirrors the backend rule.
- Component tests focus on wiring (does applying a remote `SHINKOU` set
  `tsuijuuChuu` and seek the player?), not pixel snapshots.
- Manual verification path for P0: two browser sessions, host drives, member
  follows within drift tolerance.

---

## Code Review Checklist

- [ ] Identifiers romaji; domain names match §13 (no synonyms vs backend).
- [ ] Domain/protocol types imported from `kousoku`, not redefined; no `any`/casts.
- [ ] REST via Eden client; realtime via WS — no polling, no raw `fetch`.
- [ ] Only the host emits `SHINKOU`; remote apply uses echo suppression.
- [ ] Projected time derived, not stored as a ticking value.
- [ ] ArtPlayer / Danmaku instances created and destroyed in lifecycle hooks.
- [ ] P1 Vue/CSS danmaku overlays keep source data engine-agnostic; dense/final
      flying danmaku work uses `weizhenye/Danmaku` with the three-source
      priority chain.
- [ ] Sync-relevant logic has unit tests; comments justify *why*, no noise.
