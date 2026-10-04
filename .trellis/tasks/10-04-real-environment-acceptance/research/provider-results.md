# Live Baidu acceptance — 2026-10-04

Status: **A3 real-provider playback and local-revoke lifecycle PASS** for one
video within the owner's explicitly authorized directory tree, on installed
original Chromium adapter. Successful fingerprint and native input in this A3
run are **not proven**. Firefox packaging is separate from installed Firefox
provider acceptance. A1's previously reported backend defect was withdrawn
after the owner's permission clarification; its corrected regression passed
and is reported separately in the desktop/check reports.

## Actual account and preparation

The owner completed ordinary-browser Baidu authorization and explicitly allowed
using their Houkago test account. A scratch process read the owner-only account
input in-process; real UI login succeeded, and real `/seitoshou/me` HTTP200
matched the intended account in-process. Actual `/baidu/status` HTTP200 returned
connected true, server-saved retention, reason null, and adaptorOnline true.
No token import, OAuth stub, credential dump or repeated OAuth was used.
The owner reported login completion; the OAuth exchange was not instrumented.
This run verifies resulting real
connection and provider access, rather than an automated OAuth exchange case.

One new task room was created through the existing authenticated real
`POST /bushitsu`, trusted frontend Origin and `{name}` body, returning HTTP200.
This setup is separate from room-creation UI coverage. The retained task URL is:
`http://192.168.9.4:15944/bushitsu/fb072a97-b1e9-473c-a776-ef8e1dad87ce`.
The actual backend websocket on port 3000 emitted NYUUSHITSU entered. Port15944
websocket traffic is Vite development HMR, not room authority.

The real BaiduPanel detected the installed original adapter, whose HELLO
reported Chromium, protocol1 and media-headers ready. Current-account pairing
returned HTTP200/state paired. Both the existing and fresh browser used Chrome
for Testing149.0.7827.55 with the original repo's built Chromium adapter.

## Selection, delivery and playback

Real BaiduPanel handlers issued five actual directory-list POSTs, each HTTP200.
Root/ancestor listing was required by the existing UI. The specified directory
was reached before inspecting descendants; two directories were visited within
that authorized scope, selecting exactly one supported video. No unrelated
subdirectory was explored, and no path, file name, fsid, dlink or source handle
is retained. Source creation through the real UI returned HTTP200 after backend
provider metadata validation; its only queue entry was selected through UI.

Actual Baidu media produced three HTTP206 responses. Sanitized Content-Range
values were `bytes 0-408453349/408453350`,
`bytes 408420352-408453349/408453350`, and
`bytes 32768-408453349/408453350`; latter requests carried
`bytes=408420352-` and `bytes=32768-` Range respectively. Advertised response
Content-Length values were408453350,32998,408420582. These are response headers,
**not measured downloaded totals**. Cross-origin resource timing exposed zero
encoded/decoded/transfer sizes. Actual decoder progression proves usable media
bytes arrived; no complete-file download amount is claimed.

Decoded metadata duration1419.97s, readyState4 and media error null were observed.
Play advanced1.770556→3.267858s over1.5s, a1.497302s increase. Pause held3.280877s
through a1s observation, drift0. UI range seek requested15s and reached15s.
A later read-only check confirmed currentTime15, readyState4, error null and
seeking false. Final recorded predicates explicitly require positive decoded
progress, pause drift≤0.1s and seek error≤2s with decoded readiness.

Bridge observation recorded an initial ADAPTER_ERROR followed by a successful
RESULT. Requests/nonces were not correlated, so the first error cannot be
assigned conclusively to fingerprint. This order is compatible with the
existing optional-fingerprint fallback, but **no successful fingerprint result
is claimed**. Actual header preparation and resulting media delivery passed;
no product fallback or provider behavior was altered by the test.

## Local revoke and final authority

The existing UI's revoke and confirm handlers issued actual
`DELETE /baidu/connection`, HTTP200. This revoked only the isolated Houkago
connection; no upstream Baidu app authorization, file or account was modified.

- Source availability returned HTTP200, playable false, reason connection-revoked.
- A newly requested playback grant returned HTTP409.
- A separately requested, unclaimed pre-revoke grant was HTTP200/state ready.
  After revoke, actual installed-adapter BAIDU_MEDIA_PREPARE on that grant
  returned false/ADAPTER_ERROR. This was not an already consumed grant probe.
- Installed extension DNR media rules changed4→0; private exchange rules were0
  before and after. Automatic adapter re-pairing may occur after UI cleanup;
  pairing readiness alone is not retained media access.

All final factual predicates passed, including required fresh-grant
refusal, existence and rejection of the old unclaimed grant, decoded play,
pause, seek and installed rule cleanup. The predicate strengthening used the
already recorded final observations and a read-only media state check; no
reauthorization, playback repetition or second revoke was performed for review.

## Input and evidence limits

Native CDP pointer/key input repeatedly failed to reach document capture
listeners, including after a fresh isolated profile. A bounded lifecycle/focus
check did not restore delivery. Real UI login and the first directory request
worked in the fresh profile, but subsequent native input was unreliable. This
is recorded as a test environment obstacle, not a product defect.

With main's explicit authorization, the remaining real semantic buttons were
activated with `HTMLElement.click()` on their DOM elements. The existing React
handlers, actual backend authority, provider requests, installed extension and
media decoder ran unchanged. UI range fill triggered its existing seek handler.
This verifies the live provider lifecycle through real UI handlers, **not native
mouse/keyboard usability in A3**. Earlier separate desktop/Android input tests
retain their own scope. No React state injection, route/response/WS mocks,
auth/file-list/video screenshots, trace, video or HAR were produced. Errors
were caught as safe stage/category only, with no locator logs or stacks.

## Reproduction and ownership

Commands actually executed (scratch script syntax checks also passed):

```sh
node /tmp/houkago-acceptance.nJ2AJ79D/launch-provider-fresh.cjs
node /tmp/houkago-acceptance.nJ2AJ79D/run-provider-acceptance.cjs
node --check /tmp/houkago-acceptance.nJ2AJ79D/run-provider-acceptance.cjs
```

The runner requires the existing isolated backend/frontend and owner-only
account/selection input files; it logs no input values. It intentionally does
not silently skip missing setup. **The connection is now revoked**; a repeat
positive run requires owner-authorized reconnection and is not performed by
these final checks. Final allowlisted numeric/status evidence is
`/tmp/houkago-acceptance.nJ2AJ79D/provider-acceptance-results.json` mode0600.
No private file handle is persisted for replay.

Task-owned resources were retained through final read-only review:
original browser session66345/CDP18944/profile `provider-browser`, and fresh
browser session20328/CDP18945/profile `provider-browser-fresh`, all under
`/tmp/houkago-acceptance.nJ2AJ79D`. Frontend15944/backend3000 are exact-label
provider-runtime preview containers; only the frontend was restarted earlier
for Vite public-file discovery. Main subsequently stopped the exact-label
provider preview and confirmed no matching running containers. Both private
profiles, credential-input directory, temporary provider `.env`, raw browser
log, OAuth redirect and extension distribution archives were removed.
Sanitized final observations are retained at
[live-lifecycle.json](evidence/provider/live-lifecycle.json), with audit logs
under the local task root. Account/setup/OAuth launcher scratch files were also
removed; the commands above describe executed history, not a retained login kit.

Earlier ordinary OAuth entry preparation validated official openapi.baidu.com
and the known backend callback, served a transient random redirect, and
verified actual official-origin navigation without an auth screenshot. The
owner declined the previous remote-inspector workflow; its popup/tunnel ended.
Temporary public redirect, Chromium zip and Firefox zip were removed at cleanup.
Firefox `build:firefox` passed and the three-file MV2 archive at root, minimum
Firefox128.0, was served with HTTP200 bytes exactly matching the96631-byte ZIP.
This establishes packaging/download integrity, not installed Firefox playback.
No new dependency, product source fix, persistent account change, commit or
archive was made in this provider branch.

## Browser teardown checkpoint

After final checker review, exact local CDP Browser.close succeeded on both
18944 and18945. Main confirmed original session66345 exited0; fresh session20328
also exited0. No generic kill or unrelated-browser close was used. Provider
preview teardown and private scratch disposal were completed by main.
All worker acceptance runner sessions completed;
no reauthorization or further provider mutation occurred during teardown.
