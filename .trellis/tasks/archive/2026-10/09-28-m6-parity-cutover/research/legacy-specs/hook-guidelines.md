# Hook Guidelines

> How composables (Vue's "hooks") are used in this project.

---

## Overview

This is Vue 3, so the unit of reusable stateful logic is the **composable** — a
`useXxx()` function using the Composition API — not a React hook. Composables
extract logic that is stateful, reused across components, or too complex to sit
in a `.vue`. The sync client is the headline case.

Cross-component shared state that persists (room, playback) belongs in a **Pinia
store**, not a composable; see state-management.md. Rule of thumb: composable =
behavior/logic; store = shared persistent state. They compose — a composable may
read a store.

---

## Composable Patterns

```ts
// composables/useShinkou.ts — 進行制御 playback sync controller (design §5)
import { ref } from "vue"
import type { Shinkou } from "houkago-kousoku"

export function useShinkou(player: ArtPlayerLike) {
  const tsuijuuChuu = ref(false)        // 追従中：echo suppression while applying remote state

  function oikake(genjou: Shinkou) {}   // 追いかけ：catch a late joiner up to authority state
  function tenko() {}                   // 点呼：heartbeat tick → drift correction
  function zureHosei(zure: number) {}   // ずれ補正：tiered drift handling

  return { tsuijuuChuu, oikake, tenko, zureHosei }
}
```

- A composable returns refs/computed/functions; the caller owns the lifetime.
- Register cleanup inside the composable (`onUnmounted`) when it sets up
  listeners/timers (the heartbeat `tenko` interval, WS subscriptions) — callers
  must not have to remember to tear down.
- Keep the **drift math pure and separable** from the side effects, so it can be
  unit-tested without a player or socket (mirrors the backend rule).

---

## Data Fetching

- REST calls go through the **Eden Treaty client** in `src/api/`, typed
  end-to-end against housou's exported `App` type (Elysia spike P6). Components
  do not call `fetch` directly.
- Wrap a fetch in a composable (`useEnmoku`, `useBangumi`) when more than one
  component needs it or it carries loading/error state.
- **Realtime data is not fetched** — playback state, chat, danmaku, presence
  arrive over the WS client (`src/ws/`) as `houkago-kousoku` envelopes and feed
  stores/composables. Do not poll REST for what the socket already pushes.

---

## Naming Conventions

- `use` prefix, camelCase: `useShinkou`, `useBushitsu`, `useDanmaku`, `useEnmoku`.
- Domain composables carry the §13 romaji term; 汉字 stays in comments.
- One composable per file, file named after the composable.

---

## Common Mistakes

- Using a composable for shared persistent state that should be a Pinia store →
  each caller gets its own copy, room state desyncs across components.
- Setting up the `tenko` heartbeat or WS subscription without `onUnmounted`
  cleanup → duplicate timers/listeners after navigation.
- Bypassing the Eden client with raw `fetch` → loses the shared types and the
  single REST surface.
- Polling REST for playback/presence that the WS already broadcasts.
