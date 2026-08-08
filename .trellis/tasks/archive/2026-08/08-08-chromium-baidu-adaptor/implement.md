# Chromium installed Baidu adaptor — implementation plan

## 1. Baseline and controlled installed harness

- Record the current Chrome/Edge manifest, permissions, DNR rule ownership,
  worker lifecycle, pending polling, and diagnostics behavior before changing
  code.
- Add the smallest repeatable installed-Chromium controlled target that loads
  `dist/chromium` in a headed persistent profile and exercises the real content
  script/service worker/DNR boundary rather than page fixtures alone.
- Capture only method, approved host classification, UA presence, Referer
  absence, Range, status, tab isolation, and cleanup outcome.

Checkpoint:

- Existing adapter tests and both browser builds stay green.
- The controlled test fails if the extension is absent, if requests bypass DNR,
  or if ordinary traffic is rewritten.

## 2. Service-worker-resilient DNR ownership

- Extend the Chromium API port with session-rule enumeration and trusted
  session storage.
- Replace in-memory-only grant authority with transactional session-registry +
  DNR installation, collision-safe rule ids, idempotent revoke, and orphan
  cleanup.
- Reconcile on worker initialization and alarm wake; use alarms for durable
  expiry/pending work and keep timers only as prompt best-effort cleanup.
- Preserve exact URL/tab/host/resource scoping, Range, UA, Referer removal, and
  the private-HEAD request-id binding.
- Add failure/cleanup tests for worker restart, orphan rules/rows, partial DNR
  install, quota/rejection, delayed alarms, concurrency, expiry, and revoke.

Rollback point: all changes stay behind the Chromium transport; Firefox/shared
provider behavior remains unchanged.

## 3. Diagnostics and documentation

- Improve existing page/adapter states only where installed evidence shows an
  ambiguous failure. Reuse current components, semantic tokens, i18n, focus,
  keyboard, and responsive behavior.
- Provide one recovery action for stale reload, origin/host permission,
  pairing, owner waiting/offline, DNR, and authorization failures. Never expose
  raw extension/API errors or sensitive identifiers.
- Document trusted-profile unpacked install, extension/page reload order,
  service-worker inspection/suspension, Chrome/Edge steps, and safe evidence
  collection.

Checkpoint:

- Focused component/Playwright tests cover every changed diagnostic branch,
  `aria-live`/alert behavior, loading feedback, recovery action, and ordinary
  source availability.

## 4. Google Chrome full installed gate

- Run controlled extension automation first, then the user-operated real-account
  matrix from `design.md`.
- Fix Chromium-specific findings without broadening permissions/hosts or moving
  tokens/media bytes into Housou.
- After each fix, rerun focused adapter tests, Chrome controlled automation,
  and affected Firefox/shared regressions.
- Record redacted validation evidence and remaining browser limitations.

This checkpoint is not complete until Chrome passes server-saved sustained
playback/seek, user-held owner + separate viewer playback, worker recovery,
lifecycle revocation, and non-interference.

## 5. Microsoft Edge compatibility gate

- Load the exact Chrome-hardened `dist/chromium` artifact in current Edge on
  Windows using a trusted test profile.
- Run install/detection/pairing, server-saved sustained playback/seek,
  user-held Edge-owner resolution/playback, and ordinary-source
  non-interference.
- For any Edge-specific change, rerun the Chrome reference gate before marking
  Edge complete. Do not create an Edge-only runtime fork without a separately
  approved requirement.

## 6. Full quality and production-support gate

- Run repository format, lint, typecheck, unit/integration tests, applicable
  Playwright, Kyoushitsu build, and Firefox/Chromium extension builds through
  project tooling.
- Build production Firefox/Chromium manifests with exact dummy HTTPS page and
  server origins; verify development wildcards are absent and permissions/hosts
  remain minimal.
- Scan generated artifacts and logs for source maps, tokens, dlinks, cookies,
  pairing material, deployment secret names/values, and unredacted fixtures.
- Run `git diff --check`, update stable specs if the MV3 lifecycle contract
  changes, and complete an independent full-scope Trellis check.
- Only after both installed gates pass, update support wording from
  Firefox-reference/Chromium-unproven to explicit Chrome + Edge support with
  the tested minimum/version evidence.

## Validation commands

Use the repository wrapper and final scripts discovered from package metadata;
the expected baseline includes:

```sh
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx bun run test
./dx bun run --filter houkago-kyoushitsu build
./dx sh -c 'cd packages/houkago-adapter && bun run build:firefox'
./dx sh -c 'cd packages/houkago-adapter && bun run build:chromium'
git diff --check
```

The implementation phase may refine the controlled-browser command after
inspecting the installed-test harness. A page-level mock is never sufficient
for the Chrome or Edge support claim.
