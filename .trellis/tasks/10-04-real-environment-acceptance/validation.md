# Real-environment acceptance checkpoint — 2026-10-04

Testing and corrected evidence review are complete. The owner authorized
submission and normal closure with `可以继续提交；`. The
earlier backend-defect verdict is withdrawn: the owner confirmed that a
playlist-enabled guest may delete host-added entries. Live Baidu playback and connection-revoke checks passed on
one video inside the explicitly authorized directory tree. Independent evidence
review and owned-runtime teardown are complete; device-tab cleanup has the
explicit limitation recorded below.
This is an acceptance task only: no product repair, production deployment or
Safari run was performed. Work submission and task bookkeeping follow this
verified checkpoint.

| Criterion | Current outcome | Evidence |
| --- | --- | --- |
| A1 — independent room identities, admission, queue, permissions and reconnect | **Passed for recorded scenarios**: DELETE 403 without playlist permission and 200 after permission; both clients receive removal. Guest reorder/bulk-clear remain 403. Earlier host-only single-delete expectation was erroneous. Guest delete-button visibility is recorded separately, not claimed as a passing UI action. | [Desktop execution](research/desktop-results.md), [independent review](research/check-results.md), [corrected observations](research/desktop-queue-permissions.json) |
| A2 — real media and synchronized controls | **Passed on two desktop contexts**: MP4/HLS/DASH bytes, decoded progression, pause/seek/rate, local subtitle, echoed danmaku, fullscreen and <=2s settled drift. | [Desktop execution](research/desktop-results.md) |
| A3 — live Baidu lifecycle | **Passed on desktop Chromium**: real scoped file selection, installed adapter, upstream 206, decoded progression, pause/seek and local revoke/availability/grant/rule checks. DOM activation was used because native CDP input was intermittently lost; Firefox playback and fingerprint success are not claimed. | [Provider execution](research/provider-results.md) |
| A4 — physical Android | **Passed for listed observations**: MP4/HLS, admission, queue reception, playback/follow, software keyboard/chat, native/web fullscreen, cinema, cue, danmaku and refresh recovery; phone-origin queue edits and precise phone drift not measured. | [Device observations](research/android-results.md) |
| A5 — sanitized evidence and cleanup | **Passed with documented residual**: sanitized evidence retained; owned services, browsers, remote fixtures, private profiles/configuration and credentials removed. Android task tabs could not be safely identified at cleanup; owner Firefox temporary extension is outside agent control. | Linked reports and lifecycle below |

## Corrected permission interpretation

The owner clarified that a guest with playlist permission may delete a
host-added item. Existing backend contracts already say this. The frontend
room-runtime spec mistakenly grouped single deletion with host-only reorder
and bulk-clear; the test and prior report inherited that mistake. DELETE 200
and removal are intended behavior, not an authorization defect. Three earlier
runs accurately recorded the HTTP/queue facts but used the wrong expected
status; those runs are retained as historical harness failures.
The unchanged [historical observations](research/evidence/desktop/queue-authority-historical.json)
contain the old `expectedStatus=403`; that field describes the withdrawn test
expectation, not the owner-confirmed product rule.

`packages/housou/src/routes/bushitsu.ts:135` uses `authorizePlaylistMutation`
for deletion; move/clear use `authorizeBuchouMutation`. This permission split
matches the owner-confirmed rule. The corrected focused test **passed in 3.0s**:
rejection without playlist permission, successful deletion after permission,
and authoritative removal on both clients. Guest delete-control visibility is an observation,
not evidence that the backend should forbid deletion. No product change is
made in this correction. The current guest UI still exposes zero delete
buttons and its runtime uses a host-only gate; this is retained as a frontend
implementation observation, not a backend defect or a verified guest UI
deletion action. No UI change was included in this testing-only correction.

## Executed gates

All commands used the existing development image through `dx` where applicable;
network/browser/ADB/Docker execution used approved execution outside sandbox.

```sh
./dx bash -lc 'bun run lint && bun run typecheck && bun run test && bun run contract:drift && bun run --filter houkago-kyoushitsu-react build && bun run --filter houkago-adapter build:chromium'
./dx bun run lint
```

- Root aggregate: **459 passed / 86 files / 0 failed**; seven workspace types,
  lint, 18 deterministic contract outputs, React build and Chromium adapter
  build passed. Final lint after new test files: **275 files, no fixes**.
- Ordinary React Playwright suite: **60 passed, 3 intentional project/device
  skips**, 1.3 minutes. This is regression evidence, with fixture boundaries
  identified in the existing tests.
- Installed Chromium adapter controlled regression: **1 passed**, 1.5 seconds;
  actual content-script/worker/DNR, controlled upstream, no live account claim.
- New opt-in real runner: **six positive cases passed**, 34.7 seconds; seventh
  original incorrectly host-only DELETE expectation failed on three fresh-account executions.
  Its corrected permission case then **passed**, 3.0 seconds. All seven current
  desktop cases have passing evidence across two batches, not a new seven-case
  full-suite run. Independent HLS rerun passed. No routed HTTP/WS or synthetic media authority.
- Scoped Biome, React types and independent strict tsc covering the new runner
  and its opt-in config passed. Independent review found no harness correction
  needed at that earlier checkpoint; the owner subsequently corrected its
  permission premise. Product source remains unchanged.
- After the expectation correction, scoped Biome, React typecheck and
  independent strict tsc on the two test/config files passed again.

Exact real-run endpoints and invocation are in the desktop reports. Public
MP4 UI parse/add/play used the actual MDN CC0 flower clip. LAN input through
public-URL preview correctly returned 400; controlled LAN MP4/HLS/DASH were
added through the existing explicit host HTTP path. This topology distinction
was retained as a separate guard test instead of suppressing it.

Two desktop clients' maximum sampled settled drift: MP4 **0.008355s**, HLS
**0.091208s**, DASH **0.008761s** (18 samples each). Independent HLS max
**0.005315s**. These are same-machine observed samples with task tolerance 2s,
not a WAN/device SLA. Reconnect was document reload, not network outage.

Live Baidu: decoder `readyState=4`, no media error; time advanced
**1.770556 → 3.267858s** over a 1.5s observation, pause drift **0s**, seek
**15 → 15s**. Three upstream responses returned **206** with valid numeric
Content-Range headers. Content-Length is a response header, not a measured
download total; cross-origin ResourceTiming byte sizes were unavailable.
Local connection DELETE returned **200**, availability became
`playable=false / connection-revoked`, new grant returned **409**, an existing
unclaimed ready grant failed actual installed-adapter preparation, and media
session rules fell **4 → 0**. This does not assert erasure of already-buffered
video bytes or revoke the account's authorization at Baidu itself.

## Artifacts and lifecycle

Local task root `/tmp/houkago-acceptance.nJ2AJ79D`; remote task root
`/tmp/houkago-acceptance.3OdAL5Wc`. Logs:
`artifacts/root-checks.log`, `final-lint.log`, `react-regression.log`,
`adapter-regression.log`, `preview-start.log`, `provider-preview-start.log`.
Eight sanitized desktop observation JSONs are durably retained in
`research/evidence/desktop/`; they contain no provider credentials or private
file details. Final sanitized live-provider observations and all 11 true
factual assertions are retained in
[live-lifecycle.json](research/evidence/provider/live-lifecycle.json).
Sanitized observations/screens from successful desktop execution are in
`artifacts/desktop-final`; independently reproduced historical harness failure in
`artifacts/check-queue-authority`; independent HLS in `artifacts/check-hls`.
Android screenshot names are explicitly listed in its report.

Runtime: core frontend/backend 15943/13943 **stopped and removed** through its
own preview lifecycle; original headless core browser closed. Debian media
18943 process 1301501 **stopped** after exact task cwd and command validation.
`artifacts/core-cleanup.log` records successful preview teardown, and no running
containers retain the core temporary repo label. Debian media log was copied to
`artifacts/debian-media.log`; all nine known fixture assets, the task server
script/log and the now-empty remote task directory were removed successfully.
Provider 15944/3000 is also **stopped and removed** through its exact-label
preview lifecycle; `artifacts/provider-cleanup.log` confirms teardown, and no
running containers retain the provider temporary repo label. Core/provider preview containers
are labeled with their distinct temporary repo paths. Do not stop another
repository's containers, clear phone browser data, or use broad process kills.
Provider browser/tunnel ownership is recorded in its report. Both dedicated
Chromium processes were closed with exact CDP Browser.close; sessions 66345
and 20328 exited 0. The SSH tunnel had already ended; the main scratch Node
REPL also exited 0. Both private profiles, the credential-input directory,
temporary provider `.env`, raw browser log, OAuth redirect and distributed
extension archives were removed. Sanitized logs, scripts and fixture evidence
remain under the local task root for audit. The prior A1 backend-failure verdict
is withdrawn; corrected regression passed.
The core preview was briefly restarted solely for the corrected queue test and
then stopped again with its existing lifecycle. Logs are
`artifacts/queue-permissions-preview-start.log` and
`artifacts/queue-permissions-preview-stop.log`; the final status was stopped.
No provider/account, remote media or Android run was repeated.

Android cleanup probe did not identify the task browser UI. No further device
input or browser-data deletion was attempted; task tabs may remain for the owner
to close. The diagnostic XML was immediately removed.
The owner's Firefox temporary extension is outside agent control; restarting
Firefox removes that temporary installation. Its local download is not deleted
by this agent.

Auth/input diagnostic images were removed. No Baidu credentials, private
profile, HAR, dlink or user file listing belongs in retained task evidence.
Safari and production/WAN deployment are excluded by approved scope.
