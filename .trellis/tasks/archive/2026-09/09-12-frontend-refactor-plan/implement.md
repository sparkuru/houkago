# Future migration plan and difficulty

Planning artifact only. Every implementation checkbox below is intentionally unchecked. User approval of task creation did not approve implementation.

The user subsequently accepted the direction and priority ranking for planning only. `roadmap.md` owns the migration-benefit table and authoritative M0–M6 order. The P labels below are effort buckets: execute P0 → P2 → P1 → P3 → P4 → P5 → P6, so responsibility extraction precedes HTTP/client integration. Do not infer execution order from estimate row position.

## Estimate assumptions

One engineer familiar with TypeScript, React and Vue; a person-day is roughly 6–8 focused hours. Preserve current features and visual identity, reuse backend/media/adapter behavior, use existing fixtures and tests, and avoid concurrent feature work. Estimates include writing focused migration tests and review fixes. They are static-analysis estimates with moderate-to-low confidence until the contract and player spikes finish; AI assistance is not assumed to eliminate integration or browser verification time.

| Stage | Scope | Difficulty | Effort, person-days | Completion gate / rollback |
| --- | --- | --- | --- | --- |
| P0 | Current behavior inventory, test baseline and reproducible fixtures | Medium | 2–3 | Record actual failures before migration; no runtime switch |
| P1 | Representative OpenAPI/Hey API spike, then remaining consumed HTTP contract coverage | Medium-high | 3–5 | Deterministic generation, accurate errors/cookies/unions; Eden remains usable |
| P2 | Extract room/session/sync/player boundaries with tests | High | 4–6 | Existing Vue behavior retained, stale-result and disposal cases pass; revert extraction independently |
| P3 | Parallel React/Vite app, Router/Query, theme primitives, identity/home | Medium | 2–3 | Home/deep-link/session flows work; old app remains default |
| P4 | Room admission, realtime, queue, chat and governance integration | High | 4–6 | Event ordering, reconnect, authorized guest, queue parity pass |
| P5 | Player, subtitles/fullscreen, Baidu adapter/grants and danmaku migration | Very high | 6–10 | Two-client and provider/media fixture matrix passes; old app retained |
| P6 | Layout parity, integration regression, cutover and documentation cleanup | High | 4–6 | All required checks plus human browser review; restore old frontend build if rejected |
| Total | Compatibility-first full frontend migration | High, approximately 7–8/10 | 25–39 | Roughly 5–8 focused workweeks before contingency |

Reserve another 20–30% for contract/export incompatibilities, lifecycle bugs and browser/provider surprises: budget approximately 30–51 person-days, or 6–10 workweeks at five focused days/week. This is not a fixed-date commitment. Routine interruptions or unfamiliarity with React/Vue/media APIs increase calendar time.

Smaller options: a focused Vue-preserving extraction of session ownership, HTTP resource handling and relevant tests is approximately 6–12 person-days, with less breadth than full parity migration. A broader Vue cleanup with optional Vue Query and primitive consolidation is approximately 10–18 days. These alternatives do not deliver the requested React ecosystem. UI redesign or backend decomposition requires a separate estimate.

## Ordered work (future only)

- [ ] Before P0, obtain fresh implementation authorization for the accepted boundary-first React direction and confirm the bounded stage acceptance. Create/link the corresponding proposed child under this initiative task; direction approval alone does not start it.
- [ ] P0: run existing checks using project commands; inventory tests for current state/store, sync, OAuth/adapter, subtitles, danmaku, queue and responsive layout. Record failures independently of migration. Establish fixture backend/DB and media inputs without production data.
- [ ] P1a: prove five representative operation families: site config, identity, queue mutation, Baidu and a danmaku query. Verify errors and cookie behavior. Select exact compatible versions from the installed Elysia baseline rather than copying latest docs blindly.
- [ ] P1b: inventory all browser-used endpoints and export complete contracts. Isolate export from normal DB initialization/listening and remote upstream calls. Add deterministic SDK/query generation and drift validation. Stop before UI conversion if responses degrade to unknown or casts.
- [ ] P2: use existing Vue behavior tests to extract the room-session snapshot/controller and sync core, then the imperative player driver. Add generation guards and lifecycle acceptance tests from S2/S4. Keep changes independently reviewable.
- [ ] P3: create temporary React workspace, one composition root and one QueryClient. Preserve aliases/i18n/theme keys, URL paths, credential config, Vite container development requirements and lazy room loading. Implement home/identity with existing behavior.
- [ ] P4: wire the admitted-room state machine, queue commands and realtime snapshot. Port governance/chat UI. Prove stale HTTP cannot overwrite BANGUMI and no protected action runs before admission. Do not move all room fields into Query.
- [ ] P5: mount the tested player driver through React. Port source/subtitle/fullscreen/gesture controls, then Baidu grant/adapter flows, then danmaku selection and render bindings. Reuse parsing and matching helpers. Keep each feature's test evidence.
- [ ] P6: validate full parity matrix and review screenshots/interactions. Inspect actual deployment entrypoint before selecting a cutover procedure. Switch only after review; keep old build through a rollback window chosen for that deployment. Retire temporary workspace/framework dependencies after acceptance.
- [ ] Update root design and authoritative package/shared specs to remove obsolete host-only/Vue rules only when the new implementation has actually replaced them. Preserve existing invariants and aggregate test coverage.

P1 and P2 may have independently reviewable slices, but P2 ownership contracts precede P1 resource integration. P3 needs both established client contracts and extracted boundaries, P4 needs P2/P3, and P5 needs the room/player seams. Follow the M order in `roadmap.md`. The summed estimate is person-effort, not a claim of parallel speedup.

## Verification commands

These are existing baseline commands to run during future implementation, not checks run in this planning turn. Use the repository Docker wrapper, sequentially, respecting its port/lifecycle behavior:

```text
./dx bun run typecheck
./dx bun run lint
./dx bun run test
./dx bun run --filter houkago-kyoushitsu build
./dx bun run --filter houkago-kyoushitsu test:e2e
```

Playwright config does not start web servers: start an isolated fixture Housou and frontend via the established dev setup, set `PLAYWRIGHT_BASE_URL` and install/use the project-supported browser before executing browser tests. The adapter browser suite has its own `packages/kyoushitsu/playwright.chromium-adapter.config.ts`; inspect its fixture prerequisites before running. Do not label a missing provider credential/browser as a passed scenario.

Future new-workspace build/typecheck/test and contract-generation command names must be added and recorded during P1/P3. They do not exist yet. Run generation twice and verify no second diff; root checks must continue including all retained packages.

## Acceptance matrix

| Contract | Essential validation |
| --- | --- |
| S1/S2 | New BANGUMI beats old HTTP; room/account switch ignores late callbacks; one socket; admission/revocation/reconnect |
| S3 | SDK matches response shapes/statuses; credentials; abort; private cache purge; no repeated grant creation |
| S4 | Existing sync/drift tests, allowed/forbidden guest controls, late join, deferred seek, setup/cleanup/setup, fullscreen/subtitles |
| S5 | Home/deep links, entry/governance/danmaku/room browser scenarios, portrait/desktop/cinema focus and overflow |
| S6 | Dependency review, existing shared/backend/adapter suites preserved, representative provider/panel extension stays within its owner |

## Main risks and rollback boundaries

- HTTP contract export: backend bootstrap has DB side effects today. Keep export additive and isolated; if fidelity fails, pause Hey API adoption instead of weakening types.
- Realtime ordering: stale bootstrap or cached snapshots can regress playback/queue. Revert the controller slice before proceeding to another feature.
- React lifecycle: repeated effects may duplicate sockets, grants or media engines. Block cutover until setup/cleanup/re-entry tests and actual browser behavior pass.
- UI primitives: native fullscreen portals, autoplay gestures and scoped-CSS specificity need actual browser checks; screenshots alone are insufficient.
- Baidu/provider behavior: validate deterministic fixtures first; live smoke evidence depends on available authorized fixtures/devices and is explicitly recorded if unavailable.
- Rollback: preserve URLs/auth/protocol compatibility so the old frontend can reconnect. No destructive DB migrations, protocol renames or simultaneous backend rewrite in this plan.

## Planning delivery verification

The assessment and design were reviewed against the source anchors and the user’s plan/spec-only scope. No runtime baseline was run. Final delivery must check task status, all document links/anchors and the changed-file scope; it must not mark implementation complete.
