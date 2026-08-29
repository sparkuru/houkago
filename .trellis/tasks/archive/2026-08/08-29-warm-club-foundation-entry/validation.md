# Validation: Warm Club 2.0 foundation and entry

## Automated evidence

- Final reviewer fix verification:
  `./dx bun test packages/kousoku/test/site-config.test.ts packages/housou/test/site-config.test.ts packages/kyoushitsu/test/site-config.test.ts packages/kyoushitsu/test/room-motion.test.ts`
  — passed, 29 tests / 0 failures. The reviewer tightened the browser fallback
  boundary so only rejected/unavailable requests use the shared default; a
  structurally invalid successful response now rejects bootstrap instead of
  silently masking a contract violation.
- `./dx bun test packages/kousoku/test/site-config.test.ts
  packages/housou/test/site-config.test.ts
  packages/kyoushitsu/test/site-config.test.ts` — passed, 25 tests / 0
  failures. Coverage includes strict/default normalization, deep freeze,
  malformed/duplicate/unknown/missing/unsafe TOML, value-free diagnostics,
  exact public projection with secret sentinels absent, frontend transport
  fallback, memoization, and title application.
- `./dx bun run --filter houkago-kousoku test` — passed, 16 tests / 0
  failures.
- `./dx sh -c 'HOUSOU_DB=:memory: bun run --filter houkago-housou test'` —
  passed, 122 tests / 0 failures. The memory database matches the repository
  root test contract; invoking the package test without it reused a dirty local
  database and produced account/data conflicts, not site-config failures.
- `./dx bun run --filter houkago-kyoushitsu test` — passed, 146 tests / 0
  failures, including site-config loading and the added reduced-motion
  replacement case.
- Package typechecks for `houkago-kousoku`, `houkago-housou`, and
  `houkago-kyoushitsu` — passed.
- `./dx bun run --filter houkago-kyoushitsu build` — passed. Vite retained its
  existing third-party dash.js CommonJS-in-ESM warning.
- `./dx bun run lint` — passed, 244 files checked.
- Entry browser check with the repository Playwright config, local development
  services, mocked session/auth responses, and the installed Chrome executable:
  `--project=entry-desktop --project=entry-phone` — 12 passed. Coverage includes
  session restoration, signed-out/register switching, pending and failure
  feedback for authentication and room creation, authenticated join/create
  hierarchy, keyboard order, 44px targets, horizontal overflow, stable motion
  completion, reduced motion, the absent default subtitle, a custom long
  identity/subtitle/title/entry-copy projection, and the configured empty-name
  room default. The final rerun also asserts that the default `社团活动室`
  heading occupies one line at both 1280x900 and 375x812.
- Existing shared-token/entry compatibility browser check:
  `--project=desktop-short --project=phone-375` — 4 passed / 4 intentionally
  project-skipped. The passing scenarios cover desktop room creation and
  expanded queue reachability plus the existing 375px room/chat/provider paths.
- `./dx bun run test` — passed, 372 tests / 0 failures.
- `./dx bun run typecheck` — passed for all six workspace packages.
- `git diff --check` — passed after the site-config revision.

Diagnostic screenshots were re-captured and inspected locally at 1280x900 and 375x812 in both
signed-out and signed-in states. They are temporary evidence under `/tmp`
(`houkago-warm-club-site-config-{signed-out-desktop,signed-out-phone,
auth-desktop,auth-phone}.png`) and are not committed screenshot baselines. The
new default sign reads `社团活动室`, has no subtitle row, and preserves the
approved quiet-floor hierarchy at both widths. Its measured title height equals
one computed line (51.83px / 51.84px desktop; 36.72px / 36.72px phone), while
document `scrollWidth` equals `clientWidth` at both widths. The long custom-name
Playwright case still passes without horizontal overflow.

The reviewer also verified that switching to reduced motion cancels an existing
target animation before declining its replacement. That lifecycle edge now has
a unit regression test. The new body typography and line-height recipe is scoped
to `HomeView` so the token refactor does not change room-wide inherited line
metrics.

## Human review gate

Classification: `human-required`.

Automation establishes behavior, layout bounds, accessibility names, control
size, configuration projection, and motion fallback. The user already approved
the overall quiet-floor atmosphere, then specifically requested replacing the
prominent `放学后 / HOUKAGO` sign with the configurable `社团活动室` default.
The remaining decision is limited to whether that requested identity replacement
retains the approved attention hierarchy in the final screenshots.

Review the home route at 1280x900 and 375x812 in both signed-out and signed-in
states. Confirm only the atmosphere and attention hierarchy; no generic browser
smoke test is needed after the passing Playwright evidence. A screenshot or a
short statement of the distracting/understated element is sufficient evidence
for any requested adjustment.

## Residual risk

- No approved pixel baseline exists, so cross-platform system-font metrics may
  differ slightly.
- Real-device and assistive-technology checks were not performed. Semantic
  browser assertions cover keyboard order, labels, focusable controls, and
  reduced motion, but do not replace those environments.
