# Design: Warm Club 2.0 foundation and entry

## 1. Boundary

This child changes the entry presentation in `houkago-kyoushitsu` and adds one
bounded public configuration path through `houkago-kousoku` and
`houkago-housou`. It evolves the global theme token file and home route while
letting deployment owners replace the public activity-room identity and entry
copy without editing application source. It does not change authentication
decisions, room creation/joining, route paths, room discovery, room/session
Pinia ownership, or any room/player component.

The existing `data-theme="warm-club"` selector remains the only application
theme. `applyTheme()` continues to set it locally; theme identity never enters
room state or WebSocket data.

## 2. Visual model

The home route is a quiet school floor, not a landing page.

- The full viewport supplies low-contrast architectural structure: warm wall
  planes, restrained horizontal threshold/baseboard lines, and subtle depth.
- The brand remains a compact floor sign rather than a giant hero.
- The floor sign defaults to `社团活动室`; its optional subtitle is absent by
  default instead of repeating a fixed `HOUKAGO` identity.
- Before authentication, one clear registration/sign-in desk controls entry.
- After authentication, the content becomes a small classroom-choice zone:
  the primary known-classroom form accepts the current room id/link; a quieter
  secondary form opens a new classroom. No other classroom is shown.
- CSS layout, borders, type, surface layering, and optional inline decorative
  SVG provide atmosphere. There is no raster illustration or remote asset.
- Decorative layers use `pointer-events: none`, stay outside the accessibility
  tree, and never reduce text/control contrast.

Desktop may use an asymmetric two-column composition within a bounded shell:
the quiet floor sign/context occupies the smaller rail and the active form/card
occupies the larger rail. Authenticated join/create cards may sit side by side
with the join card dominant. At 768px and below the composition becomes one
ordered column; at 375px it keeps 12px minimum gutters and no horizontal scroll.

## 3. Token architecture

Keep `assets/theme.css` as the single source, divided into three documented
layers so the incremental room migration does not require a new build system.

| Layer | Responsibility | Examples |
| --- | --- | --- |
| Primitive | Stable raw warm-paper, ink, wood, status, size, and time values | paper/ink/wood tones, 4px spacing base, type sizes, 44px control, radii, durations |
| Semantic | Product meaning and theme mapping | canvas, surface, raised surface, text, muted text, accent, danger, focus, panel elevation, display/body type |
| Component | Entry-specific recipes derived only from semantics | floor shell, classroom card, field, primary/secondary/quiet button, status notice |

Compatibility rules:

- Existing public variables such as `--color-canvas`, `--color-surface`,
  `--color-text`, `--color-accent`, `--space-*`, `--radius-*`, and `--shadow-*`
  remain available with equivalent values in this slice.
- New component variables never contain a second literal palette; they resolve
  through semantic aliases.
- Shared type tokens use a local serif display stack and the existing
  rounded/system UI stack. No font is fetched or bundled.
- Motion tokens define fast/normal duration and standard/exit easing. Entry
  feedback uses color, border, opacity, elevation, and at most a 1px press
  translation; no width/height animation or continuous environmental motion.

## 4. Entry component and state contract

The home route keeps its current component/state ownership. Markup is reorganized
for hierarchy, not split into a reusable component library before repetition
exists.

| State | Primary surface | Required feedback |
| --- | --- | --- |
| restoring session | entry desk skeleton/status | `aria-live` status; controls do not flash a false signed-out decision |
| sign in | authentication form | visible labels, password visibility action, pending label/disabled submit |
| register | same form recipe | mode heading and switch action change without layout jump |
| authenticated | classroom-choice zone | quiet account identity/sign-out; known classroom remains primary |
| join | known-classroom form | existing normalization, submit disabling, and room-route prefetch preserved |
| create | new-classroom form | existing default-name and creation behavior preserved; visually secondary |
| failure/revocation | adjacent status notice | `role="alert"`, cause/recovery wording, non-color cue |

The strings currently hardcoded in `HomeView` move into the existing i18n message
table so the visual hierarchy does not introduce a second copy source. Existing
accessible button names used by Playwright remain stable unless every dependent
test is updated in the same change.

## 5. Accessibility, performance, and compatibility

- Use semantic `main`, `header`, headings, forms, labels, buttons, and status
  regions in logical DOM/tab order; visual reordering must not change it.
- Controls are at least 44px high with an 8px separation where adjacent.
- Normal text targets 4.5:1 contrast; control boundaries and focus indicators
  target 3:1. Status never relies on color alone.
- `prefers-reduced-motion` keeps the existing near-zero duration fallback.
- Use CSS/SVG only, reserve layout space, and add no network font, image request,
  or runtime UI dependency.
- Preserve `HomeView` room-view prefetch on field focus and before navigation.
- Existing room token consumers must render equivalently after the token file is
  layered; the room is regression-tested but not restyled.

## 6. Anime.js motion architecture

Anime.js is already installed. Keep its `waapi` implementation and split
lifecycle from page-specific choreography:

```text
use-interface-motion.ts
  prefersReducedMotion + run + cancel + unmount cleanup
        ├── use-room-motion.ts  (existing public presets preserved)
        └── use-entry-motion.ts (floor entrance + panel replacement)
```

- `use-interface-motion` owns animation tracking and cancels a target's prior
  animation before replacement, then cancels all remaining animations before
  component unmount.
- `use-room-motion` preserves `enterRoom`, `enterPanel`, `confirm`, `cancel`, and
  the existing `prefersReducedMotion` import compatibility while delegating the
  lifecycle machinery.
- `use-entry-motion` exposes named `enterFloor` and `replacePanel` presets. The
  component supplies refs/targets but contains no raw Anime.js parameters.
- `enterFloor` runs only after session restoration has resolved and DOM state is
  stable. The floor sign uses approximately 180ms opacity/6px translation; the
  classroom surfaces use opacity/8px translation with a 30–40ms offset and a
  total sequence no longer than 260ms.
- `replacePanel` uses 180ms opacity/6px translation for login/register or
  secondary-form replacement. It never delays semantic state change or focus.
- Hover, focus, active, disabled, and loading feedback stays in CSS. Navigation
  starts immediately; success does not wait for an entry-page animation.
- Reduced motion makes both presets no-ops. There is no looping, background,
  parallax, 3D, media, danmaku, or list-reorder animation.

## 7. Public site configuration

Firefly is the contract reference, not a copy target. Reuse its strict TOML,
single-source, immutable-value, source/field diagnostic, negative-test, and
public-versus-secret principles. Do not reuse its Astro build-time embedding:
Houkago runs Kyoushitsu and Housou separately and should not require a frontend
rebuild for an operator copy change.

### 7.1 Source and schema

`config/config.toml` is tracked and contains public values only:

```toml
[site]
name = "社团活动室"
# subtitle = "Houkago"
# browserTitle = "社团活动室"

[entry]
floorCode = "2F"
floorLabel = "社团活动楼层"
hint = "沿着安静的走廊，前往你已经约好的教室。"
privacyNote = "这里不会展示其他教室。请使用收到的教室号码或邀请链接。"
defaultBushitsuName = "新部室"
```

Kousoku owns `SiteConfigSchema`, the derived `SiteConfig` type, and the deeply
frozen default. The normalized transport always contains `site.name`, nullable
`site.subtitle`, resolved `site.browserTitle`, and every required `entry`
field. TOML omission represents optional values; `browserTitle` resolves to
`name` and `subtitle` resolves to `null`.

Objects are strict. Every displayed value must be non-empty after trimming,
already trimmed, single-line, and free of control/line-separator characters.
`subtitle` may be omitted but not supplied as an empty string. Unknown sections
or keys, missing required values, malformed/duplicate TOML, and unsafe strings
are startup errors with source and field context and without value dumps.

There is no alternate JSON/YAML/env representation. Secrets and operational
values remain in their existing `.env`/runtime owners. The public response is
constructed from `SiteConfig`, never from a generic parsed object or
`process.env`.

### 7.2 Runtime data flow

```text
config/config.toml
  -> Housou load + strict validation before listen
  -> frozen SiteConfig process singleton
  -> unauthenticated GET /site-config (Cache-Control: no-store)
  -> Eden Treaty client
  -> one memoized Kyoushitsu bootstrap load before mount
  -> document.title + HomeView + empty-name room creation
```

The canonical path is resolved from the Housou loader module rather than the
process working directory. This first slice has no arbitrary override path. A
future container can copy or read-only mount the same path; no production
container contract is invented here.

Kyoushitsu keeps this immutable presentation input outside Pinia room/session
truth. A small loader memoizes one promise and uses the Eden client. Successful
bootstrap stores the normalized value for the page lifetime. Transport failure
returns the shared Kousoku default and logs only a generic warning; it does not
leave the page blank. The static HTML title is also the safe default so the old
brand never flashes before JavaScript. Config is not polled or hot-reloaded;
operators restart Housou and refresh browsers after editing.

### 7.3 Consumer boundary

- `site.name` replaces the floor-sign heading.
- `site.subtitle` renders the small second identity line only when non-null.
- `site.browserTitle` sets `document.title`.
- `entry.floorCode`, `floorLabel`, `hint`, and `privacyNote` replace the
  deployment-specific Home i18n constants.
- `entry.defaultBushitsuName` supplies the existing empty-name create request.
- Authentication, form, button, pending, failure, and other translation copy
  remains in `messages.ts`.

## 8. Validation and rollback

Add focused desktop and 375px Playwright projects for the home route. Cover
restoring/unauthenticated structure, registration mode, authenticated classroom
choice, pending/disabled state, error notice, keyboard focus, touch size, and
horizontal overflow. Add a reduced-motion case and deterministic assertions that
the entrance reaches its stable state without blocking interaction. Use
semantic/style assertions and diagnostic screenshots, not committed screenshot
baselines.

Add Kousoku schema/default tests, Housou parser and route tests, and Kyoushitsu
loader tests. Negative fixtures cover malformed/duplicate TOML, unknown and
missing fields, unsafe strings, and diagnostics. An API test injects sentinel
secret environment values and proves they are absent. Browser coverage injects
a custom long public identity, verifies the title/subtitle/default-room mapping,
and retains desktop/375px overflow and attention hierarchy evidence.

Run package tests, typecheck, build, repository lint, and the existing room
browser projects affected by shared token compatibility. Before submit-ready,
run the full repository test/typecheck/lint gate and inspect `git diff --check`.

Rollback is limited to the token layer, home view/messages, shared/entry motion
composables, the internal room-motion refactor, the public config schema/loader/
route/bootstrap, and entry browser configuration/tests. The existing room-motion
public API is preserved. No data migration exists; reverting the public config
path and entry changes restores the previous fixed identity.
