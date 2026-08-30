# Design: Warm Club 2.0 room shell hierarchy

## 1. Boundary and invariants

This child changes the visual shell of the entered Kyoushitsu room. It owns
the room canvas, player-stage framing, media metadata strip, desktop chat rail
relationship, room-control/queue workbench wrappers, portrait disclosures, and
cinema-state presentation.

The child does not change authentication, admission, room membership,
WebSocket messages, playback synchronization, queue ordering, permissions,
provider resolution, subtitle selection, danmaku source selection, or the
behavior of inner feature components. The existing `BushitsuView` route remains
the orchestration boundary; no new global UI store is introduced.

The player remains the room's strongest visual and spatial priority. Chat is a
persistent desktop companion, not a second page destination. On portrait
phones, the player comes first, followed by a reachable chat launcher and
deliberately collapsible room-control and queue sections.

## 2. Current composition and ownership

```text
BushitsuView
└── .bushitsu (room viewport / cinema state)
    ├── .stage (scrolling media column)
    │   ├── .player-wrap / EnmokuPlayer + overlays
    │   ├── TimelineDanmakuSourcePanel
    │   ├── .media-toolbar / metadata
    │   └── .room-workbench
    │       ├── .room-control-panel / KengenPanel
    │       └── .bangumi / EnmokuComposer + queue rows
    ├── mobile-chat-sheet / ChatPanel (portrait)
    └── ChatPanel (desktop rail)
```

`BushitsuView` owns local layout state such as `cinemaMode`, `chatHiraku`,
`portraitRoom`, and chat-sheet open/expanded flags. `useBushitsuStore` remains
the writer-backed source for room truth; the shell only reads derived values
and passes existing callbacks/props through.

`EnmokuPlayer`, `ChatPanel`, `KengenPanel`, `EnmokuComposer`, and
`TimelineDanmakuSourcePanel` retain their internal markup and behavior in this
slice. Their outer surface can receive inherited or scoped component tokens,
but their domain logic and interaction contracts must not be rewritten.

## 3. Visual hierarchy model

The shell uses five visual zones, ordered by attention:

1. **Media stage** — dark media surface, 16:9 player, overlays, and any
   provider/loading state. It gets the strongest contrast and the largest
   uninterrupted area.
2. **Media context** — the optional metadata strip immediately below the
   player. It is quiet and compact; it must never compete with playback.
3. **Conversation rail** — the desktop chat panel stays visually adjacent to
   the stage with a shared border/elevation rhythm. Its open/closed handle is
   an affordance, not a decorative tab.
4. **Room workbench** — room information/settings and the queue are related
   secondary panels. They use one panel recipe but retain distinct headings and
   permissions.
5. **Transient surfaces** — nickname/admission gates, provider information,
   queue confirmation, and the portrait chat sheet sit above the shell using
   the existing overlay layer and dismissal behavior.

Visual hierarchy is expressed with size, whitespace, surface contrast, and
elevation before accent color. The room should feel like a quiet club room,
not a dashboard of equally weighted cards.

## 4. Token plan

`packages/kyoushitsu/src/assets/theme.css` remains the single token source. Add
room recipes only in the component layer, deriving every value from existing
semantic tokens. Candidate names should follow the existing naming pattern:

| Recipe | Purpose | Derivation |
| --- | --- | --- |
| `--room-canvas-background` | room viewport canvas | `--color-canvas` / glow |
| `--room-stage-gutter` | desktop and portrait stage inset | `--space-3` → `--space-5` |
| `--room-media-radius` | player/placeholder frame | `--radius-md` |
| `--room-panel-surface` | workbench/chat surface | `--color-surface` |
| `--room-panel-raised-surface` | active or raised panel layer | `--color-surface-raised` |
| `--room-panel-border` | wrapper separators | `--color-border` |
| `--room-panel-elevation` | secondary panel shadow | `--elevation-panel` |
| `--room-floating-elevation` | dialogs/sheets | `--elevation-floating` |
| `--room-section-gap` | relationship between zones | `--space-2` / `--space-3` |
| `--room-status-accent` | current/connected state | `--color-accent` |

The exact token set may be smaller if existing aliases are sufficient. Do not
add literal hex/rgb values to Vue components or create a room-only palette.
Preserve the public semantic aliases and root `data-theme="warm-club"` boundary.

## 5. Layout and responsive behavior

### Desktop and landscape

- Keep `.bushitsu` and `#app` within the existing fixed viewport contract.
- Keep `.stage` as the intentional vertical scroll owner when a short window
  cannot show the player, composer, and workbench together.
- Keep the player at a 16:9 tendency with a definite minimum height and avoid
  stretching empty workbench panels in tall windows.
- Let the desktop `ChatPanel` consume a stable rail without overlaying the
  player or creating an extra document scrollbar.
- Use a bounded, repeatable gutter and panel gap from the spacing scale.
- Preserve the existing collapsed-chat hot zone and keyboard-visible handle.

### Tablet

- Keep media first and allow the workbench to remain below it or collapse into
  the existing disclosure pattern according to the current breakpoint.
- Ensure panel headings, room status, and queue count remain visible without
  forcing horizontal scrolling.

### Portrait phone

- Keep the document-scrolling portrait shell and definite `aspect-ratio:
  16 / 9` player container.
- Keep the chat launcher full-width and at least 44px high, with the existing
  modal sheet, expand, close, Escape, and focus-restore behavior.
- Preserve native `details` disclosures for room controls and queue. Their
  summary rows remain the first-level affordance; inner content remains
  unchanged.
- Use safe bottom spacing so the last queue/action row is not hidden behind a
  sheet or browser gesture area.

### Cinema mode

Cinema mode keeps a black/media canvas, removes supporting
workbench/context/mobile-entry surfaces from the visual flow, and keeps the
desktop chat rail as the established conversation companion. The player
remains the only primary surface; `DanmakuOverlay` stays inside the player.
The existing `EnmokuPlayer` cinema control and parent `cinemaMode` state remain
unchanged; only the shell's transition and surface tokens may be refined.

## 6. Motion

Use the existing `useRoomMotion` wrapper and `useInterfaceMotion` lifecycle.
If a shell transition needs adjustment, add a named room preset rather than a
raw `animejs` call in `BushitsuView` or a child component.

- Enter/confirmation and panel replacement remain opacity/transform only,
  approximately 160–220ms, with the established ease-out curve.
- Motion communicates admission, panel opening, or cinema continuity; no
  looping background, parallax, list reorder, or player animation is added.
- Every replacement cancels the prior target animation. Every unmount cancels
  remaining animations.
- `prefers-reduced-motion` makes the presets no-ops while preserving the final
  layout and immediate interaction.
- Navigation and media controls never wait for a visual animation.

## 7. Accessibility and interaction

- Keep semantic `main`, `aside`, `section`, `details`, `dialog`, headings, and
  existing labels/roles.
- Keep DOM/tab order aligned with the player-first visual order. CSS ordering
  must not move primary controls after secondary panels for assistive tech.
- Preserve visible `:focus-visible` rings, `aria-expanded`, `aria-controls`,
  `aria-current`, status/live regions, and dialog Escape/cancel behavior.
- Keep all primary actions and disclosure summaries at least 44px high with an
  8px separation where adjacent.
- Status distinctions use text, labels, borders, or marks in addition to color.
- Avoid icon-only additions. If a visual affordance needs an icon, use the
  existing text/semantic control or a consistent vector asset already in the
  project; do not add emoji glyphs.

## 8. Data and compatibility flow

```text
WS / REST -> useBushitsuStore -> BushitsuView computed/local layout state
                           -> existing child props and event callbacks
                           -> unchanged player/chat/queue behavior
```

The shell must not fetch room state, create a second WebSocket, mutate
`useBushitsuStore` optimistically, or copy permission/playback rules. Any new
class or token is presentation-only. Existing route URLs, room IDs, API calls,
and test fixture responses stay valid.

## 9. Validation and visual evidence

Focused browser coverage should exercise:

- admitted room at `1280x900` or `1280x1200` with player, chat rail, metadata,
  and workbench visible;
- `1280x640` short desktop with stage scroll and expanded composer reachability;
- `768x1024` tablet with no horizontal overflow;
- `375x812` portrait with player-first order, chat sheet open/expand/close,
  room and queue disclosures, and focus restoration;
- cinema mode with support surfaces hidden and player retained;
- reduced motion and keyboard-visible controls.

Use semantic assertions, computed bounds, and diagnostic screenshots. There is
no approved pixel baseline; screenshots are review evidence only. Preserve the
existing room governance, subtitle, danmaku, provider, and admission tests.

## 10. Rollback and risk

Primary rollback unit is `BushitsuView.vue` plus any room component-layer token
additions and room-motion preset changes. Reverting them restores the current
room shell without a data migration or API change.

Main risks are accidental player-height changes in short windows, nested
scrollbars, mobile sheet overlap, a visually over-emphasized chat rail, and
style leakage into inner provider/danmaku components. The implementation plan
requires a short/tall desktop check and portrait check after each layout group
before moving to the next group.
