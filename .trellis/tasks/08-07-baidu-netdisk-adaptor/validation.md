# Validation evidence

## Archive gate — 2026-08-08

- Scope review found 65 pre-existing dirty paths and confirmed that every one
  belongs to this Baidu adaptor task. The reviewer added one further path,
  `EnmokuPlayer.vue`, to fix a full-suite HLS subtitle/source-switch race found
  by the archive gate; there are no unrelated or uncertain dirty paths.
- `./dx bun run format`: 199 files, clean after formatting.
- `./dx bun run lint`: 199 files clean.
- `./dx bun run typecheck`: all six workspaces passed.
- `./dx bun run test`: 281 passed, 0 failed, 1,301 assertions across 63
  files. The root runner uses `HOUSOU_DB=:memory:` so repeated repository-wide
  runs cannot inherit persistent test accounts; Playwright specs remain on
  their separate runner.
- Installed-Chrome Playwright full suite: 19 passed, 5 expected project skips,
  0 failed. The gate found and fixed two test/runtime races: parallel desktop
  and mobile projects now create collision-resistant accounts, and an HLS
  quality switch waits for `SUBTITLE_TRACKS_UPDATED` before restoring the
  selected subtitle. Stale instance/track errors can no longer turn a valid
  subtitle selection off.
- Kyoushitsu production build and both extension builds passed. Firefox and
  Chromium were also rebuilt with exact dummy HTTPS page/server origins; both
  generated manifests stripped the development wildcards, retained only the
  approved Baidu host permissions, and added only the exact server/page
  patterns in their respective permission/content-script fields.
- Generated extension/frontend artifacts contain no source maps, HAR files,
  deployment secret variable names, or known secret fixture literals. No real
  deployment secret value was read or used for this scan.
- `git diff --check`: passed.
- The current task is submit-ready against the installed Firefox real-account
  reference gate documented below. Installed production Chromium smoke and
  hardening is deliberately a separate follow-up task and is not claimed as a
  completed support gate here.

## User-held opaque redirect resolution — 2026-08-08

Safe HAR summary only: the owner connection, local permit, paired adaptor, and
user-held availability were healthy while viewer grants remained pending. The
extension's private manual-redirect `HEAD` received an opaque redirect response
(`status 0`, no readable headers), so the prior resolver could not read the
real redirect `Location`. No cookie, token, download capability, file id, path,
or request identifier from the HAR is recorded here.

- Firefox now registers request-scoped WebRequest observers before the private
  `HEAD`, keeps blocking UA injection on that exact request, and captures the
  real 3xx status/Location without allowing the browser to follow it.
- Chromium MV3 keeps DNR responsible for the exact raw-HEAD UA rule and uses
  non-blocking `webRequest` request/response observers to bind the exact
  URL/method/request id to the manual redirect. Its manifest adds only
  `webRequest` and `alarms`; production exact
  origins, wildcard stripping, and approved Baidu host permissions remain
  covered by build tests.
- Review found that the first Chromium observer matched only URL/method at the
  response stage, so an identical concurrent private URL could be cross-wired.
  Both ports now serialize identical raw URLs, Chromium captures the request id
  before accepting response headers, and foreign request ids are ignored.
- Both ports adapt an observed 3xx into the unchanged shared eisha parser,
  which still rejects unapproved hosts, credential-bearing targets, non-3xx,
  and missing Location. Observers and temporary DNR rules are removed in
  `finally`, including transport and rule-install failures.
- Adapter resolution failures now report only the fixed
  `upstream-resolution-failed` classification. Housou returns a secret-free
  terminal grant state; one failed item does not stop later pending items.
  Token refresh/control-plane transport failures remain pending and are not
  mislabeled as authorization revocation.
- Chromium uses a 30-second `chrome.alarms` poll wakeup instead of relying on a
  service-worker `setInterval`. User-held pending grants have a 90-second
  server deadline, and the viewer polls against that deadline while showing an
  explicit owner-device waiting message.

Validation:

- `./dx bun run format`: 199 files, no fixes required.
- `./dx bun run lint`: 199 files clean.
- `./dx bun run typecheck`: all six workspaces passed.
- `./dx bun test packages/eisha/test/baidu.test.ts`: 7 passed.
- Focused eisha, kousoku, adapter, housou, and kyoushitsu command: 166 passed,
  0 failed, 784 assertions. Adapter coverage alone is 25 passed.
- Firefox and Chromium extension builds: passed.
- `git diff --check`: passed.
- Redirect coverage includes status-0 opaque responses, real WebRequest 3xx
  capture, exact/foreign request ids, distinct- and same-URL concurrency,
  unsafe/token-bearing Location, non-3xx, missing Location,
  listener/fetch/rule cleanup, and unchanged Bun manual redirects.
- Playwright was not rerun for the waiting sentence: the changed behavior is
  covered directly by the grant-deadline unit, runtime terminal-state tests,
  and the reviewed `waiting-owner` UI state/i18n branch; no layout or interaction
  behavior changed in this fix.

## Reachable connection management and scoped revoke — 2026-08-08

- Reviewer formatting: `./dx bunx biome format --write` on the four changed
  Kyoushitsu/Housou test files; all are clean after one normalization pass.
- `./dx bun run lint`: 195 files clean.
- `./dx bun run --filter houkago-kyoushitsu typecheck`: passed.
- `./dx bun run --filter houkago-housou typecheck`: passed.
- `./dx bun test packages/kyoushitsu/test`: 124 passed, 0 failed.
- `./dx bun test packages/housou/test/baidu-foundation.test.ts packages/housou/test/baidu.e2e.test.ts`:
  4 passed, 0 failed (118 assertions). Coverage includes per-user OAuth state,
  handoff, pairing-code, adaptor-session, pending-request, and unclaimed-grant
  cleanup while another user's adaptor session remains valid. Test accounts use
  unique suffixes so the persistent-database E2E is safely rerunnable.
- `./dx bun run --filter houkago-kyoushitsu build`: passed; the existing dashjs
  CommonJS warning remains non-blocking.
- Focused Playwright command:
  `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --grep 'Baidu browser exposes read-only file states and selection|Baidu revoke confirms consequences, preserves failure state, and re-pairs after success|control policy presets converge for members and retain owner-only queue management|mobile keeps ordinary sources available while explaining desktop-only Baidu'`.
  It passed against the running local service with 6 passed and 2 expected
  desktop-project skips:
  - Baidu file browser to connection-manager handoff, exact 44px `管理连接`
    control, and a single open native dialog;
  - explicit revoke consequences, Escape/cancel focus return with zero DELETE,
    failed DELETE preserving connected state, successful DELETE returning to unselected
    retention choices, post-`BAIDU_REVOKE` re-pairing, and immediate progress to
    an enabled OAuth action;
  - a logged-in room member without playlist permission sees personal Baidu
    connection management, can open and keyboard-dismiss it with focus return,
    but has no link-add or Baidu file-selection controls;
  - the manager stays at least 44px tall and both manager and dialog stay inside
    their phone and iPad Mini viewports.

## Automated gate — 2026-08-07

- `./dx bun run format`: 194 files, no fixes required.
- `./dx bun run lint`: 194 files clean.
- `./dx bun run typecheck`: all six workspaces passed.
- `./dx bun test packages/kousoku/test packages/eisha/test packages/houkago-adapter/test packages/kyoushitsu/test packages/kokuban/test`:
  181 passed, 0 failed.
- Isolated `packages/housou/test`: 84 passed, 0 failed.
- `packages/kyoushitsu` production build: passed; existing dashjs CommonJS and
  large-chunk warnings remain non-blocking.
- Firefox and Chromium production extension builds passed with separate exact
  page/server origins. Generated manifests contained no loopback page or server
  permissions.
- `git diff --check`: passed.

Browser validation: Playwright passed

- command: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --grep 'Baidu|mobile keeps ordinary'`
- coverage: desktop retention choice, keyboard dialog close/focus restoration,
  read-only file states/selection, phone and iPad desktop-only messaging, and
  continued access to the ordinary source composer.
- fixtures: page-level adaptor HELLO/pairing and safe Baidu REST responses; no
  real OAuth token, dlink, or media request.
- result: 4 passed, 2 expected project skips.
- residual human review: real OAuth and installed extension behavior cannot be
  established by page fixtures.

## Submit-ready Firefox reference gate — passed

Partial Firefox real-account evidence — 2026-08-08:

- deployment configuration was detected after fixing repository-root `.env`
  loading for the Housou workspace;
- the user completed the Firefox connection flow and confirmed that their real
  Netdisk directories and selectable video files are visible;
- the first server-saved source selection reached `POST /baidu/sources` but
  failed before queue insertion because Houkago sent a quoted `fs_id`, used
  `dlink=0`, and parsed only the directory-list filename field. The client now
  follows the official numeric-int64 `fsids` / `dlink=1` filemetas shape,
  accepts the filemetas filename field, and preserves large numeric ids without
  JavaScript rounding; fixture and secret-redaction regressions pass. A real
  retry is pending;
- playback grant preparation, direct media bytes, UA/Range behavior, seeking,
  revocation, and user-held owner-disconnect behavior remain pending.

Second Firefox playback attempt — 2026-08-08:

- queue insertion and the server-saved playback-grant request succeeded;
- the HAR showed direct viewer requests to an approved `*.baidupcs.com` host,
  `User-Agent: pan.baidu.com`, and preserved Range, proving the adaptor and
  no-server-media-proxy boundary were active;
- Baidu returned 403 while the browser still sent the Houkago page Referer.
  AList's official driver uses the same private HEAD-to-final-Location flow but
  its non-browser download request has no page Referer;
- Firefox and Chromium now remove Referer only inside the exact active grant
  chain, keep UA/Range behavior, and leave private raw-dlink HEAD and ordinary
  requests unchanged. Adapter tests, typecheck, lint, and both builds pass; a
  reloaded-extension real playback retry remains pending.

Third Firefox segmented-playback attempt — 2026-08-08:

- the same final dlink produced `206` with grant headers, then a later Range
  request with a new Firefox request id produced `403` with ordinary UA and the
  page Referer, followed by another corrected `206` retry;
- Firefox grant continuity now admits a new request id only for the exact
  unexpired dlink and exact tab, seeds it into redirect-chain tracking, and
  keeps headers active across completed Range requests. Wrong tab, any URL or
  query difference, ordinary requests, expiry, removal, and unsafe redirects
  fail closed;
- focused adapter tests, lint, typecheck, Firefox build, and diff check pass. A
  reloaded-extension sustained-playback retry remains pending.

Firefox sustained-playback retry — 2026-08-08:

- after reloading the extension, the user confirmed successful sustained
  server-saved playback beyond the opening segment;
- a second Windows device could load the default extension but could not detect
  it on the Houkago page because the original default development manifest and
  runtime fallback were loopback-only;
- by explicit development-environment decision, an unconfigured development
  build now accepts all HTTP/HTTPS page and server origins so LAN IP and
  hostname testing work without per-device origin builds. The README marks this
  as a trusted-development-profile capability that must not be distributed;
- configured deployment builds still require exact page/server origins, remove
  every development wildcard from both browser manifests, and enforce those
  origins at runtime. HTTPS remains required except for explicit loopback
  origins;
- Firefox and Chromium manifest/runtime/build regressions, typecheck, lint, and
  both extension builds pass. Cross-device Windows Firefox verification after
  reloading the rebuilt development extension remains pending.

Firefox user-held multi-viewer playback retry — 2026-08-08:

- the user used the reachable connection-management flow to remove the
  server-saved connection, authorized the same approved application in
  user-held mode, selected a real Netdisk video, and kept the owner adaptor
  online;
- after reloading the opaque-redirect fix, the user confirmed successful human
  playback for both the local owner (`wkyuu`) and a Windows guest. The prior
  permanent-pending symptom disappeared, proving that the owner adaptor can
  consume the targeted request, resolve the selected-file dlink from its local
  credential/permit, return the bounded result to Housou, and let separate
  admitted viewers complete the normal adaptor playback path;
- this is installed-Firefox, real-account, real-file evidence for user-held
  authorization and multi-viewer playback. It does not by itself prove
  non-Baidu request non-interference or the installed-Chromium transport gate;
  those residual checks remain pending.

Firefox user-held owner-offline gate — 2026-08-08:

- the user confirmed the recommended real-device owner-offline scenario:
  making the owner adaptor/room presence unavailable prevented the Windows
  guest from obtaining a new playback authorization, while restoring the owner
  connection made the source playable again;
- this passes the core user-held online-dependency gate. It does not claim that
  bytes from a dlink already delivered before disconnect can be recalled; the
  enforced boundary is denial of new grants and renewals after owner departure.

Firefox user-held viewer-eviction gate — 2026-08-08:

- the user confirmed that removing the Windows guest's room membership caused
  the guest to leave the room and prevented it from obtaining a new Baidu
  playback authorization;
- this passes the real-device viewer-admission revocation gate. As with owner
  disconnect, it does not claim recall of bytes already delivered before the
  eviction; pending and future grants are the enforced boundary.

Firefox source-removal and room-sync gate — 2026-08-08:

- the user confirmed that the currently playing queue item must first be
  stopped before deletion, matching the existing queue mutation policy;
- deleting a different, non-playing Baidu item was immediately reflected in
  every host/guest client page connected to the same `bushitsuId`. The user
  clarified that no separate room was affected, so this passes the same-room
  queue broadcast and source-removal UI gate rather than indicating cross-room
  state leakage;
- backend regression coverage remains the evidence that deleting the Enmoku
  also removes its Baidu source record and cancels pending/future grants. A
  dlink already delivered before deletion is not claimed to be recallable.

Firefox user-held revoke and reauthorization gate — 2026-08-08:

- the user followed the full real-device sequence and confirmed that revoking
  the user-held connection made its existing Baidu source unavailable to both
  owner and guest;
- authorizing user-held mode again did not reactivate that old source. A new
  explicit file selection and queue addition was required before playback was
  available again;
- this passes the authorization-id isolation and least-possession gate: a new
  token bundle cannot silently inherit an old source permit, pending request,
  or playback authority.

Current-task conclusion:

- installed Firefox real-account evidence covers server-saved sustained
  playback; user-held owner and Windows guest playback; owner
  offline/reconnect; viewer eviction; same-room source-removal sync; and
  user-held revoke/reauthorization with old-source isolation;
- automated tests remain the evidence for secret non-export, ordinary-request
  non-interference, one-use/expiry behavior, cross-user isolation, and backend
  source/grant cleanup that cannot be inferred from the human observations;
- Chromium has a complete shared implementation, MV3 permission/manifest
  checks, focused resolver/DNR tests, typecheck, and builds. No installed
  Chromium or Chromium production-support claim is made here. Its real smoke
  and browser-specific hardening are the sole remaining gate and have moved to
  the next independent task.

The follow-up installed-Chromium task should use an approved Baidu application
and a non-sensitive test account/file, then record:

- authorize and revoke both `server-saved` and `user-held` modes;
- list folders and add one supported video;
- verify the private raw-dlink HEAD uses `User-Agent: pan.baidu.com` and the
  distributed final URL contains no OAuth credential;
- verify viewer media bytes and Range/seek travel directly to Baidu, never
  through `housou`;
- verify non-Baidu requests do not receive the Baidu UA;
- verify user-held owner departure/device disconnect disables new playback;
- verify removed sources, evicted viewers, reauthorization, and revoke cannot
  obtain or renew a grant;
- confirm actual redirect hosts remain within the researched allowlist. If not,
  stop and update the policy from captured evidence rather than broadening it
  speculatively.
