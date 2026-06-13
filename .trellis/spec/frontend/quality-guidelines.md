# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Stack: **Vue 3 + Vite**, TypeScript strict, Pinia, ArtPlayer + hls.js/dash.js,
`weizhenye/Danmaku` (MIT). Contract and domain types come from
`houkago-kousoku`; the REST client is Eden Treaty typed against housou's `App`
(design §8, Elysia spike). Quality means: the client faithfully follows
server-authoritative state, third-party imperative objects are contained, and the
naming dictionary is honored across the stack.

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
- **Self-rolling a danmaku renderer.** Use `weizhenye/Danmaku`; do not reinvent
  it or reuse synctv-web's `artplayer-plugin-danmuku` (design §8).
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
- **Contain third-party lifecycles:** create ArtPlayer / Danmaku engine in
  `onMounted`, destroy in `onUnmounted`.
- **Merge danmaku from three sources through the single engine** with the
  priority chain 本地文件 > 在线抓取 > 弹幕盒子; live chat danmaku always overlays
  (design §7).

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
- [ ] Danmaku uses `weizhenye/Danmaku` with the three-source priority chain.
- [ ] Sync-relevant logic has unit tests; comments justify *why*, no noise.
