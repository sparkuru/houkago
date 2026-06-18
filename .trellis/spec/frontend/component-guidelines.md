# Component Guidelines

> How components are built in this project.

---

## Overview

Vue 3 with `<script setup lang="ts">` and the Composition API. Components are
**presentation + wiring**; stateful or reusable logic lives in composables
(`composables/`) and Pinia stores, not inside the component. Domain components
are named from the §13 dictionary (`DanmakuOverlay`, `BangumiList`,
`BushitsuPanel`).

---

## Component Structure

Standard order inside a `.vue` file:

```vue
<script setup lang="ts">
// 1. imports (types from houkago-kousoku first)
import type { Enmoku } from "houkago-kousoku"
import { useBushitsuStore } from "@/stores/bushitsu"

// 2. props / emits (typed)
const props = defineProps<{ enmoku: Enmoku }>()
const emit = defineEmits<{ jouei: [enmokuId: string] }>()  // 上映：request to play this item

// 3. store / composable wiring
const bushitsu = useBushitsuStore()

// 4. local state + computed + handlers
</script>

<template>
  <!-- markup -->
</template>

<style scoped>
/* component-local styles */
</style>
```

- One component per file. Keep templates declarative; push branching logic into
  `computed`.
- The ArtPlayer / danmaku engine are imperative third-party objects — wrap each
  in a single dedicated component (`player/`, `danmaku/`) that owns the instance
  lifecycle (`onMounted` create, `onUnmounted` destroy). Do not scatter player
  `.seek()` / engine `.emit()` calls across many components.

---

## Props Conventions

- Always typed via `defineProps<{...}>()` (generic form), never the runtime
  object form, and never untyped.
- Prop and emit payload types reuse `houkago-kousoku` domain types
  (`Enmoku`, `Buin`, `Shinkou`) — do not restate field shapes locally.
- Props are read-only. To change parent state, `emit` an event named with the
  romaji domain verb (`jouei`, `nyuubu`) — do not mutate props or reach into the
  parent.

---

## Styling Patterns

- `<style scoped>` per component by default. Shared design tokens (colors,
  spacing for the B-station-live layout) live in a global stylesheet / CSS
  variables under `assets/`.
- The cinema layout (player + chat side panel + danmaku overlay) is a known
  arrangement — see `archive/refer/synctv-web/src/components/cinema/` for the
  structural reference (do not copy markup wholesale).

---

## Accessibility

- Controls (host control bar, send buttons) are real `<button>`/form elements
  with labels, keyboard-operable. The danmaku/chat input must be reachable and
  submittable by keyboard.
- Do not convey state by color alone (e.g. host vs member, playing vs paused).
- User-facing labels, placeholders, and ARIA labels go through `src/i18n/t()`
  instead of being hard-coded in templates. Keep identifiers romaji/English,
  keep domain vocabulary consistent with the design dictionary, and put the
  visible text in `src/i18n/messages.ts`.

```vue
<script setup lang="ts">
import { t } from "@/i18n"
</script>

<template>
  <button type="button" :aria-label="t('chatOpenAria')">
    {{ t("joinBushitsu") }}
  </button>
</template>
```

This keeps the default Chinese UI configurable while preserving the project's
Japanese-style product vocabulary, and prevents label drift between visible text
and accessibility text.

---

## Common Mistakes

- Putting sync logic (echo suppression, drift handling) inside a `.vue` — it
  belongs in `composables/useShinkou.ts` / `ws/`. Components are too short-lived
  and too many to own that state.
- Creating the ArtPlayer/Danmaku instance without destroying it on unmount →
  leaks and ghost players when switching 演目.
- Re-declaring `Enmoku`/`Buin` shapes as local prop interfaces → contract drift.
- Mutating props or store state directly from a template handler instead of
  going through a store action.
- Adding new visible UI text directly in a `.vue` template instead of adding a
  typed message key first.
