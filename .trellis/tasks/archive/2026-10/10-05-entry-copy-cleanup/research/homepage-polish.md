# Research: Homepage polish after copy cleanup

- Query: Refine only the homepage against typography, whitespace, hierarchy, color, motion, microinteraction, responsive composition and originality while preserving the owner's five copy removals.
- Scope: internal; external award criteria and current browser inspection are assigned to the main session.
- Date: 2026-10-05

## Findings

### Files found

- `packages/kyoushitsu-react/src/routes/home.tsx` — homepage composition, configured identity/hint/privacy, restoring/error/anonymous/signed-in branches.
- `packages/kyoushitsu-react/src/styles/index.css:25` — homepage layout and presentation through line 363; later rules style rooms.
- `packages/kyoushitsu-react/src/features/entry/entry-panel.tsx` — account status plus join/create cards, focus, submission and navigation.
- `packages/kyoushitsu-react/src/features/identity/identity-panel.tsx` — login/registration modes, reveal-password control, pending behavior and focus.
- `packages/kyoushitsu-react/src/features/entry/classroom-scene.tsx` — original inline 640×340 classroom drawing, decorative and noninteractive.
- `packages/kyoushitsu-core/src/theme/theme.css` — Warm Club primitives, semantic colors/spacing/type/motion and entry/room recipes; shared scope.
- `packages/kyoushitsu-react/e2e/entry.spec.ts` — 13 entry cases per desktop/phone project including restore, credentials, join/create, configuration, widths and reduced motion.
- `packages/kyoushitsu-react/src/components/ui/{card,input,button}.tsx` — shared primitives; controls already have 44px minimum height and semantic native elements.
- `config/config.toml` — current public copy, optional subtitle currently absent.
- `packages/kyoushitsu-core/src/i18n/messages.ts:6` — preserved entry-overline and repeated scene/closing strings.
- `.trellis/tasks/archive/2026-10/10-04-visual-craft-refinement/{design,validation}.md` — accepted architectural editorial direction and historical verification, before this owner's latest text edits.

### Concrete improvements and acceptance checks

1. **Restore a deliberate typographic anchor with existing copy.** The former large title is gone; remaining `.floor-overline` is 13px muted type (`index.css:79`), the configured masthead h1 is also 13px (`:65`), while form h2 is 24px (`:160`). Promote the existing exact sentence `留一点时间，给彼此。` (`messages.ts:6`, `home.tsx:40`) to a restrained serif display treatment and intentional Chinese line breaking, rather than putting the removed site title back. Use the existing display font and token-derived size/spacing, with responsive scale. Acceptance: exactly one configured site-name h1 in the masthead; no wordmark or lower duplicate name; hero is the first visual anchor at desktop and phone, without forcing fields below an unnecessarily tall hero. Keep it a paragraph if the unique semantic h1 remains the site name.

2. **Give the repeated invitation distinct visual roles without rewriting it.** `config/config.toml` hint, `messages.ts:7` scene caption and `messages.ts:8` closing currently all equal `灯光已留好，等你和同伴入座。`; `home.tsx:44,81,85` renders all three. Repeating the same line at equal emphasis dilutes hierarchy. Main session explicitly chose to preserve repeated user text in this implementation; follow that decision. Make the configured hint the readable supporting invitation, the caption a quiet figure annotation and the closing a restrained footer detail, with differentiated position, measure and type emphasis. Do not change config/messages or remove the preserved scene description. Deduplication was considered as a semantic-content-preserving alternative, but is not the current approved implementation direction. Acceptance: each existing rendering remains unchanged, a distinct custom configured hint remains visible, and repetition no longer competes with the principal typographic anchor.

3. **Rebalance the left composition instead of preserving the absent title's space.** Current grid has a separate auto intro row and a `1fr` scene row, both alongside the center-aligned desk (`index.css:39-54,130-136,188-193`), with a further fixed 48px intro inset (`:74`). After removal the compact text can strand the drawing at mid-page with excessive gaps. Tune column ratio, intro top inset, scene alignment and row gaps together so the hero and drawing feel like one quiet editorial panel while the desk has one clear vertical axis. Keep max-width 1120px and use current 24/32/48/64px rhythm where practical. Acceptance: inspect anonymous, registering and signed-in forms at 1280×900, 1280×640 and 1440×900; neither an accidental empty band nor collisions; footer stays readable without forcing short viewports into fixed heights. On phone keep intro → usable form → drawing → footer order.

4. **Give the shortened join card its own coherent density.** Join now has one kicker and a label, field and button (`entry-panel.tsx:65-103`); its header still uses the same border/padding rule as the multi-line identity/create header (`index.css:141-144`). Keep exact `输入部室 ID 或 URL`, but strengthen its instructional type and remove excess header separation only on the join card if browser inspection shows a floating small line. A homepage-specific class can rank join as the primary surface and make create quieter without adding a heading or badge. Acceptance: `#join-heading` absent; named region remains exactly `输入部室 ID 或 URL`; label for room ID stays; primary join and secondary create are immediately distinguishable; both cards and account strip align at all widths.

5. **Normalize editorial and card paragraph margins explicitly.** `.brand-romanized` has color/letter-spacing but no margin recipe (`index.css:115-118`); `.card-kicker` also lacks margins (`:297-301`); the overline and hint do reset margin. Tailwind preflight currently governs otherwise-unset spacing, so the design depends on class-specific omissions rather than a consistent header rhythm. Define local heading stacks and deliberate gaps for optional subtitle, kicker, h2 and help text using existing tokens; preserve all text. Acceptance: absent subtitle leaves no reserved blank row; long subtitle wraps; auth heading/help and create heading/help maintain a consistent vertical cadence; join's single-line header is proportionate.

6. **Refine the original scene's depth with its existing shapes.** The bespoke SVG (`classroom-scene.tsx:3-24`) already supplies originality and an appropriate club-room metaphor. Its light path is painted before a translucent wall (`:4-5`) and colors are correctly token-based (`index.css:200-227`). Improve the light treatment, focal screen contrast and secondary line hierarchy rather than introducing stock imagery or new decorative content. A token-derived gradient and carefully separated line opacities can support a quiet lit projection feel. Acceptance: SVG remains decorative `aria-hidden`, has no misleading play action or hover cursor, no looping animation; sharp at phone/tablet/wide sizes; drawing enhances the left column without outshining form controls; use existing colors and no dependencies.

7. **Use purposeful, stable control feedback scoped to home.** Buttons already have 160ms transitions and 1px press translation (`index.css:270-285`); inputs have no transition recipe and rely on shared focus outline (`components/ui/input.tsx`, `theme.css` end). Add subtle local input border/surface transition, `focus-within` surface feedback where useful, and button hover/active contrast/elevation; do not translate whole cards. A 220ms one-time entry reveal already exists (`index.css:253-269`); optional tiny stagger should support hierarchy without delaying interaction. Acceptance: keyboard focus visible and never clipped; every button remains ≥44px; disabled join and pending forms remain clearly unavailable; hover changes do not alter measured bounds; reduced motion removes entry translation/reveal and leaves controls immediately interactive. No new validation or runtime state is necessary.

8. **Treat 800px breakpoint and phone first fold as design constraints.** At >800px the right column can take 440px plus 64px gap (`index.css:44,52`), leaving the left narrow at 812px; ≤800px becomes one column with fixed 32px section gap and 24px gutters (`:314-362`). The current regression covers widths 320,375,768,812,1280,1440 and long site/floor copy but uses anonymous state only for its width loop (`entry.spec.ts` final case). Consider a later two-column breakpoint or bounded fluid desk width if the enlarged hero squeezes at 812px; revise the geometry test to the chosen responsive contract rather than retaining 800px by inertia. Acceptance: both anonymous and signed-in states inspected at 320,375,768,812,1024,1280,1440, plus 812×375 landscape; controls within viewport, no horizontal scrolling, single-line default `2F`, long names and username wrap, form before scene on stacked layouts. Keep safe-area padding. Do not equate the existing root `font-size:200%` case to native browser zoom: many type tokens use px, as the archive validation expressly notes.

### Affected files and global CSS risks

Expected implementation surface: `routes/home.tsx`, early homepage rules in `styles/index.css`, optional classes in `features/entry/entry-panel.tsx` and `features/identity/identity-panel.tsx`, optional SVG refinement in `features/entry/classroom-scene.tsx`, and narrowly relevant assertions in `e2e/entry.spec.ts`.

No core theme change is required: use existing semantic tokens and define homepage-local recipes under `.home` if needed. Avoid editing shared primitive Card/Input/Button for a homepage-only visual preference; those render room UIs too. The first 363 CSS lines include global `h1`, `[data-slot="button"]`, `.card-heading`, `.card-kicker`, `.secondary-card`, `a` and `body` rules. These are NOT all home-only: `room-contents.tsx:132` uses `.card-kicker`, and room CSS later overrides some shared selectors. Scope new rules under `.home`/`.entry-station` or specific homepage classes. Altering shared selectors or core primitive tokens would require room regression coverage and would unnecessarily widen this task.

### Related specs and historical evidence

- `.trellis/spec/trellis-plus/frontend.md`: use project-local UUPM and interpret recommendations against Warm Club and the actual React/web stack; main session owns that design-planning research.
- `.trellis/spec/trellis-plus/development-principles.md`: preserve user changes, established behavior and scope.
- `.trellis/spec/trellis-plus/validation.md`: mobile-required, real browser checks, settle animations before geometry, keep watched-source generation separate from browser verification, diagnose before weakening assertions.
- `.trellis/spec/frontend/component-guidelines.md`: preserve native semantics, labels, >=44px controls, safe areas and reduced motion.
- `.trellis/spec/frontend/site-configuration.md`: configured site-name h1, optional subtitle, hint/privacy and public-config authority must remain.
- `.trellis/spec/houkago-kyoushitsu-react/frontend/index.md`: real entry runtime path and core boundary.
- Archived `10-04-visual-craft-refinement/design.md`: architectural editorial, original vector drawing, no stock imagery/remote fonts/fake metrics/autoplay; form-first phone ordering.
- Archived validation: prior measured body/canvas contrast 12.66:1, muted/canvas 5.26:1, primary/accent 5.56:1; useful starting evidence but new styles require current computed measurements.

## External references (docs, versions)

No external browse was performed in this scoped investigator role. Main session is gathering current primary Awwwards, Webby and FWA criteria. Historical design cites the official Webby judging criteria at `https://www.webbyawards.com/judging-criteria/`; this note does not claim that page was freshly verified. Stack is existing React/Vite/Tailwind; no library version change is proposed.

## Caveats / Not Found

- These are source-backed proposals, not claims of a fresh visual defect proven in a browser. Main session's actual screenshots decide specific values and further iterations.
- The earlier task PRD describes mechanical cleanup; current owner request materially raises subjective design scope. Main should update acceptance/design and manifest registrations before implementation.
- Main reviewed a current desktop baseline and confirmed weak upper-left hierarchy plus excessive separation before the scene. Its approved design elevates existing invitation copy, coordinates invite/art with entry desk, uses quieter secondary actions and strict homepage-only CSS, and retains repeated user text. This supersedes the research alternative of deduplication.
- Current e2e test asserts exact caption and all five copy constraints, and must retain them. Existing width-case `800px` threshold may legitimately change with the approved responsive design.
- Prior archive numbers are historical passes and contrast measurements, not new task verification. No tests or browser inspection ran in this research subtask.
- An early directory probe found no `.trellis/spec/frontend/index.md`; package indexes and named shared frontend guides are the actual specification entry points.
