# M3 validation

## Scope and authorization

The user approved the completed M3 planning summary with `开始实现 M3` on
2026-09-26. Prior summary: Codex session
`01a0dc8f-5005-74d1-9085-1c08b8f24c0d`. Source-session-aware task activation
changed this child to `in_progress` before implementation dispatch.

M3 delivers a parallel React entry, portable M2 HTTP/config boundaries and Warm
Club primitives. Auth/home/create/join/direct room links hand off in the same
window to existing Vue rooms. Vue remains default. M4–M6/cutover are excluded.
Pre-existing `dev.sh` displayed localhost → 0.0.0.0 URL edits are preserved and
excluded from M3 commits.

Implementation and independent checking are complete; all material automated
gates passed. The owner approved the presented residual-review and commit/archive batch
with `提交` on 2026-09-26. Work commits and finish bookkeeping now authorized;
no deployment or later-stage authorization is implied.

## Final automated evidence

[Check report](check-report.md) records fixes and exact React browser commands.
[Implementation evidence](research/implementation-evidence.md) records dependency
compatibility and shell gates. Historical iteration counts do not override this
final table.

| Check / command | Final result |
| --- | --- |
| `./dx bun run contract:drift` | Pass: 59 operations, 46 browser operations, 18 byte-stable generated files |
| `./dx bun run typecheck` | Seven workspace checks passed; later React changes strictly compiled in final build |
| `./dx bun run lint` | Pass: 293 files |
| `./dx bun run test` | 465 passed, zero failed, 2,145 assertions across 85 files; 31 new React tests included |
| `./dx bun run --filter houkago-kyoushitsu build` | Pass: 445 modules; existing dashjs/chunk warnings |
| `./dx bun run --filter houkago-kyoushitsu-react build` | Pass: 444 transformed modules and lazy handoff chunk |
| Actual React `dist/module-graph.json` | 443 IDs, zero Vue/.vue/Pinia/Eden/Housou-server/media-engine imports |
| `./dx bash scripts/test-react-preview.sh` | 124 behavior checks passed: ports/defaults, owned children, signals/first-exit cleanup, isolated environment |
| Bash syntax / ShellCheck 0.10.0 / shfmt 3.8.0 | `dx` and both new scripts passed |
| Old Vue entry desktop/375px | 12 passed, 6.2s |
| Old Vue room/governance matrix | 19 passed, 8 deliberate viewport skips, 18.9s |
| React entry desktop/375px | 24 passed, 7.2s |
| Real-cookie continuity | One passed, 2.1s, without identity/room mocks |
| Final empty-join parity correction | Four affected join/config-default cases passed, 2.2s; final lint/strict React build passed |
| `git diff --check` | Pass |

56 distinct browser cases passed; four targeted reruns are not additional cases.
Eight old-room skips deliberately scope tall/short viewports. Original lockfile
package entries are unchanged; new entries are additive. Generated/OpenAPI/backend
production files have no diff. Docker/browser command lanes were serialized.
Retained toolchain: Bun 1.3.14, Vite 8.0.16; browser: Playwright 1.61.1, Chrome
153.0.8010.52, Node 20.19.2. Exact new patches are in implementation evidence/lock.

Real-cookie flow registers a unique account on isolated memory Housou, refreshes
React (`/me` 200), creates a room, waits for exact server `NYUUSHITSU entered`
admission in Vue, verifies the same account ID, returns to React, signs out and
observes `/me` 401. It contacts no external provider.

Exact old Vue commands:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=entry-desktop --project=entry-phone --output=/tmp/houkago-m3-vue-entry
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=phone-375 --project=desktop-short --project=desktop-tall --project=governance-phone --project=governance-desktop --output=/tmp/houkago-m3-vue-rooms-final
```

Exact React commands: `check-report.md`. Passing outputs:
`/tmp/houkago-m3-react-entry-submit`, `/tmp/houkago-m3-real-cookie-submit`,
`/tmp/houkago-m3-react-join-final`. Aggregate log:
`/tmp/houkago-m3-check-tests.log`.

## Failures diagnosed and resolved

- Initial sandbox Docker socket/Chrome crashpad `setsockopt` restrictions prevented
  launch. Narrow approved escalation passed the same wrapper/browser gates. No
  material environment-blocked gate remains. Initial Chrome artifacts remain in
  `packages/kyoushitsu/test-results`.
- Initial old matrix: 16 passes, 8 skips, 3 fixture failures. Protected queue seed
  raced admission; governance DOM text included an aria-hidden decoration.
  Fixtures now await exact server admission and assert accessible alert text.
  No production permissions changed. Preserve `/tmp/houkago-m3-vue-rooms`.
- Second old matrix: 18 passes, 8 skips, one Vite reload interrupted by
  `net::ERR_NETWORK_CHANGED` during concurrent Docker creation. With Docker idle,
  that case and then the full matrix passed. Preserve
  `/tmp/houkago-m3-vue-rooms-fixed` and
  `/tmp/houkago-m3-vue-room-network-rerun` as separate attempts.
- React StrictMode exposed QueryObserver cancellation of root-owned restoration.
  Stable QueryCache subscriptions now project root-owned requests; retention lasts
  until explicit fencing/disposal purge. Initial eight failures/two interrupted:
  `/tmp/houkago-m3-react-entry-check`. Later numeric `revoked=1` parsing exposed
  two failures after 22 passes: `/tmp/houkago-m3-react-entry-final`. Typed Router
  validation fixed it; later complete 24-case passes resolve these findings.
- Checker also fixed auth form/command-lock retention, late-create navigation,
  persisted-page recovery, border utility mapping, password-label wrapping and
  empty-join parity. See [regression analysis](research/regression-analysis.md).
  Failed attempts are preserved and never counted as passing gates.

## Preview startup and teardown

```sh
DX_EXTRA_PORTS=5174 ./dx bash scripts/dev-react-preview.sh
```

One task-owned container served Housou `/site-config`:3000, Vue `/`:5173 and
React `/`:5174, each HTTP 200. Memory Housou, disabled Bun/Vite dotenv in isolated
mode and cleared provider/admin/CORS overrides avoided normal DB/environment.
After browser lanes became idle, inspected container `65ba6dc66790`: exact command
`[bash scripts/dev-react-preview.sh]`, current repo mounted at `/app`. TERM stopped
its runner (exit 143); container auto-removed; TCP checks confirmed all three
ports closed. No unrelated service was stopped. Relaunch with the command above.

## Acceptance mapping

| Acceptance | Evidence | Result |
| --- | --- | --- |
| A1 | Both builds, 443-ID graph, Vue default, pure subpaths/additive lock | Passed |
| A2 | Bootstrap/subscription/epoch/cancel/purge/logout reconciliation tests; real cookies | Passed |
| A3 | Auth/create pending/errors/retry/default name; join disabling and same-window handoff on both viewports | Passed |
| A4 | Actual inert lazy preload; deep link/refresh/unsafe target/unknown/revoked tests; protected HTTP/WS counters | Passed |
| A5 | Empty/204 versus invalid config; title/copy/tokens; focus/44px/320px/portrait/landscape/reduced-motion/contrast/border checks | Automated requirements passed; visual preference below |
| A6 | Drift/type/lint/465 tests/both builds/56 browser cases/124 shell checks; startup/teardown | Passed |
| A7 | Scoped diff reviewed; residual human review required | Passed; owner accepted via `提交` |

## Residual human review and finish

Classification: **human-required** under Trellis Plus submit-ready gate and
workflow Phase 3.4. The residual Warm Club visual and identity/handoff UX review was presented with
screenshots/evidence; the owner accepted the batch with `提交`. No generic browser
smoke rerun is requested.

Stable diagnostic review images (not approved screenshot baselines):

- [Desktop signed out](/tmp/houkago-m3-review/react-desktop-signed-out.png)
- [Phone signed out](/tmp/houkago-m3-review/react-phone-signed-out.png)
- [Desktop signed in](/tmp/houkago-m3-review/react-desktop-signed-in.png)
- [Phone signed in](/tmp/houkago-m3-review/react-phone-signed-in.png)

Main inspected corrected desktop/phone layouts. Owner decision: accept Warm Club
forms/cards and join-primary/create-secondary presentation, plus auth
error/reconciliation feedback and full-document same-window Vue handoff, or name
a specific screen/state and adjustment. This decision affects commit readiness;
automation already covers cookie continuity, pending/errors and admission.

Synthetic persisted `PageTransitionEvent` proves lifecycle-handler recovery,
not actual browser Back/Forward Cache eligibility. No real-device/assistive-
technology certification or credentialed external-provider behavior is claimed;
broader room/media surfaces are outside M3 acceptance scope.

[Commit plan](commit-plan.md) lists exact batches/bodies/trailers and excluded
`dev.sh`. Owner approval received; work commits `8c5a326` / `ae37464` completed. Archive
only M3 and record the journal.
Parent remains planning; M4 is not started; nothing is pushed.

## Owner approval

2026-09-26: after the final implementation/validation summary, diagnostic images
and exact commit plan were presented, the user replied `提交`. Treat this as
approval of the presented batch and residual-review gate, not an independent
claim of user-run browser checks. A7 is accepted. Proceed with the two work
commits, M3-only archive and journal; preserve `dev.sh`, do not push/start M4.

## Work commit execution

Functional commit: `8c5a326`. Documentation commit: `ae37464`. Both use the
exact approved messages and Codex trailers. No `dev.sh` path was staged. Two
research files had redundant trailing blank lines exposed by staged diff checking;
normalized during archive preparation. No product code changed after validated
gates. M3-only archive, mainline sync and journal follow; no push or M4 start.
