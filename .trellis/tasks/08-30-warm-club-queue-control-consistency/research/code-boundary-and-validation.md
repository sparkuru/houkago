# Research: code boundary and validation

- Query: Determine the exact implementation boundary for the approved Warm Club queue rows/actions/feedback and URL source composer slice, including tokens, state/responsive treatment, focused coverage, validation, and rollback risks.
- Scope: internal (repository code/spec/task evidence) plus repository-local UI/UX guidance; no external network research
- Date: 2026-08-30

## Findings

### Boundary conclusion

The narrow implementation should be limited to these presentation surfaces:

1. Queue markup and queue-only styles in `packages/kyoushitsu/src/views/BushitsuView.vue`.
2. The closed launcher strip and inline URL form/preview/action presentation in `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue`.
3. A small set of queue/composer component recipes in `packages/kyoushitsu/src/assets/theme.css`, derived only from existing semantic and `--room-*` tokens.
4. Focused semantic/responsive assertions and diagnostic screenshots in `packages/kyoushitsu/e2e/desktop-room.spec.ts` and `packages/kyoushitsu/e2e/mobile-room.spec.ts`.

The recommended implementation does **not** require changes to queue permission helpers, stores, API/WS calls, composer composables, i18n copy, provider components, or dialog markup. Existing logic already exposes the states needed for a presentation-only pass.

| Surface | Allowed treatment | Hard boundary |
| --- | --- | --- |
| `BushitsuView.vue` queue section | Queue heading/count hierarchy, row wrappers, source/current marks, semantic action classes/groups, existing disabled/pending bindings, feedback layout, queue-only responsive CSS | Do not change handlers, eligibility expressions, permission `v-if`s, REST/WS calls, current-item resolution, or optimistic state behavior |
| `EnmokuComposer.vue` | Launcher hierarchy, URL/title fields, hint/error/preview, action grouping, existing resolving/submitting/readonly/disabled state styling, responsive layout | Do not change `useEnmokuPreview`, `useBaiduSource`, queue/switch semantics, Escape-versus-close behavior, or provider lifecycle |
| `theme.css` | Add narrowly named `--room-queue-*` / `--room-composer-*` recipes derived from existing semantic or room recipes | No new palette, raw component colors, theme selector, or unrelated component recipes |
| Playwright | Assert roles/labels/states, touch sizes, focus visibility, bounds/overflow, responsive wrapping, and capture review screenshots | No pixel baselines and no selectors coupled to incidental DOM depth |

Explicit exclusions:

- `KengenPanel.vue`, `ChatPanel.vue`, player, danmaku, subtitle, gates, cinema behavior, and all corresponding styles/logic.
- The native clear-pending dialog at `BushitsuView.vue:997-1018` and its styles at `BushitsuView.vue:1495-1534`.
- The provider information dialog beginning at `BushitsuView.vue:1019`.
- `BaiduConnectionDialog` and `BaiduFileDialog` at `EnmokuComposer.vue:168-193`, plus their source lifecycle handlers at `EnmokuComposer.vue:44-78`. The existing Baidu buttons may receive the same launcher-row presentation as their peers, but their visibility, labels, handlers, dialogs, and provider states must not change.

### Current facts and code patterns

#### Queue ownership and behavior

- `BushitsuView` imports all queue eligibility decisions from `lib/bangumi-actions.ts`; it does not define permission policy itself (`packages/kyoushitsu/src/views/BushitsuView.vue:17-24`). The helpers separately preserve playlist capability, owner-only ordering/clear, current-item cancellation, and current-item delete protection (`packages/kyoushitsu/src/lib/bangumi-actions.ts:1-37`).
- Pending-count, clear eligibility, move request identity, clear request state, and queue success/error strings already exist as local/derived view state (`BushitsuView.vue:59-72`). No new store or state machine is needed for visual state treatment.
- Play/cancel/delete/move/clear handlers preserve server authority: play/cancel emit existing `JOUEI`, delete calls the existing endpoint, move awaits REST and then relies on a snapshot, and clear awaits REST without locally rewriting the queue (`BushitsuView.vue:396-452`). The state-management spec requires `BANGUMI` to remain a full server snapshot and forbids local finalization of reorder/clear (`.trellis/spec/frontend/state-management.md:55-65`).
- The queue surface is `details.bangumi-disclosure`, containing heading/count, `EnmokuComposer`, owner-only clear, live feedback, and rows (`BushitsuView.vue:881-994`). The heading count is already visible in the portrait summary at `:883-886`.
- Current rows already carry both `aria-current="true"` and visible `上映中` text, so current state is not color-only (`BushitsuView.vue:911-928`). Preserve both while improving border/surface hierarchy.
- Action eligibility is explicit and must stay byte-for-byte equivalent in meaning: playlist users see play/cancel/delete; only owners see move controls; move boundaries remain disabled; any move in flight disables all move buttons (`BushitsuView.vue:938-988`). Do not hide disabled boundary actions or narrow the in-flight lock to one button.
- Queue management feedback already has `role="alert"` for errors and `role="status"` for success (`BushitsuView.vue:904-909`). Improve its surface and spacing without changing reset/precedence logic (`queueManagementError` wins through `v-else-if`).
- The source badge is visible text with a title and therefore does not depend on color for meaning (`BushitsuView.vue:455-465`, `:918-924`). It can be made quieter and Warm Club-consistent without adding provider branching.

#### URL composer ownership and behavior

- `EnmokuComposer` owns only local open state and composes `useEnmokuPreview` / `useBaiduSource`; `BushitsuView` supplies room id and `canPlaylist`, and receives the existing `jouei` intent (`packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue:10-18`).
- Explicit close resets the draft, while Escape only collapses it (`EnmokuComposer.vue:21-28`, `:114-119`). The mobile browser spec proves this distinction by retaining the URL after Escape and clearing only through the close action (`packages/kyoushitsu/e2e/mobile-room.spec.ts:82-103`). Styling or markup grouping must not merge these behaviors.
- Queue and queue-and-switch both call the same `add()` operation; only the latter emits `jouei` after creation (`EnmokuComposer.vue:30-42`). Do not relabel this as guaranteed autoplay or change event timing.
- Permission loss closes the URL composer and Baidu file dialog (`EnmokuComposer.vue:80-87`). Launcher `v-if` rules must remain: URL add and Baidu browse require `canPlaylist`, while connection management remains visible (`EnmokuComposer.vue:92-113`).
- The form already provides visible labels, semantic URL input/autocomplete, a persistent helper, alert error, labelled preview region, loading labels, and native disabled/readonly states (`EnmokuComposer.vue:114-166`). The presentation pass should expose these states more clearly, not invent validation or provider behavior.
- `useEnmokuPreview` owns the actual `editing -> resolving -> preview -> submitting/error` behavior and typed API calls (`packages/kyoushitsu/src/composables/useEnmokuPreview.ts:15-85`). Any change to that file would be scope drift for this task.

#### Existing tokens and styling inconsistencies

- `theme.css` already has primitive, semantic, and component layers, including a 44px control height, 3px focus outline, motion durations, semantic danger/focus colors, and room surfaces (`packages/kyoushitsu/src/assets/theme.css:4-127`, `:165-196`). Global focus and reduced-motion handling are defined at `theme.css:214-226`.
- The component spec requires queue/shell work to reuse `--room-*`, avoid raw colors, keep 44px portrait controls, and retain no-overflow/player-first shell behavior (`.trellis/spec/houkago-kyoushitsu/frontend/component-guidelines.md:55-79`). Required viewport checks are desktop-short, desktop-tall, phone-375, and ipad-mini (`component-guidelines.md:105-112`).
- `BushitsuView` currently creates queue-local aliases (`--row-surface`, `--row-border`, `--row-current-*`, `--danger-text`) inside a selector shared with `.room-control-panel` (`BushitsuView.vue:1307-1325`). `EnmokuComposer` implicitly depends on inherited `--row-border` and `--danger-text` (`EnmokuComposer.vue:198-210`, `:254-273`). This parent-local variable dependency is the clearest token boundary to normalize.
- Queue row/actions satisfy the minimum 44px height, but use mixed literal spacing/radii and a flat action hierarchy (`BushitsuView.vue:1397-1494`). `.bangumi-actions` is defined at `:1475-1478` but is not used by the current template; a presentation-only wrapper can activate that existing concept without moving logic.
- `EnmokuComposer` also satisfies 44px fields/buttons, but its form uses local literal gaps/padding and surface aliases rather than room recipes (`EnmokuComposer.vue:197-298`). Its focus rule replaces the global 3px teal focus ring with a component-local 2px accent mix (`:299-305`), creating avoidable focus inconsistency.
- The generated local UI/UX design-system search suggested a vibrant dark entertainment palette and hosted fonts. That direction is rejected because it conflicts with the approved cream/wood Warm Club palette and the archived room-shell decision. The useful cross-checks were limited to existing project rules: 44px targets, 8px spacing, visible focus, textual/live-region feedback, responsive no-overflow, and reduced motion.

### Recommended token treatment

Add only a minimal component-recipe layer under the existing room recipes in `theme.css`. Exact values should derive from current semantic/room values; no new primitives are warranted. A coherent minimal set is:

```css
--room-queue-row-surface: var(--room-panel-raised-surface);
--room-queue-row-border: var(--room-panel-border);
--room-queue-current-surface: var(--room-panel-muted-surface);
--room-queue-current-border: var(--room-status-accent);
--room-queue-control-surface: var(--room-panel-raised-surface);
--room-queue-control-hover: var(--color-interactive-subtle);
--room-queue-feedback-surface: var(--room-panel-muted-surface);
--room-queue-danger-surface: var(--color-danger-subtle);
--room-queue-danger-border: var(--color-danger-border);
```

Use these recipes in both the queue parent and composer child. Prefer existing `--control-height`, `--space-*`, `--radius-*`, `--color-text*`, and global focus tokens rather than adding aliases for every declaration. If the final CSS needs fewer recipes, collapse the set; do not create generic names that could leak into `KengenPanel` or chat.

Recommended cleanup:

- Replace the inherited generic `--row-*` / `--danger-text` dependency with explicit `--room-queue-*` recipes.
- Keep error text/surface derived from existing danger semantics. Keep ordinary success/status feedback neutral or accent-bounded with visible text; there is no approved semantic success-green token, so do not create one for this slice.
- Let global `:focus-visible` supply the authoritative outline. Component rules may change border/background on focus but should not replace the global outline width/color.
- Keep source marks text-labelled and use a quiet room/queue recipe rather than letting provider blue dominate every direct/HLS/DASH badge.

### Recommended state and action treatment

#### Queue rows

- Preserve row DOM order: source mark -> title/provider status -> current/status information -> actions. Wrappers may group identity, status, and actions, but CSS `order` must not produce a different visual and keyboard sequence.
- Current: retain `aria-current` and `上映中`; use both the current border and muted current surface. Do not add animation or change playback eligibility.
- Move pending: reuse `movePendingId`; add presentation/semantics such as row/action-group `aria-busy` and a stable non-color busy mark while retaining the existing all-move-buttons disabled lock. Do not add a second request flag or optimistic row motion.
- Disabled: keep native `disabled`; use reduced emphasis plus cursor treatment, but maintain readable labels and at least 44px bounds. Boundary controls remain visible so the ordering model is understandable.
- Feedback: render the existing status/alert as a bounded inline notice with text, border, surface, and adequate padding. Do not turn it into a transient toast, auto-dismiss it, or connect it to play/cancel/delete, because current state only reports move/clear outcomes.
- Action hierarchy: visually distinguish the existing play/primary action, quiet cancel/order actions, and danger delete/clear actions through semantic classes. Do not remove actions, change labels, or replace explicit move buttons with drag-and-drop/gesture controls.
- Keep provider-info launcher styling queue-consistent if touched, but do not restyle or edit the provider dialog it opens.

#### URL composer

- Closed state: one clear primary URL-add launcher; existing Baidu browse and connection-management launchers stay secondary/quiet peers with unchanged gating and behavior.
- Editing: treat labels/fields/helper as one compact form group on the muted room surface. Preserve required URL semantics, `readonly` preview fields, and both labels.
- Resolving: preserve the existing `正在解析…` label and disabled inputs. A stable busy treatment may use `aria-busy`/state class derived from `resolving`; no new request behavior is needed.
- Preview ready: keep title/type/provider as text. Make “加入队列” the primary action, “加入并切换…” secondary, and “编辑” quiet. This is presentation hierarchy only; click handlers and emit timing remain unchanged.
- Submitting/error: preserve the existing `正在加入…` label, native disabled actions, and `role="alert"`. Do not clear the draft on failure or add automatic retries.
- Motion: keep the current transform/opacity-only entry and existing reduced-motion behavior (`EnmokuComposer.vue:310-318`, global reduction at `theme.css:219-226`). Use the duration/easing tokens if the animation declaration is touched; do not animate queue reorder or layout dimensions.

### Recommended responsive treatment

- Desktop/landscape: do not change `.bushitsu`, `.stage`, `.room-workbench`, player sizing, or chat rail. `.stage` is the only intended desktop vertical scroll owner (`BushitsuView.vue:1096-1118`), and the workbench queue column already uses `minmax(0, 1fr)` (`:1275-1283`). Queue internals may wrap within that column only.
- Short desktop (`1280x640`): expanded composer and the final queue action must remain reachable through `.stage` scrolling. Do not add a nested composer scroll region.
- Tall desktop (`1280x1200`): keep workbench content-sized; row actions may wrap but should not make the queue visually compete with the player.
- Portrait phone/tablet: retain the existing breakpoint `(max-width: 800px) and (orientation: portrait)` and native `details` disclosures (`BushitsuView.vue:1693-1827`). This covers the configured 375x812 phone and 768x1024 iPad Mini projects.
- At portrait widths, keep row identity on the first line and action group on a full-width subsequent line. Prefer a two-column action grid or wrapping flex where every control remains at least 44px high with an 8px gap; danger actions should remain visibly separated.
- The composer launcher row should stack naturally. In preview-ready state, make the primary queue action full-width and allow secondary actions to stack or occupy a second row. Avoid fixed widths and ensure `min-width: 0` on field/action containers.
- Keep the current bounded queue list scroll (`max-height: min(48dvh, 360px)` at `BushitsuView.vue:1825-1827`) and verify the last action is reachable without document horizontal overflow.
- No new breakpoint is needed for this slice. Adding a component-local portrait rule that matches the room's existing media query is safer than introducing unrelated tablet/desktop layout logic.

### Existing focused coverage and gaps

#### Playwright facts

- `desktop-room.spec.ts:163-179` proves short-desktop stage scrolling reaches an expanded URL field.
- `desktop-room.spec.ts:181-192` proves tall-desktop workbench remains content-sized.
- `desktop-room.spec.ts:194-248` proves the player/workbench/chat relationship and `scrollWidth <= innerWidth`, with a diagnostic screenshot.
- `mobile-room.spec.ts:19-50` runs for both phone-375 and ipad-mini and proves player-first order, 44px disclosure/launcher controls, and no horizontal overflow.
- `mobile-room.spec.ts:82-103` proves portrait URL composer disclosure, labels/actions, Escape draft retention, and explicit-close reset.
- `room-governance.spec.ts:188-271` proves owner move/current/clear behavior, disabled move boundaries, member absence of owner-only controls, full-snapshot convergence, and preservation of the current item. It runs under both governance-phone and governance-desktop projects (`packages/kyoushitsu/playwright.config.ts:70-82`).
- `room-governance.spec.ts:273-293` also guards existing composer launcher permission rules for members.

Focused additions should stay in the two approved room specs:

- Desktop: seed representative current/pending rows; assert visible source/current text, semantic action grouping, 44px action bounds, focus-visible outline, disabled boundary state, move `aria-busy`/disabled state while a routed request is held, success `role=status`, error `role=alert`, and no horizontal overflow. Capture a queue/composer diagnostic screenshot.
- Phone/iPad: seed enough rows to exercise wrapping; assert every critical queue/composer action stays within viewport, has at least 44px height, preserves label/tab order, and leaves the final action reachable. Exercise editing, resolving/error or preview-ready state through controlled routes if stable fixtures are available. Capture a disclosure-open diagnostic screenshot.
- Reduced motion: if composer animation declarations change, run the focused composer case with `page.emulateMedia({ reducedMotion: "reduce" })` and assert the state remains immediately operable. Do not add a pixel/timing baseline.
- Leave governance behavior assertions unchanged and run them as regression evidence. A change required to make them pass would be a warning that behavior or selector ownership drifted.

#### Unit facts

- `test/bangumi-actions.test.ts:11-46` covers current identity, owner-only move, move boundaries, owner/pending clear eligibility, playlist play gating, current delete protection, and current-only cancel.
- `test/bushitsu-store.test.ts:251-270` covers full `BANGUMI` snapshot replacement and id deduplication.
- `test/theme.test.ts:4-12` covers only the root warm-club selector/default; it does not validate CSS recipe values.
- There is no focused unit test for `useEnmokuPreview`; current composer interaction coverage is browser-level. That is acceptable for a CSS/markup-only slice. If implementation needs to modify the composable or queue helpers, stop and re-scope rather than adding logic tests after the fact.
- Do not introduce a Vue component-test framework or brittle CSS source-string tests for this slice. Computed-style, semantic-state, and responsive assertions belong in Playwright; the existing pure unit tests should remain unchanged and pass.

### Files found

- `packages/kyoushitsu/src/views/BushitsuView.vue` — queue orchestration, queue markup, feedback, actions, responsive queue styles, and excluded dialogs/shell siblings.
- `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue` — URL composer UI/state bindings plus excluded Baidu provider dialogs and lifecycle.
- `packages/kyoushitsu/src/assets/theme.css` — authoritative Warm Club primitive -> semantic -> component token hierarchy and global focus/reduced-motion rules.
- `packages/kyoushitsu/src/lib/bangumi-actions.ts` — authoritative queue action eligibility; regression-only for this slice.
- `packages/kyoushitsu/src/composables/useEnmokuPreview.ts` — authoritative URL preview/add state and API calls; regression-only for this slice.
- `packages/kyoushitsu/src/stores/bushitsu.ts` — server-authoritative queue snapshot owner; no change expected.
- `packages/kyoushitsu/e2e/desktop-room.spec.ts` — short/tall desktop composer reachability and room-shell bounds; likely focused assertion/screenshot changes.
- `packages/kyoushitsu/e2e/mobile-room.spec.ts` — phone/iPad disclosure, composer, touch-target, and overflow coverage; likely focused assertion/screenshot changes.
- `packages/kyoushitsu/e2e/room-governance.spec.ts` — owner/member queue behavior regression suite; run unchanged.
- `packages/kyoushitsu/test/bangumi-actions.test.ts` — queue eligibility unit coverage; run unchanged.
- `packages/kyoushitsu/test/bushitsu-store.test.ts` — queue snapshot/deduplication unit coverage; run unchanged.
- `packages/kyoushitsu/test/theme.test.ts` — theme-root contract only; run unchanged.
- `.trellis/spec/houkago-kyoushitsu/frontend/component-guidelines.md` — active room-shell ownership, token, accessibility, viewport, and validation contract.
- `.trellis/spec/frontend/state-management.md` — authoritative queue/theme ownership constraints.
- `.trellis/spec/frontend/quality-guidelines.md` — repository `./dx` workflow and fixed-desktop/document-scroll portrait contract.
- `.trellis/spec/trellis-plus/index.md` — authoritative Playwright command, projects, browser, screenshot, and human-review policy.
- `.trellis/tasks/archive/2026-08/08-30-warm-club-visual-followup/` — completed room-shell child establishing player-first hierarchy and reserving dense queue controls for this later slice.
- `.trellis/tasks/archive/2026-08/08-07-queue-management/design.md` — original owner-only move/clear, explicit-button, server-snapshot, accessibility, and rollback contract.
- `.trellis/tasks/archive/2026-07/07-18-content-discovery/design.md` — original inline composer state, Escape/close, permission, feedback, and responsive contract.

### Related specs and archived decisions

- The active room-shell spec declares `BushitsuView` presentation-only and forbids queue/API/WS/store rewiring (`.trellis/spec/houkago-kyoushitsu/frontend/component-guidelines.md:55-60`).
- The archived shell PRD explicitly deferred dense queue-control recipes to a later child (`.trellis/tasks/archive/2026-08/08-30-warm-club-visual-followup/prd.md:83-87`).
- The archived shell design places queue/composer inside the secondary workbench, below the media priority (`.../design.md:21-68`), and makes `BushitsuView` plus room recipe tokens the presentation rollback unit (`.../design.md:196-206`).
- The archived shell validation recorded green focused short/tall/phone/iPad projects and diagnostic screenshots, while preserving all queue/provider/store behavior (`.../validation.md:3-30`, `:63-73`).
- The original queue design requires explicit labelled controls rather than drag-and-drop, native disabled boundaries, owner-only move/clear, server-snapshot convergence, 44px targets, and non-color destructive meaning (`.trellis/tasks/archive/2026-08/08-07-queue-management/design.md:67-87`).
- The original composer design requires visible labels, one primary resolve action, inline preview/error, Escape draft retention, explicit-close reset, 44px/8px touch spacing, and no manual Pinia append (`.trellis/tasks/archive/2026-07/07-18-content-discovery/design.md:98-141`).

### External references and versions

- No external network source was needed; project-local specs and completed task evidence are more specific than generic guidance.
- Repository versions relevant to validation are Vue `^3.5.0`, Vite `^8.0.0`, TypeScript `^5.6.0`, and `vue-tsc ^3.0.0` (`packages/kyoushitsu/package.json:14-32`), with Playwright `^1.61.1` and Biome `^1.9.4` at the workspace root (`package.json:14-18`).
- The repository-local UI/UX Pro Max database was queried for entertainment/social video queue and form guidance. Its palette/style recommendation was rejected as incompatible; its accessibility/form checks corroborate the project-specific 44px, focus, disabled/loading, live-feedback, no-overflow, and reduced-motion contracts.

### Files likely affected

Expected implementation diff (five files):

1. `packages/kyoushitsu/src/assets/theme.css`
2. `packages/kyoushitsu/src/views/BushitsuView.vue`
3. `packages/kyoushitsu/src/components/bangumi/EnmokuComposer.vue`
4. `packages/kyoushitsu/e2e/desktop-room.spec.ts`
5. `packages/kyoushitsu/e2e/mobile-room.spec.ts`

Expected unchanged regression files include `room-governance.spec.ts`, `bangumi-actions.test.ts`, `bushitsu-store.test.ts`, `useEnmokuPreview.ts`, `stores/bushitsu.ts`, `i18n/messages.ts`, `KengenPanel.vue`, `ChatPanel.vue`, all Baidu dialog components, and API/WS code. A required change to one of those files should trigger explicit scope review.

### Validation commands

Run focused checks first:

```bash
./dx bun test packages/kyoushitsu/test/bangumi-actions.test.ts packages/kyoushitsu/test/bushitsu-store.test.ts packages/kyoushitsu/test/theme.test.ts
./dx bun test packages/kyoushitsu/test
./dx bun run --filter houkago-kyoushitsu typecheck
./dx bun run lint
./dx bun run --filter houkago-kyoushitsu build
```

Start the documented services in a separate foreground terminal:

```bash
./dev.sh
```

Then run the four approved queue/composer viewport projects:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=desktop-short --project=desktop-tall --project=phone-375 --project=ipad-mini
```

Run the focused queue-governance regression on phone and desktop without changing its assertions:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=governance-phone --project=governance-desktop --grep "owner reorders and clears pending sources|control policy presets converge"
```

Finally run the full Kyoushitsu browser suite and inspect diagnostic screenshots/traces; screenshots are review evidence, not baselines:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

Also record `git diff --check` and a changed-path inspection during implementation handoff. The archived shell validation recorded unrelated full-suite governance and root-test failures on 2026-08-30 (`validation.md:20-30`); re-run and classify current failures rather than assuming those historical results still apply.

### Scope and rollback risks

| Risk | Specific failure mode | Guard / rollback |
| --- | --- | --- |
| Shared selector leakage | Editing `.room-control-panel, .bangumi` or `.room-disclosure summary, .bangumi-disclosure summary` restyles `KengenPanel`/room controls | Add queue-specific selectors after shared shell rules; revert queue-only rules without touching room-control styles |
| Child token coupling | Renaming inherited `--row-border` without updating composer makes fields/buttons lose borders | Introduce explicit theme recipes and migrate parent/child atomically; rollback the three presentation files together |
| Behavior drift in template cleanup | Wrappers alter `v-if`, `disabled`, handlers, tab order, or Playwright names | Keep bindings/labels/handler expressions unchanged; semantic role/label tests and unchanged governance E2E are the guard |
| Optimistic queue UI | Animating/reordering rows before `BANGUMI` creates divergence between clients | No list-transition/reorder state; retain snapshot-driven DOM and roll back any new queue state immediately |
| Pending concurrency change | Enabling other move buttons while one request runs permits overlapping reorder requests | Preserve `movePendingId !== null` as the global move disable condition |
| Dialog scope creep | Queue feedback styles or danger recipes spread into clear/provider/Baidu dialogs | Exclude dialog markup/selectors from the diff; use queue/composer-root-scoped recipes |
| Provider scope creep | Launcher restyle turns into edits to Baidu connection/file flows | Shared launcher CSS only; no changes below `EnmokuComposer.vue:168` or to `useBaiduSource` |
| Portrait overflow | Five queue actions or three preview actions exceed 375px or make the final row unreachable | Full-width wrapped/grouped actions, `min-width: 0`, 44px/8px checks, phone/iPad bounds assertions |
| Nested scrolling | New max-height/overflow on composer or rows competes with `.stage`/document/queue list scroll owners | Do not add scroll owners; preserve shell and list overflow declarations |
| Focus regression | Component-local outline overrides global focus or clipped wrappers hide it | Use global `:focus-visible`, keep overflow around focused actions visible, assert computed outline and keyboard focus |
| State becomes color-only | Current, danger, success, error, or disabled status loses textual/native cue | Preserve `aria-current`, visible labels, `role=status`, `role=alert`, and native `disabled`; tokens are supplemental |
| Motion regression | New row/list motion ignores reduced motion or changes layout | No reorder/list animation; keep composer transform/opacity only and global reduction; rollback animation declaration alone |
| Over-broad rollback | Reverting the whole room shell loses the completed parent hierarchy | Primary rollback is only `theme.css` queue recipes + queue sections of `BushitsuView.vue` + `EnmokuComposer.vue` presentation and their focused test additions |

## Caveats / Not Found

- No mounted Vue component unit-test harness or CSS-token unit contract was found. Browser computed-style/state checks are the appropriate focused validation for this presentation slice.
- No focused `useEnmokuPreview` unit test was found. This is not a blocker while its composable logic remains unchanged.
- Existing Playwright queue behavior coverage is strong, but current desktop/mobile visual specs do not yet seed dense queue rows or assert queue action focus/pending/error/success presentation. Those are the main validation gaps for this task.
- The archived room-shell screenshots are temporary historical evidence and may no longer exist in `test-results`; the new task must capture and review fresh diagnostic screenshots.
- Real-device dynamic text/zoom and assistive-technology behavior remain residual risks after Playwright. Avoid truncation-dependent assertions and preserve visible text labels to reduce that risk.
