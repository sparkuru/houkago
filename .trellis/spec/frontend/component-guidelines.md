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
const emit = defineEmits<{ jouei: [enmokuId: string | null] }>() // null cancels current item

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
- The ArtPlayer / HLS / DASH / danmaku engine instances are imperative
  third-party objects — wrap each player-facing lifecycle in the dedicated
  `player/EnmokuPlayer.vue` wrapper and each danmaku lifecycle in `danmaku/`.
  `EnmokuPlayer` owns `hls.js` and `dashjs` creation/destruction through
  ArtPlayer `customType`; do not scatter player `.seek()`, HLS, DASH, or engine
  `.emit()` calls across many components.
- ArtPlayer controls/settings may host room UI entry points (quality, local
  file-danmaku controls, cinema layout), but the player component must emit typed
  events back to the parent view. Keep ownership of room UI state in
  `BushitsuView` (or the relevant store for server truth); do not let ArtPlayer
  become the source of truth for source selection, file-danmaku preference, or
  layout mode.
- Custom ArtPlayer controls must render self-contained visible HTML/SVG and put
  critical active-state styles in the control HTML itself. Do not rely on
  outer-component scoped selectors for key control visibility/color: ArtPlayer's
  web fullscreen can change the DOM/style boundary enough for those selectors to
  miss, leaving blank controls or stale active colors.
- If an ArtPlayer control opens a Vue-owned overlay/panel that must remain
  usable in web fullscreen, Teleport that panel into ArtPlayer's `$player`
  element. If a control switches to a parent-owned room layout mode (such as
  cinema chat layout), exit both ArtPlayer `fullscreenWeb` and browser native
  fullscreen first so the parent layout becomes visible.
- Parent-owned cinema layout, ArtPlayer web fullscreen, and browser native
  fullscreen are mutually exclusive visual modes. The player wrapper must emit a
  `cinema(false)`-style state update when ArtPlayer enters either fullscreen
  mode, so the parent layout state and the custom cinema icon never stay active
  while fullscreen is actually covering the parent layout.
- When the browser native fullscreen button is clicked while ArtPlayer
  `fullscreenWeb` is active, intercept the built-in control click in the capture
  phase, stop ArtPlayer's default handler, synchronously set `fullscreenWeb =
  false`, then set native `fullscreen = true`. Letting ArtPlayer process both
  fullscreen modes in the same default click path can briefly enter native
  fullscreen and then snap back to the pre-fullscreen layout.
- When a local file-danmaku source changes, `BushitsuView` must immediately read
  `EnmokuPlayer.snapshot()` into the overlay's playback-time refs and increment a
  danmaku track version used in overlay render keys. Do not wait for the next
  ArtPlayer `timeupdate`/pause/play event; freshly-selected cues should appear at
  the current playback position without requiring user playback interaction.
- Fetched danmaku from `Enmoku.danmaku` should reuse the timeline overlay path
  and the same player time refs as local file danmaku. Local file cues override
  fetched cues for the same `Enmoku.id`; a remote fetch failure degrades to no
  fetched cues and must not break playback.
- Timeline danmaku overlays must position cues from the media clock, not from
  DOM insertion time. Derive visibility from `currentTime - cue.time`, choose a
  mode-specific duration, and keep CSS animations continuous from their normal
  starting position. Avoid negative animation delays for timeline cues; they can
  make browser animation sampling look jumpy and may drop cues before they cross
  the player. Feed the overlay a smooth media-time signal while playback is
  running, for example from a player-owned `requestAnimationFrame` ticker;
  browser `timeupdate` alone is too sparse for smooth flying danmaku. That
  ticker should read `HTMLVideoElement.currentTime` directly; player-wrapper
  getters such as `art.currentTime` may be cached at `timeupdate` cadence and
  can make cues jump on first play until a later pause/play refresh.
- Timeline danmaku overlays must be clipped to the rendered video content rect,
  not the whole ArtPlayer container or browser viewport. When `object-fit:
  contain` creates letterbox bars, compute the contained media rect from the
  video element size and `videoWidth`/`videoHeight`, position the overlay there,
  and compute flying cue distance from that overlay width. Do not use `100vw`
  for cue travel; it makes danmaku cross the page viewport instead of the video
  picture and can leave lines visible in black bars or side panels.
- If dense timeline danmaku needs a visible-cue cap, keep the earliest
  currently-active cues so already-visible lines can finish crossing the player.
  Do not cap by taking only the newest cues; lower speed multipliers increase
  the active window and would make older on-screen lines disappear mid-flight.
- Timeline danmaku speed is a local presentation multiplier, not playback rate
  or room state. Keep the cue timestamp unchanged, clamp the multiplier in the
  timeline utility, and scale mode-specific display duration as
  `effectiveDuration = baseDuration / speed`. Tests should assert the `1.0x`
  baseline plus the slow/fast boundary behavior.
- Provider-aware 番組表 UI should read `Enmoku.provider` through small view-model
  helpers. Bilibili-specific rendering (provider mark, cover, owner, stats,
  external link) belongs in room/bangumi UI, while parsing/fetching those fields
  belongs in `eisha`.
- 番組表 rows should keep a stable scan order: source mark, video title, current
  status (`上映中`), provider info button, play, cancel play, delete. Cancel play
  sends `JOUEI { enmokuId: null }`, is enabled only for the current item, and
  should be represented as a room-level action rather than local-only UI state.
  The list container may fill the panel height, but rows should be compact
  fixed-height flex rows (currently 32px). Keep the title as the only flexible
  middle cell, put status/info/play/cancel/delete inside a fixed right-side
  action group, and avoid hidden placeholder cells; otherwise empty or malformed
  titles can swallow the action area or make sparse queues look broken.
- Keep player controls ordered by interaction frequency on the right side:
  source/quality selection, danmaku toggle, danmaku settings, cinema layout, web
  fullscreen, native fullscreen. Quality/source selection belongs as a visible
  bottom control immediately left of the danmaku toggle so it remains reachable
  in normal, cinema, web fullscreen, and native fullscreen modes; danmaku
  settings belong behind the separate danmaku settings control, not inside a
  generic settings menu.
- Source/quality switching must not remount `EnmokuPlayer`. Keep the Vue `key`
  scoped to the current `Enmoku.id`, watch the URL prop inside the player, and
  call ArtPlayer `switchQuality(url)` so current time and fullscreen/web
  fullscreen state survive the change. A key that includes the selected source
  URL resets playback to `0`, exits native fullscreen, and can leave ArtPlayer's
  fullscreen controls stuck after web-fullscreen selector updates.
- ArtPlayer control selectors must return display HTML from `onSelect`. The
  control implementation writes the returned value into `.art-selector-value`;
  returning `undefined` makes the visible control label literally become
  `undefined`, especially obvious in web fullscreen.

### Architecture Boundary: Player, Room View, Danmaku, Parser

**Current assessment**: the existing split is acceptable for the P1
Vue/CSS timeline overlay, but future player/provider/danmaku work must preserve
these boundaries so `BushitsuView` does not become the permanent owner of every
media concern.

- `eisha` owns provider parsing and upstream fetch details. `kyoushitsu`
  consumes `Enmoku.url`, `Enmoku.sources`, `Enmoku.danmaku`, and
  `Enmoku.provider`; frontend components must not duplicate Bilibili API,
  HLS manifest, DASH, or upstream header parsing.
- `housou` may call `eisha` while creating or serving an `Enmoku`, then
  persist/broadcast the resulting domain fields. It should stay a thin
  orchestration layer, not a second provider parser.
- `EnmokuPlayer` owns ArtPlayer, hls.js, dash.js, fullscreen patches, and
  imperative playback commands. Sync, room authority, provider metadata, and
  danmaku source priority must stay outside the ArtPlayer instance.
- `useShinkou` owns playback authority math and talks to the player only through
  the narrow `PlayerHandle` shape: `apply`, `alignTransport`, `setRate`, and
  `snapshot`. Do not pass ArtPlayer, `HTMLVideoElement`, or media-engine
  instances into sync logic.
- `BushitsuView` may compose room state, player props, and overlay props, but it
  should not accumulate new reusable danmaku/provider logic. When adding another
  timeline source, source priority rule, fetch cache, or derived timeline state,
  first extract a composable such as `useTimelineDanmaku`.
- Timeline danmaku source data should be engine-agnostic. Local file cues and
  fetched `Enmoku.danmaku` cues share one timeline path; realtime chat danmaku
  remains a separate websocket overlay stream.
- Provider-specific frontend checks should go through small helpers near
  `lib/enmoku-metadata.ts`. Avoid scattering checks such as
  `ref.startsWith("bilibili:")` through components unless the surrounding code
  is explicitly a provider adapter.

#### Wrong

```ts
// A route component grows provider fetch and parsing rules inline.
if (enmoku.danmaku?.ref.startsWith("bilibili:")) {
  const cid = enmoku.danmaku.ref.slice("bilibili:".length)
  const xml = await fetch(`https://comment.bilibili.com/${cid}.xml`).then((r) => r.text())
  cues.value = parseBilibiliXml(xml)
}
```

#### Correct

```ts
// The route or composable consumes the typed API/domain contract.
const response = await housou.eisha.danmaku({ ref: enmoku.danmaku.ref }).get()
timeline.setFetchedCues(enmoku.id, response.data ?? [])
```

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
