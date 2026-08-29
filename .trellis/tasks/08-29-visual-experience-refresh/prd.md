# Houkago visual and interaction refresh

## Goal

Raise Houkago's perceived quality and visual coherence so the entry and shared
watch-room experience feels like one intentional product rather than a set of
individually finished feature panels. Preserve the product's media-first,
URL-first watch-party behavior while establishing a durable visual foundation
for later UI slices.

## Background

- On 2026-08-29, the user paused the mobile provider companion and selected
  project-wide visual polish as the next mainline direction.
- The Vue client has two top-level routes: the entry/authentication view and the
  room view. The room contains player, chat, governance, queue, provider,
  subtitle, and danmaku surfaces.
- A completed 2026-07 task established the `warm-club` theme: paper-like cream
  surfaces, restrained wood/amber accents, soft elevation, accessible focus,
  responsive room layouts, and limited reduced-motion-safe animation.
- Current UI evidence shows a sparse entry page and a dense room workbench.
  Semantic color, spacing, radius, and elevation tokens exist, but typography,
  control sizing, status, layer, and motion semantics are incomplete and
  component-local literal values remain.
- Existing Playwright coverage already exercises desktop, tablet, phone,
  subtitle, governance, and danmaku layouts. Visual work must extend those
  behavioral contracts rather than replacing them with screenshot-only tests.

## Requirements

1. Evolve the established identity as **Warm Club 2.0**. Preserve calm cream
   and paper-like surfaces, wood/amber accents, warm ink text, soft elevation,
   and restrained Japanese editorial character; improve coherence and depth
   without turning the application into a new brand. Raw design-tool output is
   research, not product authority.
2. Establish a coherent semantic design foundation for typography, color,
   spacing, radii, elevation, control sizes, status treatment, layering, and
   motion before applying broad page-level styling.
3. Improve hierarchy and cohesion across the entry experience and room shell,
   then address dense feature surfaces through independently reviewable slices.
4. Preserve router behavior, authentication, room membership and governance,
   player ownership, playback synchronization, chat, queue, provider,
   subtitle, and danmaku contracts.
5. Keep the player as the room's visual priority. Desktop retains a persistent
   chat side panel; narrow mobile retains the player-first vertical layout and
   accessible expandable chat sheet.
6. Preserve semantic controls, keyboard operation, visible focus, non-color
   status cues, at least 44px touch targets, readable contrast, and
   `prefers-reduced-motion` behavior.
7. Validate affected slices at 375px phone, 768px tablet, and representative
   desktop widths with no accidental horizontal overflow or hidden critical
   controls.
8. Deliver the refresh as bounded child slices so each visual change can be
   reviewed and rolled back without mixing unrelated product behavior.

## Acceptance Criteria

- [ ] The approved direction and semantic visual rules are recorded in task
  design artifacts before product UI changes begin.
- [ ] Entry and room surfaces visibly share one hierarchy, typography, control,
  elevation, and state language while preserving their distinct purposes.
- [ ] The room remains media-first in normal and cinema layouts, and all
  existing player/chat/workbench ownership boundaries remain intact.
- [ ] Phone, tablet, and desktop layouts remain operable without horizontal
  overflow, obscured controls, or hover-only primary actions.
- [ ] Keyboard focus, accessible names, contrast, touch targets, loading/error/
  disabled states, and reduced-motion behavior remain testable and intact.
- [ ] Focused browser scenarios cover each changed visual slice; full lint,
  typecheck, unit tests, build, and applicable Playwright projects pass before
  parent integration is considered complete.
- [ ] No new provider, mobile companion, media transport, room protocol, or
  credential behavior is introduced by the visual refresh.

## Out of Scope

- Mobile provider companion or mobile Baidu playback.
- New provider adaptors, content discovery, or new media capabilities.
- Changes to playback synchronization, authorization, room protocol, or
  credential handling.
- A user-visible theme selector or multiple theme family in the first slice,
  unless separately approved during planning.
- Character illustration, large decorative background assets, or a marketing
  landing-page information architecture unless separately approved.

## Child Map

1. `.trellis/tasks/08-29-warm-club-foundation-entry` — approved first child;
   establishes token architecture and the entry/authentication baseline.
2. Room shell and media/workbench hierarchy — proposed follow-up after the
   foundation child is accepted.
3. Queue and dense-control consistency — proposed follow-up after the room
   shell has adopted the shared component/state language.
4. Dialog, gate, chat-sheet, and cinema-state polish — proposed final surface
   convergence and parent integration slice.
