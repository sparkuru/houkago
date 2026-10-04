# Real-environment acceptance design

## Boundaries and topology

This task validates the shipped React/core/Housou/adapter boundaries. It adds
only justified test automation and evidence, with no product behavior change.
Use one task-owned runtime shared by desktop browser contexts and physical
Android, with the actual backend handling cookies, admission, commands and WS.

Start from an isolated source/configuration copy under local `/tmp` using the
existing `dx`/`preview.sh` lifecycle. Do not copy the root `.env`, databases,
personal browser profiles or unrelated ignored files. Existing dependencies may
be reused through an explicit local mount/link after confirming the runtime path
works; exclude user state. Configure `HOUSOU_DB=:memory:`, free distinct ports,
trusted-LAN host publishing, and empty provider inputs for core acceptance.
Leave `VITE_HOUSOU_URL` unset so each browser uses its reachable frontend host
with the actual published backend port. Verify exact cookie/origin behavior from
Android instead of assuming localhost semantics transfer to LAN.

Use the Debian server at `192.168.9.3` as a real HTTP media origin, running only
task-owned temporary processes under a recorded `/tmp` directory. Reuse bundled
MP4/HLS/DASH/subtitle assets; serve correct MIME types, CORS, Range/206 and HEAD
behavior. Python is already available. This adds a physical network/HTTP path
without replacing the media request with Playwright routing. It validates actual
transport/decoding, but remains a controlled media source and proves no private
upstream authorization. Capture only method/status/range/byte-count facts.

If local LAN discovery or Android reachability is unavailable, record it and
use a scoped SSH/ADB forwarding path only as separately labelled transport
evidence. A tunnel must not count as native LAN acceptance. Do not alter device
network settings or use broad firewall/service changes.

## Client automation

Reuse project-local Playwright on the local host for desktop Chromium and two
independent temporary browser contexts. Add the smallest meaningful unmocked
acceptance scenario/runner only where existing tests cannot express this path;
make it opt-in with explicit endpoint inputs, not dependent on a developer's
default preview or private account. An absent required endpoint is unavailable,
not a passing skip. Existing fixture tests remain distinct regressions.

Use the connected PLR110 for a physical second client. Select an installed
ordinary browser (initial preference: Via's existing web handler; Firefox is
available). Probe debug support/version. Use semantic DOM assertions through an
existing debug transport when available; otherwise combine ADB UI hierarchy,
touch/input, actual backend observations and device screenshots. Do not infer
playback progress or synchronization from screenshots alone. Use server events,
observable media progression and repeated independent observations as available.

Physical keyboard cases must invoke the actual Android keyboard and demonstrate
that chat submission remains usable; DOM injection alone is not that evidence.
Fullscreen requires observable entry/exit and restored room controls. Prefer
ASCII-only task account/chat labels for portable ADB input; a separate Unicode
case may use existing device input capabilities without replacing its keyboard.

## Real Baidu boundary

Build and run the actual adapter in a dedicated desktop testing profile. The
existing controlled installed-extension runner remains a baseline. Live Baidu
acceptance needs valid parsed application/callback configuration and a usable
test account/file. Transfer no credentials to the Debian media origin or Android.
Use selected credentials only in the intended local backend/desktop authorization
path after readiness; never log values or use personal session/profile storage.

Automate account-independent UI/protocol checks first. If OAuth login/captcha or
account-owned video selection requires the owner, report a concrete ready action
after other runnable checks. Keep A3 open while prerequisites are absent. Real
provider evidence records preparation, bytes/progression, pause/seek, revoke and
availability results without tokens, cookies, file IDs, dlinks or HAR captures.
Android Baidu remains its existing unsupported-provider explanation; adding a
mobile provider is excluded. Ordinary media must still work on Android.

## Acceptance evidence

| Criterion | Primary observation | Coverage boundary |
| --- | --- | --- |
| A1 | Independent identities, authoritative admission/permissions/queue/chat, disconnect recovery | Actual backend/WS; no injected authority frames |
| A2 | Both players progress and agree on pause/seek, drift <=2s after settling; cues/danmaku visible | Real HTTP bytes; controlled source distinguished from upstream |
| A3 | Real adapter authorization, live account-owned media delivery and lifecycle outcomes | Missing login/config/file remains blocked; fixtures cannot substitute |
| A4 | Device screenshots plus final-state observations; actual keyboard/fullscreen interactions | PLR110 and recorded installed browser, not an emulator/Safari claim |
| A5 | Requirement matrix, reproducible commands, sanitized artifacts and owned-resource cleanup | No production readiness or untested browser claim |

Use explicit pass/fail/blocked/not-applicable states, with the applicable reason.
Record timings/drift and command boundaries so delayed UI/network behavior can be
reproduced. No HAR/full provider traces, auth forms, storage dumps or personal
device screens enter retained evidence. For controlled throwaway accounts,
redact passwords/cookies before retaining traces. Trim screenshots to task UI.

## Operational constraints and defects

Record container labels/IDs, remote process IDs, ports, temporary directories and
opened test tabs/profiles before teardown. Cleanup only owned resources; close
task-created tabs, remove dedicated profiles and task temp data, and preserve
browser settings, personal tabs, databases and pre-existing services. Use no
sudo, Magisk privilege or device reset unless an exact task step requires fresh
authorization. Never kill by port or generic process name.

On failure, reproduce through the real path and record observed versus expected
behavior. Test-harness corrections stay within the test task. Product fixes,
dependency/browser installation or persistent system changes require a concrete
scope decision; do not silently turn acceptance into an application refactor.
