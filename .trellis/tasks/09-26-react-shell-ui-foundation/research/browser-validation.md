# Research: M3 browser validation and container development commands

- Query: Find a reproducible, bounded M3 identity/home browser gate and parallel React development entry while preserving the default Vue app.
- Scope: mixed; repository source, archived evidence, minimal read-only host/Docker probes, official Playwright documentation.
- Date: 2026-09-26

## Findings

### Existing commands and source anchors

| File | Evidence / responsibility |
| --- | --- |
| `dx:18-50` | Bun runs in `oven/bun:1`, uid mapped, repository at `/app`, HOME/cache under ignored `.devhome`; only ports 3000/5173 are published, with occupied-port skipping. |
| `dev.sh:9-22,72-101` | Existing foreground development entry launches Housou and Vue together, cleans up its own child processes, accepts one `--origin`. URL text is pre-existing user work; do not edit it in M3. |
| `package.json:5-17,20-22` | Aggregate typecheck/lint/tests, contract drift, and old frontend/backend dev scripts; project Playwright range `^1.61.1`. Aggregate test script explicitly enumerates existing test directories. |
| `packages/kyoushitsu/package.json:6-12` | Vue dev/build/typecheck and `test:e2e` scripts. |
| `packages/kyoushitsu/vite.config.ts:12-23` | Vue listens on 0.0.0.0:5173 with polling for bind-mounted HMR. |
| `packages/kyoushitsu/playwright.config.ts:3-27` | No `webServer`; `PLAYWRIGHT_BASE_URL` and optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; failure traces; entry-phone 375x812 and entry-desktop 1280x900. |
| `packages/kyoushitsu/e2e/entry-home.spec.ts:20-49,62-238` | Controlled config/session/auth/create responses; semantic locators, delayed pending gates, 44px controls, no horizontal overflow, configured title/copy and reduced motion. Some historical failure mocks use HTTP 200 with JSON `null`. |
| `packages/kyoushitsu/src/api/http-client.ts:36-50,57-76,149-151` | Generated client includes cookies and rejects null/primitive/empty successful JSON. New M3 fixtures must follow real statuses and envelopes rather than copy legacy null mocks. |
| `packages/housou/src/routes/seitoshou.ts:19-31,42-54,64-86` | Auth returns `Seito`; sign-out returns `{ok:true}`; cookie is HttpOnly, SameSite=Lax, path `/`, secure only in production. |
| `packages/housou/src/lib/seitoshou.ts:69-76`; `lib/errors.ts:98` | Anonymous/expired identity restoration is HTTP 401, code `UNAUTHORIZED`, not successful JSON null. |
| `packages/housou/src/lib/origin.ts:3-24` | Development without explicit CORS origin accepts both frontend origins. An explicit origin permits only one; no multi-origin redesign is needed for M3. |
| `packages/kyoushitsu/src/lib/housou-url.ts:1-7` | Explicit `VITE_HOUSOU_URL` wins, otherwise browser hostname plus :3000. |
| `packages/kyoushitsu/src/lib/theme.ts:1-9`; `src/lib/chat-theme.ts:3-19` | Site theme is fixed `warm-club` attribute. Stored light/dark preference belongs to chat (`houkago:chat-theme`), a room concern; no global home theme-toggle preference exists to migrate. |
| `packages/kyoushitsu/src/router.ts:5-10` | Existing `/` and lazy `/bushitsu/:id` URL vocabulary. |
| `.gitignore:8-12,20-25` | Browser reports/results, `.devhome`, and DB artifacts are ignored. |

Existing, usable project commands (not rerun here):

```sh
./dev.sh
./dx bun run typecheck
./dx bun run lint
./dx bun run test
./dx bun run contract:drift
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=entry-desktop --project=entry-phone
```

The entry suite is route-mocked: Vite is required; a real Housou server is not
required when every backend request is deliberately intercepted. `./dev.sh`
starts a backend that loads `.env` and may use its default DB, so use an isolated
backend command for the separate real-cookie test instead of relying on normal
development data (`packages/housou/package.json:11`, `src/db/client.ts:8`).

### Exact archived blockers and current capabilities

- M0 `.trellis/tasks/archive/2026-09/09-12-behavior-baseline/validation.md:33-41`: all 48 scheduled browser tests failed before assertions because the Bun container lacked `libglib-2.0.so.0`; the adapter smoke stopped before launch because it lacked `openssl`. No server/browser parity was established.
- M2 `.trellis/tasks/archive/2026-09/09-13-http-contract-resources/validation.md:15-27`: contract, 434 aggregate tests, typecheck/lint/build passed; browser suites were not rerun. This is not fresh browser readiness evidence.
- Earlier host profile did work: `.trellis/tasks/archive/2026-08/08-29-warm-club-foundation-entry/validation.md:32-58` records 12 entry tests passing using installed Chrome and diagnostic screenshots at 1280x900/375x812. It does not establish current M3 correctness.

Read-only probes performed in this research session:

| Probe | Observed result |
| --- | --- |
| `command -v docker node bun google-chrome openssl curl ss` (individual lookups) | Docker, Node, Chrome, OpenSSL, curl and ss present; a host Bun binary also exists. Continue using `./dx` for Bun/build/test execution by project policy. |
| `node --version` | v20.19.2. |
| `/usr/bin/google-chrome --version` | Google Chrome 153.0.8010.52. |
| `/usr/bin/openssl version` | OpenSSL 3.5.7. |
| `node_modules/.bin/playwright --version` | Version 1.61.1; installed project CLI resolves. |
| `ldd /opt/google/chrome/chrome` filtered for missing/glib/nss/atk/X11 dependencies | No `not found` result; named libraries resolve on the host. This is not a browser-launch test. |
| Cached browser directories under repo `.devhome/.cache/ms-playwright` and host `.cache/ms-playwright` | chromium-1228, chromium_headless_shell-1228, ffmpeg-1011 present; not launched. |
| Docker version/ps/image-list without escalation | Daemon socket access denied by the sandbox (`operation not permitted`). |
| Read-only `docker ps` / image-list with approved sandbox escalation | Docker inventory accessible; `oven/bun:1` and matching `mcr.microsoft.com/playwright:v1.61.1-noble` are cached. No Houkago service container or published 3000/5173/5174 was shown. Other project containers were untouched and their details are omitted. |
| `ss -ltn` | Netlink socket access denied by sandbox; host port availability remains unverified. Docker inventory alone does not prove host ports are free. |

Use the existing host Chrome profile first. If browser launch or loopback access
is denied under the sandbox during authorized implementation, record the exact
failure and use only a narrow approved validation escalation. Do not disable
browser security or add blanket permissions. Cached matching Playwright Docker
image is a secondary option; its presence does not prove runnable tests or
network reachability, and no container was started/probed internally here.

### Proposed minimal parallel app infrastructure (implementation-only)

1. Keep Vue default `dev:kyoushitsu` and unchanged `./dev.sh` at 5173. Add a separate React package dev/build/typecheck/test command and a root `dev:react` alias, with Vite host 0.0.0.0, explicit port 5174, `strictPort:true`, and bind-mount polling. Proposed alias/package spelling is not final.
2. Add narrow opt-in additional-port support to **existing `dx`**, for example a validated `DX_EXTRA_PORTS=5174` environment input, preserving default port behavior. Do not create another Docker wrapper or always publish arbitrary ports. The exact interface should be fixed in M3 design before editing. `DX_EXTRA_PORTS=5174 ./dx bun run dev:react` is a proposed command and does not work today.
3. Final-design correction: default dx port publishing occurs even without listeners. A Vite-only container can reserve 3000 while the TCP probe sees no API, making a second container fail to publish it. Use the design's one-container `scripts/dev-react-preview.sh` process runner for deterministic three-service/cookie validation, through existing dx only. Independent Vite sessions remain useful separately for mocks; do not infer safe parallel port binding from TCP probes alone. Stop only task-owned sessions.
4. Add a separate React Playwright config accepting the same base-URL and executable environment variables, with only `entry-desktop` and `entry-phone`; failure traces and package-local result paths. Prefer an explicit readiness step over implicitly starting duplicate services. Keep Vue config unchanged.
5. Include the React test directory in the root aggregate test command: current `bun run test` enumerates six package directories and would otherwise silently omit it. Root wildcard typecheck automatically selects new package scripts. Build both apps explicitly.

After implementation, proposed browser command (replace placeholder path with
the approved package):

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/<react-package>/playwright.config.ts --project=entry-desktop --project=entry-phone
```

Run the old entry command independently at 5173. Share semantic expectations and
valid fixture data where useful, but do not simply point the Vue test file at
React: it contains `.floor-sign` implementation selectors and Eden-specific null
fixtures. For a real-cookie smoke, start a task-owned Housou with
`NODE_ENV=development`, `HOUSOU_DB=:memory:`, no upstream credentials and disabled
automatic env-file loading (`bun --no-env-file packages/housou/src/index.ts`
inside `dx`); share hostname `127.0.0.1` for frontend/API/legacy handoff. With
both origins in use, leave development CORS open; with one frontend under test,
an explicit matching `HOUKAGO_CORS_ORIGIN` is sufficient. No production security
policy changes are implied.

### Bounded M3 browser matrix

Run each behavioral entry scenario in both 1280x900 desktop and 375x812 mobile;
keep account/cache isolation edge cases also covered by focused unit tests.

| Scenario | Observable assertions / fixture boundary |
| --- | --- |
| Restore | Delay `/seitoshou/me`, show status/pending gate, then signed-in Seito or real 401 envelope; one restoration request; distinguish network/500 recovery from anonymous state. No private room bootstrap, WS or media while the shell settles. |
| Register / sign-in | Labels, keyboard focus/order, successful typed Seito response, pending disabled controls, explicit 401/422 feedback, no duplicate submits/replayed commands; recover to authenticated home. |
| Sign-out / switch user | `{ok:true}` response, signed-out controls, cleared private scope; release a delayed prior identity/private response and ensure it cannot repaint the next account. Failure behavior follows approved auth design. |
| Home | Public config/title once, fallback/error state, custom long name without overflow; known-room primary action disabled for invalid input; create POST default/configured name, pending/failure/retry and typed success. |
| Deep link / refresh | Load and reload `/bushitsu/<valid-id>`; missing/invalid ID and unknown path have accessible boundary feedback. Verify approved same-window legacy handoff without new React room/bootstrap/WS/media work; assert target URL/room ID, loop prevention and cookie-backed identity continuity. |
| Theme / motion | Root `data-theme="warm-club"`, approved tokens/visible hierarchy, reduced motion stable. Do not invent a global home light/dark setting; preserve chat preference key unchanged for later room migration. Origin-local localStorage does not transfer automatically between 5174 and 5173. |
| Accessibility / layout | Semantic headings, labels, status/alert, keyboard-only dialog/focus behavior of actual chosen primitives, visible focus and disabled states; primary controls >=44px and scrollWidth<=clientWidth at 375px. Diagnostic screenshots of signed-out/signed-in desktop/mobile; no baseline auto-update. |
| Isolated real-cookie smoke | Actual register -> refresh/me -> Vue handoff/same identity -> sign-out -> me401 against memory DB, proving credentials/Set-Cookie/CORS outside mocks. No production account/upstream use. |

Use request counters and listeners to detect unexpected protected HTTP/WS/media
before any chosen hard navigation. Mock every backend endpoint used by pure
entry tests; real-cookie smoke must not route-mock identity. Keep the M4 room
and M5 media suites out of new React acceptance. Preserve existing Vue tests;
rerun broader Vue browser scenarios only if shared theme/runtime modules change.

### Related specs and external references

- `.trellis/spec/trellis-plus/index.md:54-75,94-161`: one Docker wrapper, project-local host browser, controlled fixtures, semantic accessibility, diagnostics/failure traces and submit-ready human classification.
- `.trellis/spec/frontend/quality-guidelines.md:22-26`: run Bun/Vite through dx.
  Its host-Bun-absent claim is stale; wrapper policy remains. Conditional busy-port
  skipping can permit verification alongside live services, but does not prove
  arbitrary Vite-only sessions may reserve default ports concurrently. Final
  design uses one owned container for the multi-service browser gate.
- `.trellis/spec/frontend/http-contract-resources.md:69-76,112-121`: cookie-aware transport, identity before session scope, and private lifecycle policy.
- `.trellis/spec/frontend/site-configuration.md:73,103-119`: public config is a startup projection, not polling; title and fallback need coverage.
- Official [Playwright Docker documentation](https://playwright.dev/docs/docker), accessed 2026-09-26: image supplies browsers/system dependencies but not project package; pin image to project Playwright version. Cached 1.61.1 image matches installed 1.61.1, despite current docs showing newer release examples. Host/browser networking and container runner remain fallback decisions, not prerequisites to M3.
- Official [Playwright use configuration](https://playwright.dev/docs/test-use-options), accessed 2026-09-26: base URL, emulation and trace settings belong in use/project configuration; existing repository implementation already provides these seams.

## Caveats / Not Found

- No browser launch, test assertions, HTTP readiness check, server startup, dependency installation, system package installation, runtime edit or Git operation was performed. Research does not claim current browser pass.
- React package/config does not exist yet; proposed new commands are design recommendations, not executable current commands.
- Main-session decision update: user approved automatic same-window Vue handoff
  on 2026-09-26. `../design.md` fixes package/port/interface/routing choices;
  research proposals above are superseded where the final design is more specific.
- No global axe scan or approved screenshot baseline exists. Automated semantic checks do not certify assistive-technology behavior or visual equivalence; identify the narrow remaining visual/auth judgment at the review gate.
- Docker socket/netlink sandbox limitations differ from missing browser dependencies. Re-check concrete runtime launch/readiness during implementation before classifying browser validation as blocked.
