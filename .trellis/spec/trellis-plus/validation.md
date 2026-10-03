# Validation and Submit-Ready Review

## Trellis Plus: Playwright Validation Profile

Read this profile before external documentation. Reconcile with manifests/configs
when conventions change; task evidence records only that task's results.

- execution mode: `project-local`; root `@playwright/test` dependency and host
  Node run tests against services started by `dx`. `dx` uses the project-local
  `houkago-dev:playwright` image, whose `Dockerfile.dev` installs the Debian
  system libraries required by Chromium. Do not fall back to installing system
  packages in a disposable test container.
- setup/install: `./dx bun install`; CLI `node_modules/.bin/playwright`.
  Use bundled Chromium when present. Bootstrap with
  `node_modules/.bin/playwright install chromium` only when needed and allowed
  by runtime/network availability. An existing compatible browser can be
  selected through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; current path is
  `/usr/bin/google-chrome`, not a universal machine prerequisite.
- app readiness: `DX_EXTRA_PORTS=3000,5173 ./dx bash scripts/dev-react-preview.sh`, then probe
  API `http://127.0.0.1:3000/health` and frontend `http://127.0.0.1:5173/`
  as in [development.md](development.md). No config `webServer` is defined.
  Stop the owning foreground session with Ctrl-C.
- test location/config: application cases live in `packages/kyoushitsu-react/e2e/`
  with `packages/kyoushitsu-react/playwright.config.ts`. Installed Chromium
  extension acceptance is adapter-owned at `packages/houkago-adapter/e2e/`
  with `packages/houkago-adapter/playwright.chromium-adapter.config.ts`.
  M6 removed the old application and runner after parity/owner acceptance.
- browser projects: React pairs `entry-desktop/phone`,
  `real-cookie/real-cookie-phone`, `media-desktop/phone`,
  `room-controls-desktop/phone`, `danmaku-desktop/phone`, `baidu-desktop/phone`.
  Desktop is 1280×900; phone 375×812 with `isMobile`/`hasTouch`.
  The `room-layout-ipad`, `room-layout-short` (1280×640) and
  `room-layout-tall` (1280×1200) projects run `@layout-parity` populated cases.
  `baidu-phone` sets an iPhone UA but runs Chromium. Room controls and the mapped speed-dial
  criteria passed automation and owner visual review at M6 cutover.
- mobile applicability/coverage: general entry/room flows are `mobile-required`.
  Classify every changed interaction before implementation, even without CSS
  edits. Record viewport/layout/navigation/input/final-state assertions and
  separate desktop/mobile outcomes. `mobile-not-applicable` needs a scope
  exclusion; missing tests are not an exclusion. `mobile-unavailable` leaves
  work open. Emulation does not prove Safari, real devices, virtual keyboards
  or external mobile providers.
- fixtures/data: route mocks and local test accounts; real-cookie tests use
  the isolated memory backend via `PLAYWRIGHT_HOUSOU_URL` (default
  `http://127.0.0.1:3000`). No production data, personal sessions or credentials.
  Fixture provider/media success does not establish real upstream acceptance.
- accessibility: semantic roles/names, visible text, keyboard, focus and state
  assertions. No global axe scan. Add scans only for justified coverage;
  neither emulation nor a scan proves assistive-tech behavior.
- visual baseline: diagnostic screenshots; no approved deterministic baseline.
  Do not automatically accept new snapshots as verification.
- failure artifacts: React output `packages/kyoushitsu-react/test-results/`;
  traces `retain-on-failure`. Retain reporter logs in task evidence or `/tmp`
  and screenshots attached by tests. Universal failure screenshots and global
  console/network capture are not configured; collect them for investigation.

Focused entry desktop/mobile flow:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=entry-desktop --project=entry-phone --grep "one delayed restore, anonymous form, keyboard and reduced-motion layout"
```

Focused room-control child, using its available pair:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=room-controls-desktop --project=room-controls-phone
```

Full React suite (no browser CI job is declared in this repository):

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:3000 node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts
```

Prefix with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome` only when
using that browser. Alternate ports require matching frontend/API variables
and isolated service ports.

Installed Chromium adapter suite:

```sh
./dx bun run --filter houkago-adapter build:chromium
node_modules/.bin/playwright test --config packages/houkago-adapter/playwright.chromium-adapter.config.ts --workers=1
```

The test uses bundled Chromium and controlled HTTP/HTTPS fixtures with generated
certificates. Inspect its actual content-script/worker/DNR assertions; a fixture
handshake alone is not installed-extension acceptance. Historical Vue parity
commands remain in the M6 task evidence, not the active command profile.

## Browser classification and evidence

Use `playwright-required` for locally reproducible changed UI acceptance;
extend the smallest meaningful test with semantic locators, controlled states
and final-state assertions. Reuse an existing equivalent runner as
`playwright-existing-equivalent` instead of duplicating it.
Use `playwright-not-effective` only for specifically unautomatable judgment or
environment; `playwright-unavailable` means a required runtime, service,
fixture, browser or permission is missing. Record exact attempted commands
and blockers; neither classification is a pass.

Record commands, routes/states/actions, desktop/mobile projects and outcomes,
fixture boundary, artifacts and residual risk. Do not hide failures with
weaker assertions, enlarged timeouts or unexplained snapshots. Keep skip
reasons visible; a skipped requirement is not verified.

## Trellis Plus: Submit-Ready Human Review Gate

Before staging/commit, completion or archive, compare requirements, diff and
actual evidence. Run scoped lint/types/unit/build and contract drift when
applicable using [development.md](development.md); aggregate tests belong before
product work commits. Policy/documentation changes need link, context,
command/provenance and diff checks, not a product test rerun.

Choose `human-required`, `human-optional` or `human-not-needed`:

- Required: a material check/mobile flow is unverified; remaining visual/product
  acceptance is subjective; real devices, assistive tech, private upstreams or
  data are needed; or auth/security/permissions, migration, deletion, deployment
  or irreversible effects need owner judgment. Complete runnable automation
  first and ask only about the remaining concern.
- Optional: relevant automation passed and a small visual/preference review
  adds confidence; state that it does not block authorized continuation.
- Not needed: mechanical/docs-only changes or focused behavior checks leave no
  meaningful human-only question. State the evidence-based reason.

A required request names the concrete change, commands/results already run,
manual scenarios, pass/fail and useful failure evidence, and only decisions
affecting readiness. Explain the policy reason for blocking. Do not request a
generic smoke test after relevant Playwright passes. Honor review/commit/archive
authorization already given; no ceremonial repeat approval. Missing authorization
is separate from review risk.
