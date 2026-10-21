# Same-origin API preview validation

Implementation authorized by the owner with `可以；开始实施` on 2026-10-21.
Implementation and scoped verification are complete. The owner authorized work
commit and task archival with `提交；归档` on 2026-10-21. Push and production
deployment remain outside scope.

## Delivered behavior

- Housou owns `/api/...`; Vite proxies that exact boundary and WS upgrades
  without stripping it. Page and room navigation retain their paths.
- The normal Docker preview publishes only the configured site port. Its two
  services share an owned network with a stable backend alias. Host-port zero
  supports inspected dynamic publication.
- Browser HTTP, WS, generated SDK and extension consumers agree on the new
  prefix. HTTP SDK paths own the prefix once; extension bases retain `/api`
  while trust comparisons use origins.
- New resolved queue media URLs are site-relative, including variants,
  subtitles and covers. Baidu source/grant/sentinel paths and HLS/DASH response
  references retain the prefix. Cookie, Origin, bearer and room authority stay
  in their existing owners.
- Health requires internal listeners plus the published site root and JSON
  `/api/health`. Missing API routes return JSON 404. Elysia's framework errors
  are handled before domain codes so `NOT_FOUND` cannot be misclassified as 500.
- Existing private `.env` values are preserved. Retired backend publication
  and browser-base settings warn by key name and are ignored. No new user
  secret/configuration is needed for basic preview.

## Automated checks

| Check | Result and evidence |
| --- | --- |
| `./dx bun run test` | **464 pass, 0 fail**, 91 files; `/tmp/houkago-api-tests-final.log` |
| `./dx bun run typecheck` | All seven workspaces pass; `/tmp/houkago-api-types-complete.log` |
| `./dx bun run lint` | 288 files pass; `/tmp/houkago-api-lint-complete.log` |
| `./dx bun run contract:drift` | 18 generated files byte-stable; `/tmp/houkago-api-drift-final.log` |
| `./dx bun run --filter houkago-kyoushitsu-react build` | Pass; `/tmp/houkago-api-build.log`; existing bundle-size warning retained |
| `python3 scripts/test-preview.py` | **35 pass**, including network ownership, obsolete settings and HTML masquerading as API health; `/tmp/houkago-api-preview-third.log` |
| `bash scripts/test-react-preview.sh` | **93 shell behavior checks pass**; `/tmp/houkago-api-shell.log` |
| `bash -n dx preview.sh scripts/preview-services.sh scripts/dev-react-preview.sh` | Pass |
| ShellCheck / shfmt | Unavailable on this host; not claimed as run/passed |
| `git diff --check`, task context validation | Pass |

Initial direct `bun test` invocation lacked the repository's memory-DB setting
and failed against the existing legacy fixture state; switched to the declared
`bun run test` command rather than modifying/deleting data. Migration failures
then identified one old auto-admission test pathname and stale assertions.
The final suite passes without weakened authority checks.

## Browser acceptance

Host Chromium could not launch because `libatk-1.0.so.0` is absent; that run
establishes no application verdict. Used the existing `houkago-dev:playwright`
image and mounted browser cache instead, without installing system packages.
Docker used uid/gid 1000:1000, `/app` project mount and `HOME=/app/.devhome`.
Application acceptance used host networking solely to reach the inspected
loopback site publication. Commands ran the project-local CLI with
`bun --no-env-file node_modules/@playwright/test/cli.js test`.

Application configuration: `packages/kyoushitsu-react/playwright.config.ts`;
base `http://127.0.0.1:32800`, API `http://127.0.0.1:32800/api`, executable
`/app/.devhome/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`.

- Full 13-project checkpoint: **72 pass, 4 fail, 3 skips**, 79 cases;
  `/tmp/houkago-api-browser-docker.log`. The failures were stale permission
  checkbox and admission-field selectors against the pre-existing dirty room
  controls, rather than API failures. Aligned selectors with checkbox roles,
  the existing `片源选择` label and the labeled admission field; kept all state,
  permission-denial, echo, reconnect and final-state assertions.
- Rechecked those four desktop/phone flows: admission pair passed in
  `/tmp/houkago-api-browser-recheck.log`; final queue-permission pair passed in
  `/tmp/houkago-api-browser-final-pair.log`. Effective existing coverage is
  **76 verified cases plus 3 explicit applicability skips**, across these runs.
- Added a focused resolved-media case and ran `media-desktop` / `media-phone`
  against `http://127.0.0.1:33512` with API `/api`: **2 pass**;
  `/tmp/houkago-api-relative-media.log`. Actual HTTP source resolution and WS
  queue echo produce a relative URL, and the player resolves it to the current
  site, decodes the controlled MP4 and advances playback. Only media bytes are
  intercepted; this is not upstream-provider verification.
- Existing media cases cover MP4/HLS/DASH, seek/subtitles/fullscreen and
  two-client playback authority. Entry, real-cookie, room controls, danmaku,
  Baidu fixtures and tablet/short/tall projects retain their recorded scopes.

Adapter build: `./dx bun run --filter houkago-adapter build:chromium` passed.
Installed suite `packages/houkago-adapter/playwright.chromium-adapter.config.ts`
with one worker: **1 pass** in `/tmp/houkago-api-adapter-browser.log`. Controlled
HTTP/HTTPS fixtures verify path-bearing pairing, real content script/worker/DNR,
Range/header behavior, grant ownership and rule cleanup. Unit tests additionally
prove old origin-only pairings remain unpaired, strict configured origins and
credential/query/hash/path rejection. This does not prove live Baidu OAuth,
Firefox installation or physical-device behavior.

## Real Docker verification and cleanup

Used isolated source/configuration at `/tmp/houkago-api-preview.nas8iwlt`, fresh
SQLite data and no provider credentials. The owner's original preview was not
stopped or recreated. Exact repository labels were inspected before operations.

- First listeners: backend 33101, frontend 33102, loopback site publication
  dynamically assigned 32800. Backend has no host mapping; both services are
  on the owned bridge. Normal start/reuse/status pass without duplicates.
- `/api/health`, opt-in `/api/openapi/json`, API JSON 404 and the `/api` versus
  `/apix` boundary pass. Non-API unknown paths retain Vite's page fallback.
- Controlled upstream inside the disposable backend verifies actual Range 206,
  HLS manifest/segment rewriting and DASH references through Vite. Evidence:
  `/tmp/houkago-api-runtime-check.py`, `/tmp/houkago-api-real-proxy.log`.
- Stopping the exact task-owned backend makes status unhealthy without a ready
  banner. Stop retains the SQLite accounts. A second pair, backend 33411 and
  frontend 33412 with dynamic site mapping, starts and retains the account count.
  Reuse/status/stop/repeated down pass and remove only owned containers/network.
  Original preview IDs are unchanged. Evidence:
  `/tmp/houkago-api-lifecycle-check.py`, `/tmp/houkago-api-real-lifecycle.log`,
  `/tmp/houkago-api-second-start.log`.
- The existing memory helper was run on internal 33511 / site 33512; proxied
  health JSON and unauthenticated identity 401 pass. Its exact command and
  source mount identified the owning container for teardown.
- Final resolved-media preview on site 33512 is stopped; status is stopped.
  `/tmp/houkago-api-final-cleanup.log`. Disposable SQLite data is retained;
  task-owned containers/networks are removed.

## Acceptance and review boundary

A1–A6 are verified within the agreed local-development scope. Checks above
separate unit, stub lifecycle, real Docker, real HTTP/WS, controlled media and
installed-extension evidence. No visual design was changed in this task.
`human-optional`: local fixture behavior is automated; reviewing real deployment
configuration remains useful but is outside the requested implementation.

Switching the owner's existing preview requires an explicit normal stop/start;
tests intentionally did not perform that cutover. Old `.env` keys can remain
without being honored. Real OAuth configuration/registration must point to the
public site's `/api/baidu/oauth/callback`. Extensions must be rebuilt/reloaded
and explicitly re-paired for their path-bearing base.

Historical queued absolute application proxy URLs are preserved in the database,
not automatically rewritten. Items still targeting the retired backend origin
may need re-resolving/re-adding after cutover. Arbitrary direct external URLs
must not be rewritten by pathname guessing. No production hosting, TLS or live
provider/physical-device acceptance is claimed.

## Owner configuration follow-up

The owner changed manifest defaults to backend 8081 / frontend 8080, renamed
the public runtime keys and selected a site-relative Baidu callback. All
consumers now use `BACKEND_HOST`, `BACKEND_PORT`, `FRONTEND_HOST`,
`FRONTEND_PORT`, `FRONTEND_PUBLISHED_PORT`, `LAN_HOST` and `READY_TIMEOUT`:
loader, Docker injection, backend startup, supervisor, readiness and summary.
`preview.sh` continues to forward to this single implementation in `dx`.
Old public `HOST`/`PORT`/`PREVIEW_*` keys are ignored with key-only warnings;
internal fingerprint/topology keys remain internal. No private `.env` value
was rewritten. Safe parsing confirmed the owner's actual listeners are
8081/8080 and explicit publication is **9999**, independently of the frontend
listener. With that publication key absent, the manifest frontend default wins.

Relative `/api/baidu/oauth/callback` resolves against the OAuth-start request
Origin after existing trust checks (request URL fallback only under the
existing Origin-less development policy). Only the resulting full HTTP(S) URI
is sent to Baidu, and it is pinned to the one-use state. Exchange retains that
exact URI even after callback configuration changes. Explicit absolute callback
URLs remain supported; URL escapes/credentials/query/hash/non-web schemes and
missing required origin are rejected. Production origin policy is unchanged.

Follow-up validation supersedes the earlier counts for the affected surfaces:

- `./dx bun run test`: **477 pass**, 92 files, including callback origin
  variants and an actual HTTP OAuth flow whose token-exchange fixture verifies
  the pinned URI after a configuration change;
  `/tmp/houkago-api-config-tests.log`.
- Lint and all seven workspace types pass;
  `/tmp/houkago-api-config-lint.log`, `/tmp/houkago-api-config-types.log`.
- `python3 scripts/test-preview.py`: **36 pass**;
  `/tmp/houkago-api-config-preview-pass.log`. An initial renamed duplicate-key
  fixture still contained a legacy key and was corrected; no production
  validation or assertion was weakened.
- `bash scripts/test-react-preview.sh`: **93 checks pass**;
  `/tmp/houkago-api-config-shell.log`. Shell/Python syntax and diff checks pass.
  ShellCheck/shfmt remain unavailable.
- Real isolated Docker startup used omitted listener keys, verifying manifest
  8080/8081 with dynamically published site port 32802. Inspected backend has
  no host publication. Reuse/status/public `/api/health` pass. Synthetic OAuth
  configuration and a disposable account verify generated callback URIs using
  actual published port, localhost and HTTPS-origin header values. No request
  was made to Baidu and no real TLS/device/provider acceptance is claimed.
  `/tmp/houkago-api-config-real-start.log`,
  `/tmp/houkago-api-config-real-check.py`,
  `/tmp/houkago-api-config-real-check.log`.
- Exact task-owned preview stop/repeated down pass and remove its containers
  and network; `/tmp/houkago-api-config-cleanup.log`. The owner's existing
  running preview was not stopped/recreated and requires normal stop/start
  for its changed runtime configuration.

A7 is verified. Prior desktop/phone and installed-extension evidence remains
applicable to unchanged client/UI code; this follow-up changes server-side
configuration and OAuth URI generation. Baidu's registered callback must
correspond to the full generated public URL; registration is not edited here.

## Authorized closure

The owner requested `提交；归档` after reviewing delivery and configuration
follow-ups. Residual migration/provider notes above remain explicit; no further
human-only prerequisite is claimed for this approved local-preview scope.
The commit batch includes implementation, configuration, generated contracts,
scoped tests/specs and this task's evidence. The unrelated pending
`packages/kyoushitsu-core/src/i18n/messages.ts` change is excluded. Private
`.env`, local runtime pointers and unrelated tasks are not staged.

Work was performed directly on existing `k-on`, without a task-specific branch
or PR. Archival uses the supported `--skip-branch-validation` option for this
non-PR-backed task; recorded branch/base fields are retained rather than
inventing a feature branch or merge. Closure consists of a work commit, an
exact-path archive commit with the project's single Codex attribution trailer,
and a separate journal/mainline commit. No push or existing-preview restart.

Work commit: `65e53d0` (`feat(preview): unify business routes under same-origin api`).
