# Warm Club 2.0 foundation and entry

## Goal

Establish the reusable Warm Club 2.0 visual foundation and prove it on
Houkago's entry/authentication experience. The page should feel welcoming,
recognizable, and intentionally composed while remaining fast, accessible,
asset-conscious, and behaviorally unchanged. Entering Houkago should feel like
arriving on a quiet school floor and choosing the appropriate classroom, with
no unrelated visual feature competing for attention. Deployment owners must be
able to replace the activity-room identity and related entry copy through one
strict public `config/config.toml` without editing Vue or translation source.

## Background

- This is the first independently reviewable child of
  `08-29-visual-experience-refresh`, selected by the user on 2026-08-29.
- The current entry page is a centered 480px column with a large bilingual
  title and one or two functional cards. It is clear but visually sparse on
  desktop and has little product framing beyond the title.
- The existing `warm-club` root theme already centralizes a cream/wood palette,
  three elevation levels, three radii, a 4–32px spacing scale, focus treatment,
  and reduced-motion fallback.
- Authentication, registration, session restore, sign-out, room join, room
  creation, error presentation, prefetch, and routing behavior already exist
  and are outside the visual implementation boundary.
- The user approved an asset-light school-floor/classroom-selection metaphor:
  the interface should evoke a calm corridor and classroom thresholds through
  composition, type, surfaces, signs, and restrained CSS/SVG detail rather than
  character art or a large illustrative hero.
- The metaphor is presentation only. The user confirmed that this slice keeps
  the current join-by-room-id/link and create-room behavior and does not expose
  or discover a list of rooms.
- Anime.js `^4.5.0` is already installed and the room uses a WAAPI-based motion
  composable with reduced-motion detection and unmount cancellation. The user
  approved extending that existing motion language rather than adding a new
  animation dependency.
- After reviewing the implemented entry, the user approved its atmosphere and
  attention hierarchy but found the fixed `放学后 / HOUKAGO` identity too
  prominent. `社团活动室` is the new default and the subtitle is optional.
- The repository currently has no product TOML loader or runtime public-config
  endpoint. Housou and Kyoushitsu run as separate processes, while existing
  secrets and operational controls are supplied through `.env`.
- Firefly (`/home/wkyuu/cargo/repo/11-firefly`) is the approved reference for a
  strict single-source TOML contract, unknown-key rejection, immutable parsed
  values, source/field diagnostics, startup failure on invalid configuration,
  negative tests, and an explicit public-versus-secret boundary. Its Astro
  build-time delivery is not copied because Houkago is a runtime-separated SPA
  and server.

## Requirements

1. Keep the root theme id `warm-club` and evolve it compatibly; do not add a
   selector, alternate theme, or room-synchronized presentation state.
2. Organize the existing stylesheet into an explicit three-level token model:
   stable primitives, theme semantic aliases, and narrowly scoped component
   recipes. A single CSS file with clear layers is acceptable; no generator or
   new runtime dependency is required.
3. Add missing semantic scales for display/body/label typography, line height,
   interactive control height, state surfaces, borders, focus, elevation,
   duration/easing, and layout layers. Existing components must keep resolving
   their current token names during incremental migration.
4. Apply the system to every entry state: restoring/loading, sign-in,
   registration, authenticated account, join room, create room, disabled/
   pending actions, and error feedback.
5. Keep joining an existing room visually primary after authentication and
   room creation available but secondary. Do not add content discovery,
   marketing sections, or navigation unrelated to entering Houkago.
6. Make the authenticated entry composition read as a quiet school floor where
   the user's next action is choosing a classroom. Classroom signs, room-number
   language, threshold/door framing, and subtle environmental depth may support
   orientation; they must not become decorative focal points of their own.
7. Map the metaphor directly onto existing actions: joining by room id/link is
   entering a known classroom, while creating a room is opening a new classroom.
   Do not query, infer, recommend, or display other rooms.
8. Use semantic form controls with visible labels, clear hierarchy, keyboard
   submission, visible focus, at least 44px targets, readable contrast, and
   adjacent recovery-oriented error feedback.
9. Keep motion subtle and functional: 150–200ms color, border, elevation,
   opacity, or transform feedback; no layout-blocking animation, continuous
   decoration, or behavior under `prefers-reduced-motion`.
10. Add one distinctive Anime.js sequence: after entry state stabilizes, the
    floor sign fades/slides into place and the known/new classroom surfaces
    follow by 30–40ms, using only opacity and at most 8px translation with a
    total duration no longer than 260ms. Login/register or secondary-form
    changes may use one cancellable 180ms opacity/translation transition.
11. Centralize Anime.js WAAPI execution, reduced-motion detection, animation
    tracking, cancellation, and unmount cleanup in a shared motion runner.
    Entry and room composables own named presets; components do not scatter raw
    Anime.js calls or parameters.
12. Keep the first slice self-contained to the shared theme foundation,
   `HomeView`, its strings/tests, the bounded public site-config path, and
   focused browser evidence. Room components may consume compatible token
   aliases and shared motion lifecycle code but are not visually redesigned.
13. Add one tracked, public, non-secret `config/config.toml` as the only editable
   site-config source. It contains `[site]` and `[entry]`; do not add a JSON,
   YAML, environment-serialized, or second example source for the same values.
14. The public config supports `site.name` (default `社团活动室`), optional
   `site.subtitle` (omitted means no second identity line), optional
   `site.browserTitle` (defaults to `site.name`), plus `entry.floorCode`,
   `entry.floorLabel`, `entry.hint`, `entry.privacyNote`, and
   `entry.defaultBushitsuName`.
15. Keep authentication/action/error labels and ordinary translations in i18n.
   Keep OAuth credentials, encryption keys, CORS, ports, database paths, Komon
   controls, and every other secret or operational value in `.env` or its
   existing owner; never include them in the TOML response.
16. Define the exact public `SiteConfig` schema, type, and transport fallback in
   Kousoku. Housou parses the TOML once at startup, rejects malformed TOML,
   unknown/missing fields, empty/untrimmed/multiline/control-containing text,
   and reports source plus field without echoing full values. Valid normalized
   output is immutable for the process lifetime.
17. Expose only the validated public projection from an unauthenticated typed
   `GET /site-config` endpoint. The route returns the same startup object and
   does not serialize the raw TOML tree or `process.env`.
18. Kyoushitsu loads the typed config once before mounting, updates
   `document.title`, and shares the immutable result without adding room/session
   Pinia state. If the endpoint is unavailable, it uses the Kousoku default and
   emits a value-free warning; invalid server config must already have stopped
   Housou rather than silently defaulting.
19. Config changes take effect after restarting Housou and refreshing the
   browser. Hot reload, polling, an administration editor, and per-room
   branding are not part of this slice.

## Acceptance Criteria

- [ ] The token stylesheet has documented primitive, semantic, and component
  layers without breaking existing `warm-club` consumers.
- [ ] Sign-in, registration, authenticated/join/create, pending, disabled, and
  error states share one clear visual hierarchy and remain behaviorally intact.
- [ ] The entry composition feels intentionally filled at desktop width without
  becoming a marketing landing page, reads as a quiet school floor/classroom
  choice, and remains uncluttered at 375px.
- [ ] Primary, secondary, and quiet actions have consistent default, hover,
  active, focus, disabled, and loading treatment without layout shift.
- [ ] All entry controls remain keyboard operable, visibly labelled, at least
  44px high, and readable at WCAG AA contrast targets.
- [ ] Reduced motion removes nonessential transitions; no remote font or heavy
  decorative asset blocks first paint.
- [ ] The one-time floor-sign/classroom sequence finishes within 260ms, panel
  transitions finish within 180ms, navigation never waits for animation, and
  all running entry/room animations cancel on replacement or unmount.
- [ ] Anime.js remains the existing dependency and is called only through
  shared lifecycle management plus named room/entry presets.
- [ ] Focused unit and Playwright scenarios cover unauthenticated and
  authenticated desktop/phone entry states, including error and pending
  feedback; package build, typecheck, lint, and tests pass.
- [ ] Room, player, chat, queue, provider, subtitle, danmaku, authentication,
  and routing contracts are unchanged.
- [ ] The floor sign defaults to `社团活动室` with no subtitle; every approved
  public field can be changed through `config/config.toml` and appears in the
  entry/browser title without editing frontend source.
- [ ] Housou fails before listening when the tracked TOML is malformed or
  semantically invalid, while errors identify the source/field without dumping
  configuration values.
- [ ] `GET /site-config` returns only the shared strict public shape; sentinel
  secret environment values are absent from the serialized response.
- [ ] Kyoushitsu requests the config once before mount, has no old-brand flash,
  falls back to the shared default only on transport failure, and uses the
  configured default room name for empty-name creation.
- [ ] Unit/API/browser tests cover valid config, optional defaults, unknown and
  unsafe values, public projection, frontend fallback/memoization/title, a
  custom long name at desktop/375px, and all existing entry/room regressions.

## Out of Scope

- Room-shell, player, chat, queue, dialog, governance, provider, subtitle, or
  danmaku redesign.
- Alternate themes, a theme selector, or dark mode.
- New authentication or room-entry behavior.
- New hosted fonts, font packages, character illustrations, large hero images,
  or image-heavy presentation.
- A public room directory, room recommendations, presence browsing, or other
  room-discovery behavior.
- Moving secrets or operational settings from `.env`, adding private config
  namespaces, filesystem override paths, live reload/polling, an admin config
  editor, or serving arbitrary raw config values.
