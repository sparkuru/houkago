# M6 validation and review

## Authority and baseline — 2026-10-04

The owner approved the refreshed final M6 plan with `开始`. The existing task
was started and is `in_progress`. This permits implementation and automated
verification. The later owner reply `视校通过；可以提交/继续；包括所有脏文件` accepted
review and authorized deletion, all trackable dirty-file commits and normal task
closure. Production deployment remains outside scope.

Committed base: `68d8b398d228c9f13f0d773356c751f0b17e2d6e` on `k-on`.
Pre-existing dirty state was captured before product edits at
`/tmp/houkago-m6-baseline-t2wgvscl/`: Git status, tracked/index patches and
original changed/untracked files. It includes separate preview/configuration,
backend origin and project-policy work. Preserve it through extraction and
rollback. A dirty-file snapshot is not a whole-repository backup.

## Executed pre-extraction checks

```sh
./dx bash -lc 'bun run lint && bun run typecheck && bun run test && bun run contract:drift && bun run --filter houkago-kyoushitsu-react build'
```

Result: passed. Aggregate tests: **486 passed, zero failed**. Root lint and all
workspace typechecks passed; contract generation remained byte-stable across
18 generated files; React production build passed with the existing Dash.js
CommonJS-in-ESM warning. Log: `/tmp/houkago-m6-baseline-checks.log`.
The initial sandbox attempt could not access Docker's socket; the same project
command passed with the permitted Docker execution context.

React uses an isolated memory Housou on 3195 and React Vite on 5195, started
through `scripts/dev-react-preview.sh` with explicit extra ports. Legacy tests
hardcode backend port 3000, so a separate task-owned container runs memory
Housou on 3000 and Vue Vite on 5197. Both disable env-file loading and private
provider inputs. API `/health` and both frontend `/` endpoints responded.

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --workers=2 --output=/tmp/houkago-m6-react-baseline
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5197 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --workers=2 --output=/tmp/houkago-m6-vue-baseline
```

- Vue: **40 passed, 8 skipped, zero failed**, 49.9 seconds. Skips select the
  applicable short/tall desktop project; they do not stand in for tested cases.
  Log `/tmp/houkago-m6-vue-baseline.log`; artifacts in the output path above.
- React: **45 passed, 3 skipped, 2 failed**, 1.3 minutes. Three skips select
  desktop-only/phone-only Baidu scenarios. Both failures are the same real-cookie
  two-client case at `real-cookie.spec.ts:98`, trying to select hidden
  `入室方式` without opening the newer `+` → room-controls dialog. This baseline
  failure existed before core extraction. Preserve the real-cookie, permission,
  queue, chat and revocation assertions while correcting navigation.
  Log `/tmp/houkago-m6-react-baseline.log`; failure traces are under its output path.
- The installed Chromium adapter test is a separate runner; the Vue default
  suite above does not execute it. It remains required and must move to the
  adapter-owned boundary before Vue removal.

## Parity and implementation

The [case matrix](research/parity-matrix.md) maps each legacy test and M4/M5
contracts to React evidence or a remaining gap. Baseline passes establish only
pre-extraction evidence; post-extraction checks will be recorded here separately.

Discovered parity defect: React offered queue deletion to a guest with playlist
permission, unlike legacy owner-only management. Correct presentation/runtime
gating and verify guest denial plus host success without changing server contracts.

## Human review and completion

See the [concrete review brief](research/human-review.md) for screenshots,
three remaining presentation decisions and the local deletion scope.

Classification: **human-required** for migration/deletion and visual/interaction
residual acceptance, per the project validation policy. Complete runnable checks
and independent review before asking. No M6 whole-app acceptance, Vue deletion,
commit, or archival is claimed by this baseline record.

Physical devices, Safari, assistive technology and live Baidu/provider accounts
are outside the emulated Chromium/local-fixture evidence. Record their boundaries
explicitly; do not turn them into new product requirements or unnecessary tests.

## Final pre-removal checks — 2026-10-04

```sh
./dx bash -lc 'bun run lint && bun run typecheck && bun run test && bun run contract:drift && bun run --filter houkago-kyoushitsu-react build && bun run --filter houkago-kyoushitsu build'
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --workers=2 --output=/tmp/houkago-m6-react-final
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5197 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --workers=2 --output=/tmp/houkago-m6-vue-final
bash scripts/test-react-preview.sh
./dx bun run --filter houkago-adapter build:chromium
node_modules/.bin/playwright test --config packages/houkago-adapter/playwright.chromium-adapter.config.ts --workers=1 --output=/tmp/houkago-m6-adapter-installed
```

- Full static gate: passed. **496 tests across 92 files, zero failures**; lint
  checked 325 files; all eight workspace typechecks passed, including core DTO
  fidelity. React and temporary Vue builds passed with the existing Dash.js
  CommonJS warning. Contract drift regenerated twice and retained 18 byte-stable
  outputs, including the 46-operation browser subset.
  Log: `/tmp/houkago-m6-final-checks.log`.
- React: **60 passed, 3 skipped, zero failed**, 1.3 minutes.
  The skips are the desktop-only pairing/grant cases on phone and phone-only
  provider explanation on desktop; the applicable counterparts passed.
  Log `/tmp/houkago-m6-react-final.log`; traces/screenshots in its output path.
- Vue: **40 passed, 8 skipped, zero failed**, 46.6 seconds; the skips are the
  legacy short/tall project-selection conditions. This comparison remained
  runnable after core extraction and preset/presence helper relocation.
  Log `/tmp/houkago-m6-vue-final.log`.
- Responsive parity explicitly covers normal/cinema populated rooms at
  1280×900, phone 375×812, iPad Mini emulation, 1280×640 and 1280×1200.
  Keyboard/focus, touch, drag/nudge/persistence, safe insets, reduced motion,
  bounded layout, active player/queue/composer clearance and real fullscreen
  are assertions, not inferred from screenshots.
- React graph: 486 emitted graph entries, 46 core modules, zero forbidden
  Vue/Pinia/Eden/server or old Vue source entries. The build reported 487
  transformed modules; graph entries and transformation count are distinct.
- Preview harness: **93 shell behavior checks passed** in the host-side fake
  Docker/Bun harness, log `/tmp/houkago-m6-preview-harness-host.log`. The initial
  planned `./dx bash scripts/test-react-preview.sh` failed because the existing
  image lacks Python required by the harness's fake `dx` calls; no image/system
  install or host Bun fallback was used. Product checks still ran through dx.
- Installed adapter: **1 passed**, 1.4 seconds, using bundled Chromium with no
  executable override or additional env variables. Extension build passed,
  log `/tmp/houkago-m6-adapter-build.log`; runner output is in its path above.
  Reporter stdout was retained in the tool record, with no separate log file.
  The moved test exercises actual content script, worker and DNR interception
  against controlled HTTP/HTTPS fixtures; it is not a mocked handshake pass.

## Repairs and independent review

Restored actual legacy permission presets and duration/departure information,
using one pure core implementation. Presets retain custom checkboxes and wait
for WS echo. Presence uses immutable `SHUSSEKI` projection and resets per session;
the display clock clears on close/hide/unmount. The retained Vue consumes the
same projection. Dormant nickname/chat-theme surfaces were separately inventoried.

Fixed host-only queue deletion and populated-room launcher collisions. Automatic
collision avoidance never overwrites the user's stored preferred position.
Strict browser assertions were retained after desktop and phone-cinema repros.
The final reviewer found and fixed native dialog interior-padding dismissal;
desktop/phone regression clicks verify the actual dialog target and real backdrop.

Reviewer gates passed: scoped lint, React types, 27 meaningful focused tests,
259 assertions, diff check. Logs `/tmp/houkago-m6-final-review-{lint,tests,types}.log`.
No remaining code/contract/boundary findings. Reviewer separately checked timers,
observer cleanup, session reset, server authority and Vue projection compatibility.

Adding core manifest exports exposed cached Vite resolution during an initial
focused run (`/tmp/houkago-m6-restored-parity`, stopped on the error overlay).
Only task-owned previews were restarted. Fresh focused 21 cases passed before
the complete suite above; no test bypasses the overlay or weakens assertions.

## Preservation and rollback

[Restoration rehearsal](research/rollback.md) passed in an independent temporary
Git repository: original dirty-baseline and restored trees match exactly.
The real project HEAD remains `68d8b39`; no project staging/commit/reset was done.
Ten unrelated dirty files were checked byte-for-byte, the moved Housou URL
retains original bytes, package port/config values remain unchanged, and the
pre-existing `dev.sh` deletion remains. Core registration in tracked
`.trellis/config.yaml` is included in the restoration fixture.

Inventory: 141 legacy tracked files, 88 migrated, 53 temporarily retained.
Owner acceptance, Vue deletion, post-removal checks and final completion remain
open. Tests do not establish physical-device/Safari/private-provider acceptance.

Task context validation passed (20 implement, 19 check entries), changed review
and spec links exist, and `git diff --check` passed. Only task-owned test preview
containers were stopped after verification; other local services were preserved.

## Accepted cutover and post-removal checks — 2026-10-04

The owner accepted all three presentation residuals, the mapped speed-dial
criteria, continuation and commits including all dirty files. Deleted the old
workspace and its final 53 files; 88 retained source/test/contract files were
migrated. The obsolete package mapping, dev command, test path, dependencies,
lock entries and active documentation were cleaned up. Old binding specs survive
only as historical task research; active conventions now describe React/core.
The final legacy directory (including ignored build/dependency/test artifacts)
was verified and backed up at `/tmp/houkago-m6-legacy-cutover-WvJUgc` before removal.

```sh
./dx bash -lc 'bun run lint && bun run typecheck && bun run test && bun run contract:drift && bun run --filter houkago-kyoushitsu-react build && bun run --filter houkago-adapter build:chromium'
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5195 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3195 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --workers=2 --output=/tmp/houkago-m6-post-removal-react
node_modules/.bin/playwright test --config packages/houkago-adapter/playwright.chromium-adapter.config.ts --workers=1 --output=/tmp/houkago-m6-post-removal-adapter
bash scripts/test-react-preview.sh
python3 scripts/test-preview.py
./preview.sh status
./preview.sh start
```

- Root lint: 273 files passed; all seven retained workspace types passed.
- Root tests: **459 passed, zero failed, 86 files**. The difference from 496 is
  37 obsolete Vue-binding/dormant-helper tests removed with six legacy test files;
  migrated pure/core tests and React authority tests remain.
- Contract drift: 18 outputs stable across two generation runs; 46 browser
  operations retained. React and installed-extension builds passed. The existing
  Dash.js warning remains. Log `/tmp/houkago-m6-post-removal-checks.log`.
- React browsers: **60 passed, 3 applicable-project-selection skips**, zero
  failures, 1.2 minutes. Full supported viewport/interaction scope retained.
  Log `/tmp/houkago-m6-post-removal-react.log`, artifacts in the command output.
- Installed adapter: **1 passed**, 1.2 seconds, bundled Chromium;
  log `/tmp/houkago-m6-post-removal-adapter.log`.
- Shell fixture: **93 behavior checks passed**;
  log `/tmp/houkago-m6-post-removal-shell-tests.log`.
- Preview Python fixture: **11 cases passed**, 20.728 seconds;
  log `/tmp/houkago-m6-preview-fixture-reserved-ports.log`. Its initial fixed-port
  publication assertion conflicted with the user's existing 9998/9999 preview.
  The checker fixed the test's nondeterministic host-port dependency using four
  held, non-listening ephemeral sockets and exact normal/extra mapping assertions.
  All test methods, assertions and timeouts were retained; no service was stopped
  to manufacture a pass. The Docker operations in this suite remain simulated.
- Existing real normal preview status and healthy `start` reuse passed on actual
  Docker services at 9998/9999. Logs `/tmp/houkago-m6-existing-preview-{status,reuse}.log`.
  The two pre-existing containers were preserved. Only our isolated 3195/5195
  browser fixture was stopped. No new normal-preview stop/restart is claimed.

The final checker found no product issue. Shell syntax/ShellCheck/shfmt, Python
syntax, all explicit export targets, dependency closure, actual React graph
(no forbidden modules) and diff checks passed. Active legacy source references
are gone except an intentional negative import fixture and forbidden graph rules.
No wire protocol, backend schema or external provider contract changed in M6.
The separately included preview work makes backend bind/default-origin behavior
configurable and is documented/tested under its own preserved baseline.

Human-required review is now **accepted**, not pending. Physical-device/Safari,
assistive-tech and private-provider limits remain unchanged. Durable copies of
reviewed screenshots are in `research/screenshots/`.

Original dirty work is now preserved in baseline commits `09b47f3` and
`e87044a`. The latter corrects the fixture/staging omission of already-tracked
local skill files; their net Git diff from the original HEAD is empty, and local
files were not changed. Final restoration uses this actual combined baseline,
including tracked-but-locally-ignored records, rather than a fresh Git add.

## Closure evidence

Implementation commit: `44edc02218dc25710c53696ac61a386eb2261015`.
The actual cutover commit was reverted only in the owned temporary repository;
its restored Git tree equals the preserved `e87044a` baseline exactly. See
[the final restoration result](research/rollback-result.json). All owner and
executable criteria passed; M6 and its accepted speed-dial child are completed
for normal archival. No production deployment/push occurred.
