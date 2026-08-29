# Warm Club 2.0 entry research

## Approved product direction

- Preserve and deepen the existing `warm-club` identity rather than rebrand.
- Use a quiet, asset-light school-floor/classroom-selection metaphor.
- Keep attention on choosing the intended classroom; decorative atmosphere is
  subordinate to the entry actions.
- The metaphor only reframes existing join-by-room-id/link and create-room
  behavior. There is no public, recent, recommended, or discoverable room list.
- Do not use character art, a large hero image, hosted fonts, or a marketing
  landing-page structure.

## Repository evidence

- `packages/kyoushitsu/src/assets/theme.css` already defines the cream canvas,
  paper surfaces, wood accent, warm ink, focus ring, elevations, radii, spacing,
  and reduced-motion fallback.
- `packages/kyoushitsu/src/views/HomeView.vue` owns all current authentication,
  account, join, create, pending, and error presentation. It prefetches the room
  route on entry intent and must keep that behavior.
- `packages/kyoushitsu/src/stores/seito.ts` already exposes `restoring`, so the
  page can present session restoration without adding global state or changing
  authentication flow.
- Existing room Playwright helpers depend on the visible labels for registration
  and room creation. Keep accessible names stable or update all affected tests
  in the same slice.
- The archived July frontend-refactor design established an asset-light,
  media-first warm club room and prohibited a theme selector or second palette.

## Design-system synthesis

Use one CSS file with clearly separated primitive, semantic, and component
layers. Preserve all existing semantic token names as compatibility aliases so
room components do not change appearance as a side effect. Add only the missing
typography, control, state, layer, and motion contracts needed by the entry
slice and later children.

Use system/local font stacks. A Japanese/Chinese-capable serif display stack can
add the restrained editorial note, while the existing rounded/system sans stack
continues to own forms and interface copy. No network font is needed.

The environmental effect should come from layout and CSS: quiet wall/corridor
planes, a restrained floor sign, classroom-threshold cards, thin architectural
lines, and soft elevation. Avoid literal illustrated doors, noisy textures,
animated backgrounds, stickers, glow, or ornamental objects.

## Approved motion direction

Anime.js `^4.5.0` already exists. The current `useRoomMotion` composable uses
its tree-shakeable WAAPI path, skips motion for `prefers-reduced-motion`, tracks
animations, cancels on unmount, and limits presets to 180–220ms opacity and
transform changes.

The user approved one restrained signature sequence:

1. After the entry state stabilizes, the floor sign fades and translates into
   place over roughly 180ms.
2. Known-classroom and new-classroom surfaces follow with a 30–40ms offset,
   opacity, and no more than 8px translation; the whole entrance ends within
   260ms.
3. Login/register or secondary form replacement may use one cancellable 180ms
   opacity/translation transition.
4. Hover, focus, pressed, disabled, and loading feedback remains CSS-owned.
5. Navigation proceeds immediately and never waits for a success animation.

Do not add looping motion, particles, breathing lights, parallax, 3D door
rotation, card bounce, animated background texture, or media/list animation.
Extract shared WAAPI lifecycle management and keep entry/room parameters in
named presets rather than scattering raw calls through Vue components.
