# Design: Warm Club-Room Frontend Refactor

## Scope and Preserved Boundaries

This first slice redesigns the room entry page and the room shell. It preserves
the existing room API, router paths, Pinia room state, WebSocket ownership,
ArtPlayer lifecycle, playback synchronization, danmaku timing, and chat
behavior. It introduces no illustration assets, no theme selector, and no
alternate theme palette.

The default visual direction is a warm after-school club room: calm paper-like
surfaces, restrained wood/amber accents, soft elevation, comfortable spacing,
and clear typography. The product must remain asset-light and media-first.

## Theme Foundation

Create a global semantic-token stylesheet under `src/assets/` and apply the
warm default through a root `data-theme="warm-club"` attribute. Components use
semantic tokens only, including canvas, surface, raised surface, text,
muted text, border, accent, accent-on, danger, focus ring, shadow, radius, and
spacing tokens. Component-local tokens may derive from these semantics but must
not reintroduce literal palette values.

The theme model has a small typed helper that names the warm default and owns
root-attribute application. It is deliberately selector-free. The existing
chat-only `light`/`dark` local-storage key is left untouched for a future
migration, but neither it nor a theme-switch UI affects the first-slice render.
The chat-only toggle and its dark-class styling are removed.

Future themes (`night`, `bright`, `pink-white`, `pink-blue`) will add another
token block under the same root contract. They must not require rewriting
component selectors or changing room business state.

## Entry Page

The entry view becomes a concise welcome surface. Nickname remains a shared
prerequisite. Joining an existing room by URL/ID is visually primary; creating
a room remains available as a quieter secondary disclosure. Existing validation,
normalization, request, error, and routing behavior stay unchanged.

The layout is content-first and asset-light. It uses clear labels and helper
text, preserves keyboard form submission, has visible focus states, and does
not rely on color alone to communicate invalid or disabled state.

## Room Shell and Responsive Layout

The room keeps the player as its visual and interaction priority.

- Desktop: player stage with a persistent chat side panel; controls and
  playlist retain a readable two-column workbench.
- Tablet (around 768px): reduce gutters and compact the workbench while keeping
  controls readable and actions reachable.
- Narrow mobile (around 375px): player remains first; room controls and
  playlist stack vertically; chat becomes an expandable panel rather than a
  permanently width-constrained side rail.

The cinema layout remains a distinct player-owned mode. Fullscreen, player
controls, danmaku overlay geometry, and media timing are not animated or
restructured by this task.

## Motion

Add Anime.js as a narrowly scoped dependency. Use its tree-shakeable WAAPI
animation path through a reusable `useRoomMotion` composable, not through
component-scattered imperative calls.

Allowed motion is limited to:

1. A short room-shell entrance after the room view mounts.
2. Open/close transitions for non-media panels, such as chat and informational
   dialogs/popovers.
3. One-shot status confirmation for a completed user-visible state change,
   such as reconnection or successful admission.

All effects use opacity and transform, are capped at 200–300ms, are cancellable
on unmount or replacement, and are skipped for `prefers-reduced-motion`.
Navigation never waits for an animation. CSS remains responsible for basic
hover, focus, pressed, and disabled feedback. No motion is added to video,
playback timeline, danmaku, list reordering, or background decoration.

## Accessibility and Validation

All themes must preserve contrast and visible focus rings. Interactive controls
remain real semantic controls with existing i18n-backed labels. Responsive
acceptance includes desktop, 768px tablet, and 375px narrow mobile; reduced
motion is a first-class manual check. Browser review is required before commit
because layout, motion, and visual hierarchy cannot be proven by unit tests.

## Risks and Rollback

The main risk is visual refactoring accidentally altering the room's ownership
boundaries or making mobile controls inaccessible. Keep business handlers and
typed props/emits intact; extract only presentation and motion helpers. A
rollback can remove the new token stylesheet, motion composable, and Anime.js
dependency while restoring the prior view styles without touching room protocol
or player logic.
