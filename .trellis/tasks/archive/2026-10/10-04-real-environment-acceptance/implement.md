# Execution plan

Status: in progress after owner approval `开始测试` and task start. Desktop
implementation/review and physical Android observations are complete. The
owner corrected A1's erroneous host-only single-delete expectation; its focused
test passed after correction. A3 live media/lifecycle testing passed. The owner
declined remote control, installed the Firefox test adapter and authorized use
of their Houkago test account. Authenticated status confirms connected
server-saved credentials and an online adapter; one scoped provider directory
was authorized for video selection. Owned runtime/profile/credential teardown
is complete; unidentifiable Android task tabs and the owner-operated Firefox
temporary extension have documented cleanup limits. No product repair was
performed; the owner authorized submission and normal closure.
See `validation.md` for executed results and explicit limits.

## 1. Baseline and owned environment

- [x] Recheck Git status and preserve any later owner changes.
- [x] Read task context and relevant skills; implementation/check dispatch uses
  `Active task: .trellis/tasks/10-04-real-environment-acceptance` and native
  context injection, with child-side manifest loading if absent/truncated.
- [x] Recheck SSH via `-F "$HOME/.ssh/config"`, ADB device, browser versions,
  local development image, free ports, and existing application services.
- [x] Choose task-owned local/remote `/tmp` directories and record their paths.
- [x] Prepare isolated source/configuration using existing preview/dx, memory
  database, distinct ports and no copied user `.env`/database/profile.
- [x] Start a task-owned media HTTP origin on Debian with bundled assets and
  truthful MIME/Range/206/HEAD/CORS responses. No remote package installation.
- [x] Start the isolated preview, inspect actual labels/mappings/listeners,
  probe both services and verify desktop/Android network access. Follow the
  mandatory console contract; readiness alone is not acceptance.

## 2. Regression and desktop unmocked path

- [x] Reuse existing real-cookie/media/room-controls/danmaku projects for
  baseline regression with matching frontend/backend variables.
- [x] Add only the missing opt-in unmocked HTTP acceptance case/automation,
  avoiding routed preview/media responses and WS replacement in this path.
- [x] Exercise independent identities, approval, chat, queue, host/guest
  permissions, actual media parsing/addition and forbidden guest mutations.
- [x] Observe MP4/HLS/DASH delivery, actual playback progression, pause/seek
  authority, <=2s settled drift, subtitles and echoed danmaku. Record what each
  media format/client was actually tested on.
- [x] Disconnect only the task client/connection; recover with current identity,
  fresh admission, current item/state and no replayed/duplicated command.

Representative existing commands (substitute actual isolated endpoints):

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:<frontend-port> \
PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:<backend-port> \
node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.config.ts \
  --project real-cookie --project media-desktop \
  --project room-controls-desktop --project danmaku-desktop \
  --output /tmp/<task-evidence>/desktop-regression
```

Use the bundled Chromium if available; select an existing compatible executable
only when necessary. Determine exact new acceptance-runner invocation from its
implemented interface; do not claim the command exists before it is written.

## 3. Physical Android

- [x] Use the discovered device explicitly with `adb -s <current-device>`.
  Recheck transport rather than persisting the discovery port as a requirement.
- [x] Probe existing browser debug support; use UIAutomator/input/screencap when
  unavailable. No installation, root privilege or persistent settings assumed.
- [x] Open task-owned browser pages, create/join with a separate throwaway
  identity, and test desktop/Android shared-room state and permissions.
- [x] Exercise actual virtual keyboard/chat submission, queue, video start,
  follow/seek/pause, subtitles/danmaku, cinema and fullscreen entry/exit.
- [x] Exercise browser reload/reconnect; verify restored identity/current state.
- [x] Retain task-only screen evidence and final-state observations; classify
  cases unavailable where the installed browser cannot expose enough evidence.

## 4. Adapter and live provider

- [x] Build the existing Chromium adapter and run the adapter-owned controlled
  installed runner as an explicitly separate regression boundary.
- [x] Validate Baidu required-key presence/format and callback reachability
  without exposing values; prepare a dedicated local desktop profile/runtime
  only for the intentional live-provider run.
- [x] Use an explicitly available dedicated test account/file; do not import
  personal browser credentials. Automate pairing, preparation and lifecycle.
- [x] If OAuth login/captcha/file selection needs the owner, complete other
  automation first, then request precisely that action; leave A3 open meanwhile.
- [x] Record live preparation, delivered bytes/progress, play/pause/seek,
  revoke and availability outcomes with only sanitized provider facts.

```sh
./dx bun run --filter houkago-adapter build:chromium
node_modules/.bin/playwright test \
  --config packages/houkago-adapter/playwright.chromium-adapter.config.ts \
  --workers=1 --output=/tmp/<task-evidence>/adapter-regression
```

## 5. Check, evidence and cleanup

- [x] Independent check review validates actual evidence against A1–A5,
  distinct fixture/live/device claims, privacy and preservation constraints.
- [x] For persistent test-code changes, run scoped checks then root lint/types/
  tests and React build through dx. Run contract drift for changes touching
  contracts/import boundaries; otherwise record no contract change. Apply
  ShellCheck/shfmt/bash syntax or Python checks only for corresponding scripts.
- [x] Record commands, browser/device versions, URLs without secrets, observed
  states, timing/drift, failures, retries, skipped scope and artifact locations
  in `validation.md`. Do not weaken requirements to manufacture passes.
- [x] Stop only task-owned preview containers by their exact temporary repo
  labels/IDs and task-owned remote media process. Close owned device/browser
  tabs and profiles; retain audit artifacts, remove only disposable temp data.
  Android tabs were not identifiable at cleanup; no unowned device input/data
  change was attempted. Owner-operated Firefox extension removal is documented.
- [x] Recheck Git diff/status, manifests, links and secret-free retained evidence.
- [x] Request human review only for an actually unresolved human-only question.
  If a required criterion is blocked, report the missing prerequisite and do not
  mark the entire task accepted or archived.
  Owner resolved account/video prerequisites; no further human-only test input
  remains. Owner clarified that playlist-enabled guests may delete host entries;
  this corrects the acceptance premise and requires no backend repair.
- [x] Commit/archive requires the normal owner authorization and project policy.
  Owner approved continuation with `可以继续提交；`; submit verified changes,
  then archive and journal through the normal workflow.
  Work commit `f9ec774` is recorded; task archive metadata is completed and
  context references resolve at the archive destination.

## Rollback and stop conditions

No product/persistent system change is planned. Rollback means stopping exact
task runtime resources and removing only task-created temporary artifacts.
Stop the affected branch for changed SSH keys, unauthorized device, occupied
ports, unowned data/profile overlap, unexpected credential logging, missing
provider inputs or a product defect requiring repair. Continue unaffected tests
and report their results separately. Production deployment/push is excluded.
