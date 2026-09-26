# M3 independent check report

Checked 2026-09-26 against the approved PRD/design/implementation plan, curated
check manifest, current frontend specs and the actual runtime/browser paths.
The checker initially reviewed read-only while implementation owned the write
and command lanes. All reviewer fixes and checks below ran after explicit lane
handoff. No staging, commit, archive, deployment or M4 work occurred.

## Findings (fixed)

- Files: `src/app/context.tsx`, `src/app/runtime.ts`, `src/app/query-client.ts`,
  `src/routes/home.tsx` under `packages/kyoushitsu-react`.
  Issue: disabled `useQuery` observers still owned fetch lifecycle. StrictMode
  unsubscribe canceled the root's signal-consuming identity restore; browser
  home became a restore error before its delayed fixture could settle. Observer
  options also removed the query function and emitted Query console errors.
  A fixture-only `QueryObserver` subscribe/unsubscribe reproduction produced
  runtime phase `error` with query status `pending` without network involvement.
  Fix: UI reads stable QueryCache snapshots through `useSyncExternalStore` and
  `subscribeQueries`; root `fetchQuery` remains the sole HTTP owner. Retain the
  current identity/config for runtime lifetime with infinite GC, then explicitly
  purge private keys on fencing and all keys on disposal. Regression covers
  subscription replay, one read of each resource, live signal, zero observers,
  retention and explicit cleanup. StrictMode remains enabled.
- Files: `src/app/runtime.ts`, `src/features/entry/entry-panel.tsx`,
  `test/runtime.test.ts`.
  Issue: a create completion cleared its command and notified synchronous
  subscribers after its last epoch check, allowing disposal/logout before the
  ID reached navigation. A route could also unmount the consuming feature.
  Fix: recheck active epoch after clearing pending state; consumption verifies
  mounted/current epoch/ready/no command/current identity immediately before
  navigation. Two regressions cover completion-subscriber disposal and logout.
- Files: `src/routes/home.tsx`, `src/app/runtime.ts`, `test/runtime.test.ts`,
  `e2e/entry.spec.ts`.
  Issue: an epoch key remounted the anonymous form into sign-in during
  registration; clearing the auth lock for reconciliation could unmount it again.
  Fix: retain the form and its local mode while authentication is pending;
  private restoration retains command ownership until reconciliation completes.
  Password/reveal state still clears at submission and mode changes, and actual
  identity transitions unmount the form. Unit/browser regressions cover delayed
  reconciliation, pending registration, typed failure, focus and explicit retry.
- Files: `src/main.tsx`, `e2e/entry.spec.ts`.
  Issue: persisted page restoration could reuse a disposed runtime whose cache
  was cleared and bootstrap promise already consumed.
  Fix: persisted `pageshow` reloads the document and restores the current cookie
  with a new runtime. Browser test changes the identity fixture between synthetic
  persisted lifecycle events and verifies one new restoration. This proves the
  lifecycle handler, not actual browser Back/Forward Cache eligibility.
- Files: `src/app/router.tsx`, `src/routes/home.tsx`, `e2e/entry.spec.ts`.
  Issue: Router parses `revoked=1` as numeric 1, while validation accepted only
  string 1 and Home independently read raw search text; the revoked notice vanished.
  Fix: accept numeric/string 1, preserve canonical numeric 1, and consume typed
  route search through the registered Router. Desktop/phone notice checks pass.
- Files: `src/styles/index.css`, `src/components/ui/card.tsx`,
  `src/components/ui/button.tsx`, `src/features/entry/entry-panel.tsx`,
  `e2e/entry.spec.ts`.
  Issue: shared CSS alone did not generate `border-border`, so card borders used
  currentColor; password toggle labels shrank and wrapped vertically; empty join
  remained enabled unlike Vue.
  Fix: explicit `outline` token maps the shared semantic border and controls use
  `border-outline`; native buttons have shrink/nonwrapping protection; empty join
  disables until trimmed room input exists. Computed-color, control-height,
  no-overflow and empty/valid invite assertions pass. Shared Vue CSS is untouched.
- Files: `test/runtime.test.ts`, `e2e/entry.spec.ts`, `e2e/real-cookie.spec.ts`.
  Issue: route preload, create pending/failure/retry and accurate forbidden-socket
  evidence were missing; counting every socket would include Vite HMR.
  Fix: invoke the actual lazy Router preload with memory history and prove no
  navigation/read; add create/registration browser failures and explicit retries;
  detect protected backend HTTP/WS activity while permitting Vite HMR. Real-cookie
  fixture uses a unique username and exact server `NYUUSHITSU entered` admission,
  replacing loose substring matching. Identity remains entirely unmocked there.

## Findings (not fixed)

No remaining concrete code/spec issue was found in the reviewed M3 scope.
Residual Warm Club visual preference and identity/handoff UX judgment remain
the main session's scoped human-review gate. No real-device or assistive-technology
certification is claimed. Parent/task completion is intentionally not decided by
this report.

## Verification

Commands run by this checker, with Docker and host-browser lanes serialized:

| Check | Result |
| --- | --- |
| `./dx bun run typecheck` | Seven package checks passed; later React edits also strictly compiled in each final React build |
| `./dx bun run lint` | Final pass, 293 files |
| `./dx bun run test` | 465 passed, zero failed, 2,145 assertions across 85 files; full log `/tmp/houkago-m3-check-tests.log` |
| Focused React tests | 31 included in final aggregate pass; subscription replay, retention, actual preload and new command races covered |
| `./dx bun run --filter houkago-kyoushitsu-react build` | Final pass, 444 transformed modules; separate 0.54 kB lazy handoff chunk |
| Actual emitted React graph | 443 IDs, zero Vue/.vue/Pinia/Eden/Housou server/media-engine modules; build guard active |
| `git diff --check` | Pass |
| React desktop/375px mock matrix | 24 passed, 7.2 seconds |
| Real-cookie project | One passed, 2.1 seconds; register → refresh `/me` → Vue room/server admission/same ID → React → sign-out → `/me` 401 |
| Final empty-join correction | Four focused join/configured-name desktop/phone cases passed, 2.2 seconds; final lint/strict build also passed |

Exact passing browser commands:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=entry-desktop --project=entry-phone --output=/tmp/houkago-m3-react-entry-submit
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=real-cookie --output=/tmp/houkago-m3-real-cookie-submit
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=entry-desktop --project=entry-phone --grep 'join invite|configured name/title' --output=/tmp/houkago-m3-react-join-final
```

Diagnostics: corrected signed-out screenshots are under
`/tmp/houkago-m3-react-entry-submit`; latest signed-in screenshots are under
`/tmp/houkago-m3-react-join-final`. The checker inspected the final phone
signed-out image: password toggle reads horizontally at the normal field height.
Automated measurements cover semantic border color, controls ≥44px, keyboard
focus, reduced-motion timing, primary contrast ≥4.5, portrait/landscape reflow and
no horizontal overflow. Screenshots are diagnostic, not baseline updates.

Initial StrictMode failure artifacts remain in
`/tmp/houkago-m3-react-entry-check` (eight failures, two interrupted, 14 not run).
The intermediate revoked-notice failure traces remain in
`/tmp/houkago-m3-react-entry-final` (22 pass, two fail). They are not presented as
passing gates. Later full and focused runs resolve those concrete failures.

Main/implementer-owned evidence, separately supplied to this review:
contract drift passed with 59 operations, 46 browser operations and 18 byte-stable
generated files; Vue build passed; old Vue entry passed 12 cases; final applicable
old room matrix passed 19 cases with eight deliberate viewport skips. Final
service teardown belongs to the main session and remains to be recorded there.

## Scope / spec sync

Actual runtime signatures and lifecycle were checked against the updated
`frontend/react-entry-runtime.md`; HTTP/config subpaths retain the one generated
tree and old Vue reexports. Lock diff is additive after restoring original old
package entries. No generated/schema/backend/room/media production code was
changed by the checker. Pre-existing `dev.sh` URL edits remain outside ownership.
The main session owns final validation consolidation, human classification,
commit review, task/journal/archive and preview teardown.
