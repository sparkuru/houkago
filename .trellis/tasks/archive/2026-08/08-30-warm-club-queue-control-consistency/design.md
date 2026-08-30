# Design: Warm Club queue and dense-control consistency

## 1. Outcome and boundary

This child refines two presentation surfaces in the entered Kyoushitsu room:
the queue rendered by `BushitsuView.vue` and the URL source workflow rendered
by `EnmokuComposer.vue`. It makes their information hierarchy, action
variants, state feedback, spacing, and responsive behavior consistent with
Warm Club 2.0.

The implementation is presentation-only. It must preserve queue ordering,
action eligibility, owner/playlist permissions, API and WebSocket payloads,
store ownership, source resolution, Baidu authorization/file selection,
playback switching, and all existing dialog behavior. `KengenPanel`,
`ChatPanel`, player controls, provider/danmaku panels, gates, chat sheet,
cinema state, and dialogs are not redesign targets.

## 2. Existing ownership and invariants

| Concern | Current owner | Contract for this child |
| --- | --- | --- |
| Queue snapshot and permissions | `useBushitsuStore` and server messages | Consume unchanged |
| Queue action eligibility | `src/lib/bangumi-actions.ts` | Reuse unchanged; do not duplicate |
| Queue requests and feedback state | `BushitsuView.vue` | Preserve handlers and live-region semantics |
| URL preview/add workflow | `useEnmokuPreview` through `EnmokuComposer.vue` | Preserve state machine and events |
| Baidu source workflow | `useBaiduSource` and existing dialogs | Keep launch behavior; do not restyle dialogs |
| Room layout/scroll ownership | `BushitsuView.vue` room-shell contract | Player remains primary; `.stage` remains desktop scroll owner |
| Theme values | `src/assets/theme.css` | Extend component recipes from existing semantic/room tokens |

No route, store, composable, shared type, backend package, or protocol change
is expected. If implementation discovers that product behavior must change,
return to planning instead of extending this child.

## 3. Visual hierarchy and component anatomy

### Queue surface

- Keep the existing heading, disclosure, list, and action DOM order.
- Treat the list as a sequence of compact workbench rows, not cards competing
  with the media stage.
- Preserve the source marker, title, provider availability detail,
  `aria-current`, and textual current-item status.
- Present playback as the primary row action when it is available. Keep
  cancel and move actions secondary, and separate delete/clear treatment as
  destructive. Do not hide existing actions behind a new overflow menu.
- Keep queue success and failure messages next to the affected surface with
  existing `role="status"` / `role="alert"` behavior.
- Keep the clear-pending confirmation dialog structurally and visually outside
  this redesign; only its launcher may adopt the queue action recipe.

### URL source composer

- Preserve the launcher order and behavior: add link, browse Baidu, manage
  Baidu connection.
- Give each launcher an explicit hierarchy: add link primary, browse
  secondary, connection management quiet/tertiary.
- Preserve visible labels, semantic URL input, helper text, preview content,
  Escape collapse, close reset, and current focus behavior.
- Keep resolve/add/add-and-switch/edit actions visible. Async controls remain
  disabled during `resolving` or `submitting`; visual pending treatment must
  not imply completion.
- Use the existing text error message rather than color-only field treatment.

## 4. Token architecture

Do not add primitive palette or typography values. Add only component recipes
needed to replace the queue/composer-local aliases and literal spacing/radius
values. Recipes live in the Warm Club theme block in `theme.css` and derive
from existing semantic or `--room-*` tokens.

The implementation should converge on the following responsibilities; exact
names may be adjusted once all current consumers are searched:

| Recipe group | Responsibilities | Derivation |
| --- | --- | --- |
| `--queue-row-*` | default/current surface, border, radius, spacing | `--room-panel-*`, semantic spacing/radius/accent |
| `--queue-action-*` | primary, secondary, quiet, destructive, disabled states | semantic accent/surface/danger/focus tokens |
| `--queue-status-*` | current, success, error text/surface/border | semantic accent/danger plus text labels |
| `--composer-*` | panel/field/preview surfaces, border, spacing, action variants | room panel and shared control tokens |

State priority is disabled -> loading -> active -> focus -> hover -> default.
Focus should use the global focus tokens rather than a separate component-only
ring. Transitions may affect color, background, border, shadow, opacity, or
small transform feedback only; they must not change layout dimensions.

## 5. Responsive behavior

- Preserve the existing workbench and disclosure breakpoints and scroll
  owners; do not add nested horizontal scrolling.
- Desktop queue rows may use a compact grid/flex arrangement with title space
  protected by `min-width: 0` and the action group aligned to the end.
- At tablet and portrait widths, allow the action group to wrap into a second
  row or full-width shelf with at least `var(--space-2)` separation.
- Keep primary fields and actions at least `var(--control-height)` tall. On
  375px, composer launchers and action groups may stack rather than shrink
  below useful touch size.
- Preserve title ellipsis and its existing full-value affordance; do not let
  long titles or provider status text push actions beyond the viewport.

## 6. Accessibility and feedback

- Retain semantic `button`, `form`, `label`, `input`, `ul`, and `li` elements.
- Retain dynamic `disabled`, `aria-expanded`, `aria-current`, alert, and status
  attributes. Add ARIA only where a changed visual state lacks an existing
  semantic equivalent.
- Keep visible focus, keyboard order matching DOM order, and Escape behavior.
- Current, disabled, pending, success, error, and destructive meanings must
  use text or semantics in addition to color.
- Maintain at least 44px primary targets and sufficient separation between
  adjacent touch actions.
- Preserve reduced-motion behavior. The existing composer entrance may be
  tokenized, but this child adds no new signature animation.

## 7. Verification design

Extend existing semantic Playwright scenarios instead of introducing pixel
baselines:

- desktop-short: expanded composer remains reachable through `.stage` scroll;
- desktop-tall: workbench remains content-sized, queue/action hierarchy is
  visible, and current/disabled states are distinguishable;
- phone-375 and ipad-mini: disclosure, rows, launcher/forms, and action groups
  remain inside the viewport with 44px targets and no horizontal overflow;
- focused source-composer path: open, retain draft on Escape collapse, reset on
  explicit close, and expose resolving/add states without double submission;
- queue path: current row/status, permission-gated actions, move boundaries,
  feedback regions, and destructive separation remain observable.

Screenshots are human-review evidence for density and hierarchy, not committed
pixel baselines. Existing queue unit tests remain the behavior authority.

## 8. Compatibility, rollback, and residual risk

There is no migration or rollout switch. Changes should stay inside queue /
composer component recipes, scoped styles, and focused browser tests.

Rollback is file-local: remove the new component recipes and restore the
previous scoped styles; no persisted data or protocol rollback is required.
The largest risks are shared-token leakage, dense action wrapping at
intermediate widths, long translated labels, and accidentally changing
disabled/current semantics while simplifying markup. Full Kyoushitsu checks
and visual review remain required because CSS changes can affect states that
unit tests do not render.

## 9. Expected file impact

- `packages/kyoushitsu/src/assets/theme.css`
- `packages/kyoushitsu/src/views/BushitsuView.vue`
- `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue`
- `packages/kyoushitsu/e2e/desktop-room.spec.ts`
- `packages/kyoushitsu/e2e/mobile-room.spec.ts`

No other product file should change unless implementation evidence is brought
back to planning first.
