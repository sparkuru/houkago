# M3 implementation and validation plan

## Before execution

- [x] User approves the latest completed planning summary in a subsequent message
  (`开始实现 M3`, 2026-09-26; final summary verified in prior session).
- [x] Resolve active task via source-session-aware Trellis tooling and load Phase 2.
- [x] Run `task.py start` only after that approval and real manifests exist.
- [x] Re-read scoped specs before edits; preserve/exclude unrelated `dev.sh`.
- [x] Main dispatches Trellis implement/check with `Active task:` and explicit
  ownership. Workers are not alone and must accommodate others' edits. No nested
  implement/check agents; quality commands remain serial.

Task entered `in_progress` on 2026-09-26 after final-summary approval. The initial
planning research did not install dependencies, change product code or launch
services/browser; execution evidence is recorded separately.

## Ordered delivery

### 1. Compatible shell spike (A1)

- [x] Add `packages/kyoushitsu-react` / `houkago-kyoushitsu-react`, strict TS,
  package-local Vite/React alias and scripts; reuse existing toolchain.
- [x] Resolve and lock new React 19/Router 1/Query 5/Tailwind 4 lines, plugin/types
  and selected shadcn CLI sources/deps. Record peer/engine/version evidence in
  `research/implementation-evidence.md` before feature work. Scope CLI to the new
  package, inspect diffs, and avoid unrelated lockfile/package upgrades.
- [x] Prove minimal dev/typecheck/build through `dx`; material incompatibility
  returns to planning instead of expanding upgrade scope.
- [x] Add root `dev:react` alias; include new test directory in aggregate test.
  Add validated opt-in `DX_EXTRA_PORTS` to existing wrapper, not a new wrapper.
  Verify Bash syntax/ShellCheck/shfmt when available and fake-Docker behavior for
  valid/invalid/duplicate port input/default compatibility. Do not alter `dev.sh`.
- [x] Add `scripts/dev-react-preview.sh`, a three-process runner inside dx for
  isolated Housou/Vue/React. Follow existing Bash child cleanup/first-failure
  handling; verify startup args/memory/no-env-file, signals and failure cleanup
  with task-owned fake commands. It contains no Docker call or alternate wrapper.
  Set `HOUKAGO_ISOLATED_PREVIEW=1` for both frontends and disable Vite `envDir`
  only for this opt-in mode: Bun's no-env-file option does not disable Vite dotenv.

### 2. Portable boundary and public config (A1, A5)

- [x] Add exact legacy package exports, handwritten pure barrel and relative
  URL helper import. Keep all generated/export/drift paths.
- [x] Add typed create adapter and focused origin/body/cookie/abort/error tests.
- [x] Extract pure config loader/title/types, Vue reexports and optional failure
  predicate; preserve old tests/API. Implement exact per-call true-empty detection
  and typed error preservation from reuse research without generated changes.
- [x] Prove empty/204 fallback versus literal `{}`, null, malformed JSON, primitive
  and invalid config rejection; warning secrecy, memoization, abort and metadata.
- [x] Consume subpaths in actual React TS/build; inspect transitive module graph
  for forbidden dependencies. No export-map snapshot test as substitute.

### 3. Runtime, identity and entry features (A2–A4)

- [x] One external-to-render runtime/QueryClient/Router; memoized home bootstrap,
  ordinary cancellable Query binding and explicit policies. No duplicate loader
  cache, effect restore, protected room reads or installed Vue Query.
- [x] Implement epoch-fenced restore/anonymous/error lifecycle; serialized auth,
  private cancel/purge, current-operation commits, logout failure reconciliation
  and disposal. Keep passwords out of retained mutation variables/cache.
- [x] Thin identity forms and create/join feature; typed copy/pending/errors,
  default configured room name and existing invite normalization.
- [x] Lazy idempotent handoff, configured legacy origin validation, encoded safe
  IDs, direct room refresh, revoked notice and unknown/error routes.
- [x] Unit tests cover late old read/auth/create, cancel rejection, logout failure
  and reconciliation, no command replay, no secret retention, target loops/unsafe
  IDs and route preload producing no navigation.

### 4. Warm Club UI and browsers (A3–A6)

- [x] Map shared CSS to Tailwind/shadcn without copying palette or changing Vue
  styles; own only the required primitives. Complete relevant UUPM/UI check.
- [x] Add scoped React Playwright configuration for entry-desktop 1280x900 and
  entry-phone 375x812, environment baseURL/executable, traces on failure.
- [x] Semantic mocked flows: delayed restore/401/recovery; auth pending/errors;
  logout and stale completions; config/default/name/title; create/join/handoff;
  deep links/invalid target; keyboard/focus/status/44px/overflow/reduced motion.
  Use true typed backend statuses, not legacy successful-null mocks.
- [x] Task-owned isolated memory Housou proves register -> refresh `/me` -> room
  handoff -> same identity at Vue -> return to React home -> sign-out -> `/me`401,
  without identity mocks.
  Room fixtures observe actual admission before seeding protected data; prefer
  room creation owned by this test and avoid external providers.
- [x] Rerun old Vue entry; shared HTTP/config changes require applicable existing
  room regressions (auth/room admission/bootstrap/navigation). Shared CSS changes,
  if later justified, require full prescribed viewport regressions and plan review.
- [x] Capture diagnostic signed-out/signed-in screenshots, console/page errors,
  forbidden pre-handoff request counters and reduced-motion/layout measurements.
  No automatic screenshot baseline updates. Broader M4/M5 React suites are excluded.

### 5. Quality, scoped human review and finish (A6, A7)

- [x] Trellis checker verifies artifacts/spec compliance, actual gates below,
  generated ownership, transitive reuse and no unrelated work. Fix concrete issues.
- [x] Main records commands/versions/counts/screenshots/limitations, per-AC result
  and human classification in `validation.md`. Material blocked checks stay open.
- [x] After automation, present only residual Warm Club parity/auth-handoff UX
  judgment with evidence, not a request to manually repeat runnable tests.
- [x] Update actual discovered React/core contracts in scoped specs; avoid filling
  unrelated placeholder docs or rewriting backend architecture.
- [x] Present concrete commit plan with validation and
  `Co-authored-by: OpenAI Codex <codex@openai.com>`, excluding `dev.sh`.
  Commit/archive/journal only through authorized finish workflow. No push or M4 start.

## Ownership / sensitive touch points

| Owner area | Planned changes / constraint |
| --- | --- |
| New React workspace | runtime, features, routes, styles, primitives, unit/e2e/config; new app only |
| Legacy portable boundary | `package.json`, `api/public.ts`, `http-client.ts`, `resources/http.ts`, `lib/site-config-core.ts`, Vue `site-config.ts` reexports and focused tests |
| Shared copy | `i18n/messages.ts` only if required feedback keys are absent; old labels remain |
| Root infrastructure | `package.json`, `bun.lock`, `dx`, `scripts/dev-react-preview.sh`, narrow README/dev instructions; no `dev.sh` |
| Isolated preview | Narrow additive `packages/kyoushitsu/vite.config.ts` envDir opt-in; default Vue behavior remains |
| Main agent | planning/manifests/mainline/spec capture, evidence review and commit/archive/journal |

Generated tree/OpenAPI/exporter paths are protected. Prefer additive pure exports
over file moves. Rollback is existing Vue entry; no schema/data rollback is needed.

## Validation commands (implementation-only)

Executed serially; final results are consolidated in `validation.md`:

```sh
./dx bun run contract:drift
./dx bun run --filter houkago-kyoushitsu-react typecheck
./dx bun run typecheck
./dx bun run lint
./dx bun run test
./dx bun run --filter houkago-kyoushitsu build
./dx bun run --filter houkago-kyoushitsu-react build
bash -n dx
bash -n scripts/dev-react-preview.sh
git diff --check
```

Verified isolated preview (startup and owned teardown passed; rerun for review):

```sh
DX_EXTRA_PORTS=5174 ./dx bash scripts/dev-react-preview.sh
```

Runner starts Housou with `NODE_ENV=development HOUSOU_DB=:memory:` and
`bun --no-env-file packages/housou/src/index.ts`, plus both frontends with Bun's
automatic env loading disabled. Use consistent `127.0.0.1`, no explicit development
CORS origin, no upstream credentials or normal DB. Mocked suites can also use a
single task-owned Vite session via `./dx bun run dev:kyoushitsu` or
`DX_EXTRA_PORTS=5174 ./dx bun run dev:react`; do not assume these Vite-only
containers can independently share unused published default ports. Never reuse a live backend with
unknown DB/environment; occupied required ports need an explicit task-owned
alternative, not stopping another service. Existing production CORS stays intact.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=entry-desktop --project=entry-phone
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=entry-desktop --project=entry-phone
```

Give real-cookie smoke a distinct test/config tag or script and exact command in
implementation evidence; it needs real services and cannot silently run with mocks.
Likewise record applicable old room-regression projects and results. If host Chrome
cannot launch under sandbox, diagnose the concrete failure and use narrow approved
escalation/cached matching Playwright image; missing Bun-container browser libs
are not a reason to mark browser parity complete.

## Final execution state

Source/automation/spec-sync steps above are complete. Main has prepared the
concrete commit plan and the owner approved its residual-review and finish batch
with `提交` on 2026-09-26. Work commits followed by M3 archive/journal are
authorized; execution hashes are recorded in the finish journal.
