# M2 validation evidence

Date: 2026-09-26 (Asia/Singapore)

Implementation and independent full-scope review are complete. The task remains
`in_progress` until the reviewed commit batch is committed and archived. The user
approved the batch with `ok` on 2026-09-26.

## Final quality gate

Commands ran serially through the repository wrapper.

| Command | Result | Evidence |
| --- | --- | --- |
| `./dx bun run contract:drift` | PASS | 18 contract/generated files match the checked baseline and two consecutive generations. 59 authoritative operations: 46 browser JSON, 8 adaptor JSON, 5 compatibility boundaries. |
| `./dx bun test packages/housou/test/http-contract.test.ts packages/kyoushitsu/test/http-contract.test.ts packages/kyoushitsu/test/http-contract-types.test.ts packages/kyoushitsu/test/resources.test.ts` | PASS | 46 tests, 0 failures, 228 assertions across 4 files. |
| `./dx bun run typecheck` | PASS | All six workspace packages, including the strict generated DTO fixture. |
| `./dx bun run lint` | PASS | Biome checked 265 files. |
| `./dx bun run test` | PASS | 434 tests, 0 failures, 2,019 assertions across 82 files. |
| `./dx bun run --filter houkago-kyoushitsu build` | PASS | Vue typecheck and Vite production build succeeded; 444 modules transformed. |
| `git diff --check` | PASS | No whitespace errors. |

The build retains an observed dash.js CommonJS warning and a large room chunk
(about 1,600 kB, 469 kB gzip). Its warning excerpt was truncated, so this record
does not claim an exhaustive warning inventory. No browser suite was rerun:
M2 leaves Vue consumers and media/session behavior in place; M0's recorded
browser prerequisite limitations remain outside this contract task.

## Acceptance mapping

| Criterion | Evidence |
| --- | --- |
| A1 Complete inventory | Export compares runtime routes with the authoritative operation set; all 59 methods/paths, aliases, admin and compatibility boundaries appear in the expanded inventory. Missing/hidden routes are regression tested. |
| A2 Isolated export | Tests protect a production DB sentinel and fail on upstream fetch/listener startup; export forces an empty in-memory DB, clears credentials/admin configuration and disables automatic environment-file loading. |
| A3 Generated fidelity | Drift/header/server-import checks, zero unknown/any in generated DTOs, strict dictionary/union assignments, configured origin/cookies and AbortSignal tests. Generic generated runtime internals remain generator-owned. |
| A4 Five families | Fake-fetch tests cover config, identity, room queue acknowledgements, Baidu availability/grants and danmaku candidates; status/domain/response metadata and protocol failures are retained. |
| A5 Resource lifecycle | Operation-derived private session/room/source/search/cursor/generation keys, explicit retry/focus/reconnect/stale/enable policies, cancel-before-remove logout port and bounded grant/search cancellation regressions. |
| A6 HTTP/WS authority | Bootstrap keys and command recovery hints do not write live queue/playback/permissions; media/adaptor/HTML/WS operations are excluded from page generation. M1 ordering tests remain in the aggregate suite. |
| A7 Existing compatibility | Six-package typecheck, lint, 434 aggregate tests and the current Kyoushitsu build pass. |
| A8 Bounded scope | No React workspace, QueryClient binding, component migration, UI redesign or domain/protocol/database redesign. |

## Review corrections

- Added cookie/public/optional-session and adaptor bearer metadata, runtime route
  classification checks, full inventory, and accurate HTML/media/WS content types.
- Made drift verification compare existing artifacts as well as consecutive runs.
- Preserved generated dictionary value types through supported record schema
  normalization and a strict compile fixture.
- Added private session/generation key dimensions, logout cancellation/removal,
  command non-replay, bounded grant polling and superseded search cancellation.
- Rejected malformed/null/primitive/empty success JSON, HTTP 204 and zero-length
  bodies as protocol failures; retained valid empty arrays.
- Declared Eisha's existing unexpected-error HTTP 500 response and verified it.
- Removed unused client-fetch dependency and unrelated Bun type package upgrades;
  retained the existing locked 1.3.14 types with frozen-install verification.

## Change ownership and remaining work

All M2 implementation, generated artifacts, tests and spec updates are included
in `commit-plan.md`. The pre-existing `dev.sh` URL edits are unrelated, untouched
and excluded from this task's commits. No push or M3 continuation is authorized.

Remaining at this record's work-commit stage: finish the approved work commits,
M2 archive/mainline sync and session journal. See `research/implementation-evidence.md` and
`research/check-evidence.md` for implementation and independent-review history.
