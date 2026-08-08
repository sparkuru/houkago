# Chromium installed Baidu adaptor smoke and hardening

## Goal

Validate and harden the existing `houkago-adapter` Baidu path in real,
installed Chromium-family browsers. Chromium support may be declared only
after real-account playback proves that Manifest V3 service-worker,
Declarative Net Request, WebRequest, permission, and lifecycle behavior match
the already-passed Firefox reference contract.

## Background and confirmed facts

- The archived Baidu adaptor task delivered official OAuth, server-saved and
  user-held credentials, read-only file selection, token-free viewer grants,
  and direct viewer-to-Baidu media transfer.
- Installed Firefox has passed real-account server-saved sustained playback,
  user-held owner/guest playback, owner offline/reconnect, viewer eviction,
  same-room removal sync, and revoke/reauthorization isolation.
- Chromium already shares the provider runtime and has an MV3 implementation:
  DNR session rules rewrite the exact granted media requests, non-blocking
  WebRequest observes private-HEAD redirects, and `chrome.alarms` wakes the
  service worker every 30 seconds for pending user-held work.
- Unit/contract tests, manifest checks, exact-origin production builds, and the
  Chromium extension build pass. Those checks are not installed-browser
  evidence and therefore do not establish production support.
- The default development build intentionally accepts all HTTP/HTTPS page and
  server origins for trusted LAN testing. A deployment build must use exact
  configured origins and must remove those wildcards.
- Firefox remains the behavioral reference. A Chromium failure must not weaken
  the shared security boundary or regress Firefox.

## Requirements

### R1 — Installed-browser setup and diagnostics

- Build and load the Chromium MV3 extension as an unpacked extension using the
  documented trusted-development-profile flow.
- The Houkago page must detect the extension, complete pairing, and clearly
  distinguish missing permissions, stale extension reloads, pairing failures,
  and provider failures without logging secrets.
- Document the exact install/reload steps needed for a repeatable human smoke.

### R2 — Server-saved real playback

- With a server-saved Baidu connection, an admitted Chromium viewer must obtain
  a bounded playback grant and sustain playback beyond the opening segment.
- Media bytes must travel directly from the viewer to an approved Baidu host;
  Housou must not proxy the media body.
- Every granted media request, including later Range/seek requests, must use
  `User-Agent: pan.baidu.com`, remove the Houkago page Referer, preserve Range,
  and remain limited to the exact tab and exact dlink. Logical expiry must deny
  new installation/renewal; rule cleanup must run promptly while the worker is
  active and reconcile on its next browser wake after suspension. Already
  delivered dlinks/bytes are not claimed to be recallable.

### R3 — User-held owner and multi-viewer path

- An installed Chromium owner must keep its token only in extension-local
  storage, browse/select a real file, resolve the private dlink through the
  DNR/WebRequest path, and return only the bounded result to Housou.
- Both the owner and a separate admitted viewer must be able to play the
  selected source without receiving the owner's token.
- Service-worker suspension/restart and the 30-second alarm must not strand
  pending grants inside the server's 90-second deadline.

### R4 — Lifecycle and isolation

- Owner offline, account unlink/revoke, source removal, and viewer eviction
  must deny new grants or renewals under the same contract already proven on
  Firefox. Previously delivered bytes are not claimed to be recallable.
- Ordinary Houkago sources and unrelated non-Baidu requests must remain
  untouched by Chromium rules.
- Temporary private-HEAD rules/listeners and media grant rules must be removed
  after success, error, expiry, revoke, and extension/runtime cleanup. A
  suspended MV3 worker must enumerate and remove expired/orphaned rules on its
  next wake rather than trusting lost in-memory timers.
- Concurrent equal and distinct private URLs must not cross-wire request ids,
  redirect locations, grants, tabs, or users.

### R5 — Production support gate

- Google Chrome is the full installed reference gate. It must pass setup,
  server-saved playback, user-held owner/multi-viewer playback, worker
  suspension/recovery, lifecycle revocation, seek/Range, and non-interference.
- Microsoft Edge is the Chromium-family compatibility gate using the same
  built artifact. It must pass install/detection/pairing, server-saved sustained
  playback and seeking, user-held owner resolution/playback, and ordinary
  source non-interference. The full lifecycle matrix need not be duplicated
  unless an Edge-specific difference is found.
- Retain automated contract, manifest, build, exact-origin, secret-scan,
  typecheck, lint, unit/integration, and applicable Playwright coverage.
- Record safe real-browser evidence without storing OAuth tokens, dlinks,
  cookies, file ids, private paths, HAR credentials, or deployment secrets.
- Do not describe Chromium as production-supported until the chosen installed
  browser matrix passes all required real-account scenarios.

## Acceptance Criteria

- [x] Installed Google Chrome detects, pairs, and recovers after extension
      reload and service-worker suspension using documented steps.
- [x] In Google Chrome, a real server-saved source sustains playback and
      seeking; captured request
      metadata proves direct Baidu bytes, exact UA, Referer removal, and Range
      preservation without retaining sensitive values.
- [x] A real user-held Google Chrome owner resolves a source and enables
      successful
      playback for both owner and one separate admitted viewer; neither viewer
      receives the owner's OAuth token.
- [x] Service-worker suspension/restart does not leave a valid pending request
      permanently pending; alarm-driven work finishes or reaches a safe,
      explicit terminal state inside the server deadline.
- [x] Owner offline/reconnect, viewer eviction, source removal, and account
      revoke/reauthorization pass the new-grant lifecycle matrix.
- [x] Seek/repeated Range, grant expiry, cleanup, same-URL concurrency, and
      non-Baidu non-interference have automated regression coverage reflecting
      any installed-browser fixes, including cleanup reconciliation after a
      simulated worker restart.
- [x] Development and exact-origin production builds pass; the production
      manifest has no development wildcard and no permission broader than the
      documented adaptor boundary.
- [x] Microsoft Edge loads the same Chromium artifact and passes detection,
      pairing, server-saved sustained playback/seek, user-held owner
      resolution/playback, and ordinary-source non-interference. Any
      Edge-specific fix is followed by the Chrome regression gate.
- [x] The full repository quality gate passes and the validation record states
      exactly which installed Chromium-family browsers were proven.

## Out of scope

- Firefox feature expansion or re-running its already-passed full real-account
  matrix unless a shared-code change needs a regression check.
- Mobile browser support, a native/mobile companion, or background playback on
  mobile platforms.
- Baidu filename-based danmaku matching.
- Publishing to Chrome Web Store, Microsoft Edge Add-ons, or any other store;
  signing, review, rollout, and auto-update policy remain separate work.
- General-purpose request rewriting for providers other than Baidu.

## Technical constraints

- The token boundary remains unchanged: server-saved credentials are encrypted
  at Housou; user-held credentials remain extension-local; room participants
  receive neither token.
- The data-plane boundary remains unchanged: viewers fetch approved Baidu media
  directly, while Housou distributes only bounded capabilities and metadata.
- Chromium-specific fixes should stay behind the browser transport port when
  behavior differs from Firefox.

## Key decisions

- Google Chrome is the full reference implementation; Microsoft Edge is a
  required, smaller compatibility regression using the identical artifact.
- This remains one task rather than a parent/child tree: Edge does not own a
  separate deliverable and is intentionally downstream of the Chrome-hardened
  artifact. Any Edge-specific code change returns to the Chrome gate.
- No blocking product, compatibility, UX, or risk questions remain.
