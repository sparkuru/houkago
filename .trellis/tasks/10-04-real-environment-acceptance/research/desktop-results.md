# Desktop real-environment acceptance — 2026-10-04

## Result and boundary

Six positive desktop cases passed in the earlier 34.7-second run. After the
owner corrected the single-delete requirement, the seventh focused queue case
passed in 3.0 seconds (test body 2.3 seconds). All seven current desktop cases
therefore have passing evidence across these two batches; the final seven-case
suite was not rerun as one batch. A1 desktop authority/lifecycle evidence and A2
desktop media checks pass within the boundaries recorded below.

Two earlier focused runs failed because the test incorrectly expected a
playlist-enabled guest's single-item DELETE to return403. The owner clarified
that any admitted guest with playlist permission may delete any queued item,
regardless of authorship; existing backend specifications already support this.
The defect interpretation is withdrawn. Historical raw results remain unchanged
and are annotated below; no product fix was made.
Browser: project-local Playwright 1.61.1 bundled Chromium 149.0.7827.55, desktop
1280×900. Each shared-room test uses independent temporary cookie contexts and
actual Housou HTTP/WS. No request routes, injected authority frames, fake media
responses, personal profiles or external account credentials are used.
Android, Baidu and overall task closure are main-session responsibilities.

## Actual endpoints and reproduction

Core runtime is the main-session-owned isolated memory preview, frontend
`http://127.0.0.1:15943`, backend `http://127.0.0.1:13943`. Controlled MP4/HLS/DASH
and subtitle bytes come from the actual Debian HTTP origin
`http://192.168.9.3:18943`. Positive public preview uses the MDN CC0 sample
`https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`.
These are test endpoints, never implicit defaults.

The final six-case command (before adding the focused seventh case):

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:15943 \
PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:13943 \
PLAYWRIGHT_MEDIA_URL=http://192.168.9.3:18943 \
PLAYWRIGHT_PUBLIC_MEDIA_URL=https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4 \
PLAYWRIGHT_REAL_OUTPUT=/tmp/houkago-acceptance.nJ2AJ79D/artifacts/desktop-final \
node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.real-environment.config.ts
```

The final checked-in runner discovers seven cases. All four endpoint variables
are required; an absent endpoint throws before discovery instead of passing a
skip. Artifacts default to `/tmp` and can be scoped with
`PLAYWRIGHT_REAL_OUTPUT`. The earlier incorrectly specified focused case was executed twice with the
same environment, adding `--grep 'permitted guest cannot delete'`, with distinct
output directories `desktop-queue-authority` and
`desktop-queue-authority-reproduction` under the same artifact root.

## Verified observations

| Case | Status | Primary evidence |
| --- | --- | --- |
| Public-preview LAN guard | pass | Real UI preview HTTP 400 with `private and local upstream URLs are not supported`; queue remains empty |
| Actual public UI preview/add/play | pass | Preview 200; source resolution/add through real UI; proxy 206, video/mp4, Content-Length 1,128,375; decoded currentTime 0.829786s, playing, readyState 4, no media error |
| Two-client room lifecycle | pass | Different account IDs; guest receives waiting then entered; zero protected reads while waiting and two bootstrap reads after approval; bidirectional chat; denied guest add 403; server-echoed permissions; room-governance/reorder/clear controls absent for guest; guest selection; owner clear |
| Document reconnect | pass | Real guest socket closure count increases by one, fresh entered event, same restored account ID, authoritative current title and two queue rows restored; host sees each pre/post reconnect chat command once |
| MP4 over Debian HTTP | pass | Both browsers receive actual clip.mp4 206 with 83,577-byte content-length; media progresses; host pause/seek and permitted guest rate/seek/resume/pause settle within tolerance |
| HLS over Debian HTTP | pass | Actual master/media playlist and 91,932-byte MPEG-TS segment for both clients; host fetches subtitle manifest/VTT; active showing cue contains `Acceptance English subtitle`, guest subtitle stays off; actual echoed danmaku visible inside fullscreen subtree and room controls restore on exit |
| DASH over Debian HTTP | pass | Both browsers fetch manifest, 827-byte init and 82,914-byte media segment; progression, pause/seek/rate and resume observed |
| Queue HTTP permission split | pass | Admitted guest DELETE403 before playlist permission, queue unchanged; after permission move403/clear403 remain denied, DELETE200 removes owner item; host and guest apply identical final BANGUMI and DOM queues |

Each controlled format records 18 independent time observations across initial
play, host pause/seek, permitted guest seek/rate/resume and guest pause. At each
settled observation both paused states agree, media error is null and drift is
at most two seconds. Actual maximum recorded drift:

| Format | Maximum observed drift |
| --- | --- |
| MP4 | 0.008355 seconds |
| HLS | 0.091208 seconds |
| DASH | 0.008761 seconds |

The two contexts run on one desktop host; these numbers do not establish WAN
latency, heterogeneous-clock behavior or a product SLA. Content lengths are
response-header facts, not an aggregate transfer counter. Actual progression
establishes successful delivery/decoding beyond a response header alone.
Document reload reconnect does not establish recovery from a cable/network
outage or replay gating while an existing document is offline.

## Owner-corrected queue requirement and focused run

The original host-only single-delete expectation was mistaken. Current owner
clarification and existing backend session/quality specs require source add,
select and single-item deletion to follow playlist permission. Reorder and
clear-pending remain host-only. `authorizePlaylistMutation` on item DELETE is
consistent with that rule; item authorship adds no deletion restriction.

The corrected case uses two fresh throwaway accounts and a fresh room. It waits
for real guest NYUUSHITSU entered, then queues two owner-added pending entries.
With playlist permission false, the admitted guest's actual DELETE returns403
and backend, host DOM and guest DOM preserve both titles. After host changes
the real permission preset and waits for its echoed state, guest move and
clear return403 and preserve both entries. Guest DELETE then returns200 and
removes only the target; actual BANGUMI payloads and rendered queues on both
clients contain exactly `Owner retained pending`.

The observed playlist-enabled guest delete-button count is0. This is a
visibility observation only, with no assertion that it is required or correct;
the earlier broad lifecycle case also removes this deletion-visibility assertion
and records its count only (reorder/clear visibility assertions remain).
No product UI change or further UI-remediation scope was authorized.

Exact corrected focused command:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:15943 \
PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:13943 \
PLAYWRIGHT_MEDIA_URL=http://127.0.0.1:15943 \
PLAYWRIGHT_PUBLIC_MEDIA_URL=https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4 \
PLAYWRIGHT_REAL_OUTPUT=/tmp/houkago-acceptance.nJ2AJ79D/artifacts/desktop-queue-permissions \
node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.real-environment.config.ts \
  --grep 'guest queue deletion follows playlist permission'
```

Result: **1 passed (3.0s)**. All four endpoints remain explicit required config
inputs. This narrow queue-only run uses the frontend origin solely to construct
an unused pending media URL; it does not select a current item, resolve or
preview a public source, or download media. Pending-media request count is0.
The stopped Debian media server and public media need not be restarted/reached
for this case. No provider runtime, test-account credentials, OAuth, remote
server or Android rerun was involved.

Neutral task evidence is `research/desktop-queue-permissions.json`, copied
unchanged from this run's sanitized observations. It records actual statuses,
permission phases, queue states on both real clients and zero media requests.
The earlier `desktop-queue-authority` and
`desktop-queue-authority-reproduction` raw JSON remains historical evidence of
the incorrect expectation, not a product defect or final acceptance failure.

## Harness corrections and checks

- Initial sandboxed browser launch failed before application execution with
  Chromium `sandbox_host_linux.cc` IPC/shutdown operation denial. Approved
  out-of-sandbox execution launched normally. This is an environment failure.
- Initial four cases expected LAN preview success and received the actual
  intentional 400 guard. Those artifacts remain in `desktop-unmocked-unsandboxed`.
  Main approved the technical topology correction: explicit supported host
  `POST /enmoku` type/url addition for controlled LAN media, separate guard
  check, and an actual public source for UI-preview success. No guard bypass or
  product mutation was introduced.
- First corrected five-case run passed the guard and three media cases but
  the lifecycle harness tried filling an already disabled composer. The test
  now fills before permission revocation and asserts both input and submit
  disabled. The subsequent six-case run passed. Earlier run artifacts remain
  in `desktop-supported-http`.
- Scoped Biome check on the corrected test and unchanged opt-in config passes, no suppressed rules.
- `./dx bun run --filter houkago-kyoushitsu-react typecheck` passes after the
  corrected queue test. An initial concurrent dx check briefly raced another
  ephemeral check for optional port9999; a sequential retry passed. No existing
  service was stopped for that check.
- The new config is outside the package's existing explicit tsconfig include;
  it was separately checked with `./dx ./node_modules/.bin/tsc --noEmit --strict
  --skipLibCheck --target ESNext --module ESNext --moduleResolution bundler
  --types bun packages/kyoushitsu-react/playwright.real-environment.config.ts`:
  pass.
- `git diff --check` passes. Root aggregate checks/builds are coordinated by
  the main session. No production or contract/schema change occurred.

## Retained evidence and cleanup

Artifacts root: `/tmp/houkago-acceptance.nJ2AJ79D/artifacts/`. Every completed
case writes `sanitized-observations.json` and attaches a copy. Room screenshots
cover LAN rejection, actual public playback, governance/reconnected guest, and
host/guest final states for all three controlled formats. HLS/public screenshots
were visually inspected: real video frames and rendered subtitle are visible.
Screenshot scroll position may clip the room heading; DOM assertions and JSON
are the primary authority/progression evidence.

Historical incorrect-expectation evidence is retained at
`desktop-queue-authority/real-environment-permitted-f26e8-ritative-queue-through-HTTP/`
and the equivalent `desktop-queue-authority-reproduction/` directory, including
sanitized statuses and before/after queue titles. No cookies, passwords, auth
form screenshots, HAR or browser storage dumps are retained. Global trace,
video and failure screenshots are off; manually retained screenshots are room
UI only. Playwright closes both task contexts and removes its owned temporary
profiles after each run. The earlier shared media teardown was main-owned. The focused corrected run
restarted and then stopped only the exact-owned core temporary preview; see
the cleanup checkpoint below.

## Corrected-run cleanup checkpoint

Only `/tmp/houkago-acceptance.nJ2AJ79D/runtime` was restarted through its existing
`./preview.sh start`, with memory DB and prepared dependencies. The mandatory
readiness summary is retained in `artifacts/queue-permissions-preview-start.log`.
After the focused pass, `./preview.sh stop` returned0 and retained its output in
`artifacts/queue-permissions-preview-stop.log`; `./preview.sh status` confirmed
stopped. The wrapper uses exact temporary-repo/scope/service ownership. No
provider preview/profile, credentials, remote media, Android or unrelated local
service was started or changed. Playwright contexts and temporary browser
profiles closed when the single focused test finished.
