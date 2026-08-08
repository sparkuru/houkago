# Validation evidence

## Automated implementation and independent review gate — 2026-08-08

Implemented and independently reviewed Chromium MV3 lifecycle hardening:

- strict versioned `chrome.storage.session` media-grant registry;
- collision-safe, disjoint media/private DNR rule ownership;
- serialized transactional installation and partial-failure rollback;
- startup/alarm reconciliation of expired, malformed, duplicate, altered,
  missing, and orphaned rules/rows;
- worker-restart-safe recovery and idempotent revoke;
- exact case-sensitive private-HEAD rule matching and request-id observation;
- logical expiry recheck after a queued install acquires transaction ownership;
- Chromium 120 minimum and a trusted-profile Chrome/Edge runbook.

The independent reviewer found and fixed:

1. Private-HEAD DNR used case-insensitive `urlFilter`; it now uses the shared
   escaped anchored `regexFilter` with `isUrlFilterCaseSensitive: true`.
2. Parallel replacement/revoke cleanup could erase registry recovery state
   while DNR removal failed; cleanup is now ordered DNR-first, registry-second.
3. A serialized install could expire while waiting for its lock; expiry is
   rechecked after ownership acquisition.
4. Valid empty registries are normalized by removing the session key.

Final automated results after all fixes:

- `./dx bun run lint`: passed.
- `./dx bun run typecheck`: all packages passed.
- `./dx bun run test`: 295 passed, 0 failed.
- Focused Chromium/dlink/security/polling suite: 33 passed, 0 failed.
- Kyoushitsu production build: passed; only the existing dash.js CommonJS/ESM
  warning remains.
- Firefox and Chromium development builds: passed.
- Firefox and Chromium exact-origin production builds: passed. Generated
  production manifests contain no development wildcard; the Chromium manifest
  declares minimum version 120 and retains the existing permission/host set.
- Generated adapter artifact scan: no source maps, HAR files, or known fixture
  secret values.
- `git diff --check`: passed.

## Controlled installed-Chromium gate — passed

Browser validation: Playwright passed.

- command:
  `node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.chromium-adapter.config.ts`
- browser: Chrome for Testing 149, headless, Chromium engine >= 120.
- fixture: real unpacked `dist/chromium` extension, temporary persistent
  profile, self-signed loopback media endpoint for the approved
  `d.pcs.baidu.com` hostname, loopback control server, and a restricted HTTPS
  CONNECT proxy. No real Baidu credential, API, media file, or external network
  dependency is used.
- coverage: exact `chrome-extension://<id>/background.js` service worker,
  content-script HELLO, pairing, transactional session DNR installation,
  approved-host redirect, server-observed `User-Agent: pan.baidu.com`, Referer
  absence, `Range: bytes=0-3`, 206 direct response, exact-tab isolation, revoke
  cleanup, and ordinary-request non-interference.
- result: 1 passed in 1.2 seconds during the final reviewer gate.
- isolation: the installed target uses its own Playwright config. The ordinary
  config still lists exactly 24 tests and excludes this harness.
- cleanup: browser context, child browser processes, open sockets, proxy/control/
  media servers, temporary certificate/key, and profile directory are removed
  on success and failure. Final review found no surviving harness directory or
  Chromium process.

This browser gate found and fixed a real MV3-only defect: the Chromium grant
port stored native `setTimeout` directly and invoked it through an object
receiver, which throws an illegal `WorkerGlobalScope` receiver error after DNR
and registry success. The timer is now called through an arrow wrapper.

Branded Google Chrome 150 starts under the same automation command but rejects
command-line unpacked extension loading and exposes no extension service
worker. That failed prerequisite is recorded rather than treated as passing;
manual loading from `chrome://extensions` remains the Google Chrome gate.

Final full-scope reviewer results after the installed-harness fix:

- Biome lint: 203 files passed.
- Typecheck: all six workspaces passed.
- Unit/integration: 295 passed, 0 failed across 64 files.
- Controlled installed Chromium: 1 passed, 0 failed.
- Kyoushitsu build and Firefox/Chromium dev + exact-origin production builds:
  passed.
- Production manifest, source-map/HAR/fixture-secret artifact scan and
  `git diff --check`: passed.
- No user-visible Kyoushitsu component or diagnostic branch changed, so no
  visual/responsive acceptance criterion was introduced.

## Installed Google Chrome full-reference gate — passed

Required redacted evidence:

- unpacked install, detection, pairing, extension/page reload recovery;
- server-saved sustained playback and seek;
- user-held Chrome owner resolution plus owner and one admitted viewer
  playback;
- worker suspension/restart during pending work and an active grant;
- owner offline/reconnect, viewer eviction, source removal, revoke and
  reauthorization isolation;
- exact provider UA, Referer absence, Range preservation, direct approved-host
  bytes, exact-tab isolation, and ordinary-source non-interference.

Partial human evidence — 2026-08-08:

- The user manually loaded the freshly built unpacked `dist/chromium` artifact
  in Google Chrome through `chrome://extensions` and hard-reloaded Houkago.
- Houkago successfully detected `houkago-adapter`, passing the branded-Chrome
  manual install, content-script injection, and page HELLO readiness step.
- Pairing, real-account media preparation/playback, seek, worker suspension,
  lifecycle, and non-interference remain pending.

User-held Chrome-owner multi-viewer and lifecycle gate — passed 2026-08-08:

- On Windows, `wkyuu` manually loaded the Chromium extension in Google Chrome,
  authorized Baidu in user-held mode, selected a real Netdisk video, added it
  to the room, and played it successfully.
- A separate `guest` on Windows Firefox loaded the adaptor, joined the same
  room, and successfully watched the playback synchronized from `wkyuu`.
- With both owner and guest present, the source played. With the user-held owner
  absent and the guest still present, the guest could not play the source,
  passing the new-grant owner-online dependency.
- Removing the guest from the room immediately forced the guest to leave,
  passing viewer-admission revocation.
- After `wkyuu` revoked the Baidu authorization, refreshing the page could not
  continue playback, passing local/server authority cleanup for new playback.
- After authorizing again, the source created under the previous authorization
  remained unplayable, while a newly selected source played successfully. This
  passes authorization-generation isolation and proves stale permits/sources do
  not regain authority after reauthorization.
- Source removal relies on the inherited installed-Firefox same-room deletion
  evidence in the archived Baidu adaptor task plus backend regression coverage:
  the shared queue UI immediately removed a non-playing Baidu item for every
  same-room client, and deleting its Enmoku removes the Baidu source record and
  cancels pending and future grants. This UI/server path has no Chromium-specific
  branch, so it satisfies the shared source-removal contract without claiming a
  separate Chrome deletion click. Already-delivered bytes remain outside the
  revocation claim.
- This establishes real-account Chromium user-held owner resolution, Chrome
  viewer DNR preparation/playback, cross-browser multi-viewer operation, owner
  offline denial, viewer eviction, revoke, and reauthorization isolation. It
  does not by itself establish server-saved Chrome playback or the Edge
  compatibility gate.

Chrome worker-idle recovery and seek gate — passed 2026-08-08:

- The user stopped playback, closed the extension service-worker inspector,
  left the Chrome room page idle for at least 45 seconds without Baidu actions,
  then requested playback of the newly authorized user-held source.
- The adaptor recovered and playback resumed in approximately 5–10 seconds,
  well inside the server's 90-second pending deadline.
- Seeking to the middle of the real video continued playback successfully,
  passing the installed Chrome repeated Range/seek continuity gate after worker
  wake.
- Together with the controlled installed-Chromium request evidence, this passes
  the Chrome worker-idle wake, pending recovery, UA/Referer/Range, and seek
  behavior. It does not claim the browser necessarily destroyed the worker at
  a precisely observed instant; no inspector was attached to keep it alive.

Chrome server-saved playback diagnosis after cache mitigation — pending
2026-08-08:

- The user successfully revoked user-held mode, authorized the connection with
  server-side encrypted retention, browsed a real Netdisk directory, and added
  a newly selected video. Playback then failed in branded Google Chrome.
- Safe HAR aggregation showed the grant create request succeeded. The first
  approved-host network GET returned 206 with Range present, provider UA set,
  and Referer absent. Five later entries for the same approved target were
  served from Chrome disk cache with zero transferred bytes, no Range/provider
  UA, and Referer present. The provider response advertised a three-day cache
  lifetime. No public Houkago/Baidu error or host drift was present.
- This evidence isolates the failure to cached partial-response reuse bypassing
  network-stage DNR request-header mutation, rather than OAuth, dlink creation,
  grant expiry, tab binding, host policy, or provider rejection.
- The first mitigation replaced response `Cache-Control` with `no-store` only
  on the existing exact case-sensitive dlink + exact tab + media/XHR grant
  rule. The user's updated HAR confirmed that build was loaded and the effective
  response showed `no-store`, but five later 206 entries still came from disk
  cache with zero transfer. Chrome processes response cache directives before
  the late response-header DNR edit, so response-only `no-store` did not close
  the observed path.
- The exact same rule now additionally sets request `Cache-Control: no-cache`.
  This is the active cache-bypass mechanism; response `no-store` remains
  defense-in-depth/client-visible policy. UA, Referer removal, and Range are
  unchanged, and sentinel, other tabs, URLs, hosts, resource types, and ordinary
  requests are not widened.
- The strengthened installed Chrome for Testing harness first populates a
  cacheable exact-target response and proves a second unadapted request is
  served without another server hit. After grant installation, the same target
  is forced back to the provider with request `no-cache`, provider UA, Referer
  absent, and Range preserved; a repeated granted request again reaches the
  provider. Exact-tab isolation and zero rules after revoke still pass.
- Post-fix gates: focused Chromium/security 24 passed; full repository 295
  passed; installed extension 1 passed; lint, all six workspace typechecks,
  Firefox/Chromium dev and exact-origin production builds, manifest/artifact
  scan, and `git diff --check` all passed.
- The user's next branded-Chrome HAR confirms the request-side build is loaded:
  every approved-host request carries request `Cache-Control: no-cache`, the
  provider UA, no Referer, and the original Range. All six requests reached the
  network; none came from disk cache, memory cache, or a service worker. The
  cache-bypass defect is therefore closed.
- All six provider responses are canonical 206 responses with an explicit MP4
  video MIME, `Accept-Ranges: bytes`, no content encoding, and consistent
  Content-Length/Content-Range values. The requested start/end and declared
  response span are internally valid.
- Playback still fails after transport succeeds. Chrome transfers body bytes
  for the first correct 206 response, then aborts it and retries the identical
  range roughly once per second. Five following responses are cancelled by the
  client after headers. Houkago creates one player/grant and does not contain a
  matching one-second remount/regrant loop, so the residual failure is now in
  the browser/player media-load path rather than OAuth, dlink resolution, DNR
  policy, cache reuse, or Baidu HTTP range validation.
- The next evidence gate is a same-file comparison against the already-passed
  user-held path plus secret-free HTMLMediaElement/Chrome Media pipeline error
  state. No further transport-rule change is justified by the current HAR.
- The user then compared multiple sources across server-saved mode, user-held
  mode, and AList with the required UA. Each path produced the same per-file
  split: some files played and some did not, while the Baidu desktop client
  could play the failing files. This rules against retention mode as the
  differentiator and makes native browser media compatibility the leading
  explanation; native-client playback is not equivalent to HTMLMediaElement
  demux/codec support.
- Safe comparison of two temporary HAR captures found one MP4 source
  that advanced from its initial Range to a later byte offset and sustained
  delivery, one MP4 source that repeatedly restarted the same initial Range,
  and two RMVB sources with the same restart pattern. The second HAR repeats
  one RMVB failure independently. All compared requests still reached the
  network with the correct provider UA, no Referer, request `no-cache`, and
  Range; all responses had internally consistent 206 and byte-range headers.
- Baidu `category=1` currently makes a provider video selectable even when its
  container/codec is not natively playable by the browser. The remaining MP4
  subtype requires Media pipeline or codec metadata for exact classification,
  but it no longer blocks proof that both retention modes can deliver a
  browser-compatible source through the same adapter transport.
- Branded Google Chrome played a browser-compatible real server-saved source
  after rebuilding and reloading the request-side cache fix. The user confirmed
  sustained playback and seeking both pass for that source, completing the
  Chrome server-saved gate. No raw HAR or sensitive value is stored in the
  repository.
- The user repeated the playable/non-playable source comparison in installed
  Firefox and obtained the same per-file result as Chrome. This cross-engine
  evidence further separates native container/codec compatibility from the
  Chromium DNR implementation and credential-retention mode.

## Installed Microsoft Edge compatibility gate — passed

Using the exact Chrome-hardened `dist/chromium` artifact:

- install, detection, and pairing;
- server-saved sustained playback and seek;
- user-held Edge-owner resolution and playback;
- ordinary-source non-interference.

Any Edge-specific code/manifest change returns to the Chrome regression gate.
Chromium production support requires both installed gates to pass.

Partial human evidence — 2026-08-08:

- Microsoft Edge 151 loaded the exact Chrome-hardened `dist/chromium` artifact.
- Server-saved mode passed connection, directory listing, source insertion,
  sustained playback, seeking, and the requested Edge checks using a known
  browser-compatible source. The same source-specific files that fail in
  Chrome/Firefox also fail in Edge, preserving the established native media
  compatibility boundary rather than revealing an Edge transport regression.
- User-held mode completes the page-visible authorization state but directory
  listing reports the generic directory-read failure. The page HAR shows
  `/baidu/status` and adaptor pairing at 200 plus successful CORS/preflight and
  availability calls, with no `/baidu/files/list`; that absence is expected for
  the extension-local user-held path and means the remaining failure must be
  diagnosed in the Edge extension Service Worker/OAuth handoff/Baidu listing
  path. No backend error was logged.
- A secret-free page message probe captured the exact Edge failure as
  `ADAPTER_ERROR: Baidu connection required` on `BAIDU_LIST`. This proves the
  freshly authorized server-side user-held connection exists while the Edge
  extension has no persisted refresh token/session token. The remaining defect
  is therefore before the Baidu directory API, Edge host permissions, and DNR
  playback rules.
- The user observed that Baidu redirected the Edge OAuth popup to the configured
  loopback callback and had to replace that host manually with the LAN Housou
  host. The active ignored `.env` indeed configures the callback with
  `localhost`. Because `redirect_uri` is generated server-side and is identical
  for every browser, the reported Chrome/Firefox versus Edge difference still
  requires an environment/profile comparison; it cannot be implemented as an
  Edge-specific OAuth flow. A LAN deployment must ultimately register and use
  a callback origin reachable from its viewer devices.
- Windows inspection identified the loopback behavior as a VSCodium-owned local
  port forward, explaining why the remote Housou service was reachable at
  `localhost:3000` in every local browser. The user registered the exact LAN
  callback in Baidu Open Platform, Housou was restarted with the matching
  ignored deployment setting, and the callback then completed without manual
  URL editing.
- After the callback correction and bounded popup/handoff timing hardening,
  installed Edge user-held mode completed authorization, extension-local token
  handoff, directory listing, source insertion, and playback. Together with the
  already-passed server-saved sustained playback/seek and ordinary-source checks,
  the required Edge compatibility gate now passes using the same Chromium
  artifact and shared page runtime.

## Final Phase 2.2 full-scope gate — passed 2026-08-08

- `./dx bun run format`: 205 files checked; no changes required.
- `./dx bun run lint`: 205 files passed.
- `./dx bun run typecheck`: all six workspaces passed.
- `./dx bun run test`: 302 passed, 0 failed across 65 files.
- `./dx bun run --filter houkago-kyoushitsu build`: passed; the existing
  third-party dash.js CommonJS/ESM warning remains non-fatal.
- Firefox and Chromium development builds passed.
- Firefox and Chromium exact-origin production builds passed with
  `https://watch.houkago.example` as the page origin and
  `https://api.houkago.example` as the server origin. Generated manifests
  contain only the exact configured deployment origins plus the documented
  Baidu hosts; no development wildcard is present.
- The installed Chromium Playwright target passed 1 of 1 with the real unpacked
  extension, content script, service worker, DNR rules, cache-bypass behavior,
  Range handling, isolation, cleanup, and ordinary-request non-interference.
- Generated adapter artifacts contain no source maps, HAR files, known fixture
  secret values, deployment secret names, OAuth callback values, or development
  wildcards. No raw OAuth code/state/token, dlink, cookie, file identifier,
  private file path, or extension-storage dump is retained in task evidence.
- The repository `.env` remains ignored and untracked; its contents were not
  printed or copied into validation evidence.
- `git diff --check`: passed.
- Manual evidence review distinguishes the synthetic controlled harness from
  user-operated real-account Google Chrome 150 and Microsoft Edge 151 evidence;
  it makes no container, store-publication, or untested-version claim.
- Residual media failures are source/container/codec-dependent and reproduce in
  Chrome, Edge, and Firefox. Browser-compatible sources pass both retention
  modes, so this is recorded as a native HTMLMediaElement compatibility boundary
  rather than a Chromium adaptor transport failure.
