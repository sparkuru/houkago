# Baidu Netdisk direct adaptor — implementation plan

## Delivery strategy

Deliver one integrated feature in reviewable checkpoints. Firefox is the
installed real-account reference path. Chromium's shared implementation,
automated transport contract, manifests, and builds are part of this delivery;
installed Chromium smoke/hardening and any production-support claim belong to
the next independent task.

## 1. Shared contracts and provider seams

- Extend `houkago-kousoku` with a Baidu provider union member, safe source
  metadata, adaptor message schemas, availability reasons, and playback-grant
  shapes. Prove every viewer-facing schema excludes OAuth/dlink material.
- Add provider helpers rather than scattering `provider.kind === "baidu"`
  branches across room/player components.
- Create the versioned `houkago-adapter` handshake and capability registry used
  by the page and client so future privileged capabilities can plug in without
  changing room logic or inheriting Baidu authority.

Validation checkpoint:

- Focused `kousoku` schema tests and frontend helper tests.
- Existing Bilibili/provider serialization tests remain unchanged.

## 2. Baidu REST client and credential foundation

- Add an injected-fetch Baidu client in `eisha`: authorization/token parsing,
  refresh, sanitized directory listing, file metadata, and dlink extraction.
- Add additive SQLite tables/queries for connections, sources, adaptor-session
  digests, and encrypted server token bundles.
- Add authenticated encryption, key/config validation, token redaction helpers,
  OAuth state TTL, one-use handoff state, pairing/revocation, and atomic refresh
  rotation in `housou`.
- Add OAuth start/callback/status/revoke and user-held exchange/refresh routes;
  preserve trusted-origin and Seitoshou ownership checks.

Validation checkpoint:

- Fixture-only OAuth/code/refresh/error tests; CSRF state mismatch/expiry;
  encryption round-trip/tamper/key-missing; cross-user isolation; no-secret
  response/log snapshots; additive DB bootstrap.

Rollback point: Baidu routes disabled by missing configuration; no room/player
code depends on them yet.

## 3. Firefox-first `houkago-adapter`

- Create `packages/houkago-adapter` with a shared capability registry, strict
  page-content/background message validation, adaptor pairing token storage,
  local Baidu token/permit storage, directory/dlink calls, and revoke cleanup.
- Negotiate protocol/client/capability versions and keep storage and host
  permissions capability-scoped; an unavailable capability must not disable
  the rest of Houkago or the adapter.
- Implement Firefox redirect + `onBeforeSendHeaders` UA rewrite, exact/session
  grant rules, Range preservation, redirect-host checks, and rule teardown.
- Produce a Firefox manifest/build and a controlled local test target that
  records UA, Range, redirect, and response behavior without real Baidu.

Validation checkpoint:

- Unit tests for message schemas, origin/nonces, permit enforcement, host
  policy, token non-export, grant expiry, and rule cleanup.
- Firefox `web-ext`/installed-extension smoke against controlled media proves
  exact UA, Range, direct client bytes, and ordinary-host non-interference.

Rollback point: extension remains an independently removable package; ordinary
Houkago behavior is untouched.

## 4. Server dlink coordinator and room lifecycle

- Persist a safe Baidu source when an authorized actor selects a file; reuse
  current playlist/admission gates and queue broadcast.
- Implement grant creation, targeted user-held `DLINK_REQUEST`, nonce/pending
  TTL, one-use response, adaptor authentication, dlink validation/redaction,
  and exact source/room/viewer ownership checks.
- Broadcast safe source availability; cancel pending grants on Enmoku removal,
  connector departure/revocation, viewer revocation, and room lifecycle events.
- Make `/baidu/media/:grant` a non-proxy sentinel for adaptor interception; it
  returns 428 when reached by an unadapted browser.

Validation checkpoint:

- Multi-user E2E for Alice/Bob isolation, saved vs user-held modes, owner
  online/offline, wrong room/source/nonces, member eviction, removal/revoke,
  no-token BANGUMI/WS/REST, and zero media-body proxying.

## 5. Connection and read-only directory UI

- Add a provider entry to the source composer and reusable connection status.
- Implement the three-step connection dialog and unified server/extension file
  port, then the native directory dialog with breadcrumb navigation, media
  filtering, selection, retry/reconnect, and safe cancellation.
- Add visible states for extension missing/version mismatch, mobile unsupported,
  user-held owner offline, OAuth expired, loading, empty, error, success, and
  revocation. All copy goes through i18n.
- Feed prepared grant URLs into the existing player owner without remounting or
  changing ordinary sync/source/fullscreen/subtitle behavior.

Validation checkpoint:

- Component/unit tests for state derivation and provider helpers.
- Playwright controlled fixtures cover keyboard dialogs, retention risk copy,
  missing extension, directory load/empty/error/select, owner offline, ordinary
  source unaffected, and desktop/mobile unavailable states.
- Human UI review: focus restoration, hierarchy, disabled explanations, and
  copy clarity in Firefox desktop.

## 6. Chromium transport adapter

- Reuse the extension core and add Chromium Manifest V3 + DNR session-rule
  implementation. Keep browser-specific API calls behind the transport seam.
- Verify exact redirects, UA, Range, rule expiry/removal, host scoping, and
  conflicts/error reporting under Chromium.

Validation checkpoint:

- Run the shared extension contract suite against Firefox and Chromium.
- Build both browser artifacts and validate Chromium MV3 permissions/DNR with
  controlled automation. A plain-page Fetch is not installed-browser evidence;
  installed Chromium smoke and hardening remain explicitly deferred.

## 7. Full integration and submit-ready gate

- Run formatting, lint, typecheck, all package tests, frontend build, extension
  builds, backend E2E, and focused Playwright/extension suites through project
  tooling.
- Inspect produced manifests for minimum permissions and scan output/source maps
  for fixture tokens, client secret values, or dlinks.
- Update project specs with the stable credential/provider/adaptor ownership
  contract and record browser validation evidence.
- Run a user-operated real Baidu Firefox smoke with deployment credentials:
  authorize both retention modes, list/select a file, verify UA/Range/direct
  traffic, owner departure behavior, revoke, and redacted logs. Record Chromium
  real-account status separately.

## Risk and rollback notes

- Do not enable server-saved mode without a valid encryption key.
- Never add a server media-proxy fallback; it violates the bandwidth contract.
- If real dlink hosts exceed the researched allowlist, pause and update the host
  policy from captured evidence rather than broadening to arbitrary HTTPS.
- If Firefox and Chromium semantics diverge, keep Firefox as the reference and
  report Chromium unavailable until its browser-specific adapter passes.
- Firefox real OAuth/dlink behavior is the submit-ready human gate for this
  task. Chromium fixture/build evidence must not be promoted into an installed
  production-support claim; that claim requires the independent follow-up.
