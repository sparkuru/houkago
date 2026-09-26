# M2 independent review and final quality gate

Reviewed on 2026-09-26 by the `trellis-check` agent. The review covered the
entire M2 change surface, task A1–A8, runtime route registration, canonical
schemas, export/projection/generation scripts, generated DTOs, handwritten
transport/resources, tests and dependency scope. Main-session specs, roadmap,
task metadata, commit/archive work and the unrelated `dev.sh` URL changes were
preserved.

## Findings fixed

1. **Missing existing Eisha 500 response.**
   `packages/eisha/src/routes.ts` declared cue errors 400/422/502 but omitted
   the central unexpected-error response. Added the canonical 500 error schema
   and regenerated both OpenAPI artifacts and the SDK. The isolated export test
   now exercises `/eisha/danmaku/%25` and proves the unchanged
   `500 { error: { code: "INTERNAL", message: "internal error" } }` behavior,
   together with the declared 500 response.
2. **Primitive/null success bodies masquerading as DTOs.**
   `packages/kyoushitsu/src/api/http-client.ts` rejected empty objects but
   accepted `null`, booleans, numbers and strings as successful object/array
   DTOs. The shared success-body guard now accepts arrays and nonempty objects
   only; normalization retains HTTP/request/response metadata and classifies
   invalid bodies as `protocol`. Added four regression cases to the existing
   invalid-success matrix. Empty arrays remain valid, as proved by the catalog
   search test. This guard is deliberately not a complete runtime DTO decoder.
3. **Unrelated Bun type upgrades during installation.**
   `bun.lock` contained new nested Bun type 1.4.2 resolutions for unchanged
   packages. Removed that churn and pinned the newly needed Kyoushitsu
   `@types/bun` dependency to the already locked 1.3.14. A frozen install
   succeeded, and all checks ran against the normalized lock. The new type
   dependency supports compile-checking the Bun contract fixture; Kyoushitsu's
   explicit Elysia 1.4.28 dependency satisfies the existing Eden peer using the
   already locked Elysia version. Hey API's new transitive dependencies and
   perfect-debounce hoisting are required generator changes; Vue retains its
   existing nested perfect-debounce 1.0.0.

## Acceptance evidence

- **A1:** 59 actual registered operations match the authoritative document:
  46 browser JSON, 8 adaptor JSON and 5 compatibility boundaries. Legacy
  candidate/default aliases and admin/proposal/revision operations remain
  separate. Missing classification and hidden runtime routes fail export.
- **A2:** Export forces test/in-memory configuration before imports, clears
  provider credentials/admin configuration, disables automatic environment-file
  loading and never listens or calls providers. The subprocess test protects a
  production database sentinel and traps listeners/upstream fetches.
- **A3/A4:** DTOs are generated from canonical response/error schemas; generated
  DTOs contain no `unknown`/`any` and the generated boundary does not import
  Housou. Generic upstream-generated transport internals retain their generator
  types. Fake-fetch tests retain cookies, origin, AbortSignal, status/domain
  errors, metadata, grant discriminants and acknowledged queue commands.
  Record normalization changes only the supported catch-all pattern without
  named properties; constrained patterns and other object constraints are
  retained. Export assertions verify string header and typed subtitle dictionary
  values; the type fixture assigns the generated queue to canonical `Enmoku[]`
  without casts. Security assertions cover public anonymous operations,
  cookie-only identity, bearer adaptor operations, anonymous pairing redemption,
  and optional cookie security/parameters for idempotent sign-out.
- **A5:** Operation-derived private keys include non-secret session scope and
  applicable room/source/search/cursor/generation dimensions. Retry/freshness,
  panel/preparation enabling, cancellation and logout purge are explicit.
  Grant creation is issued once and followed by bounded, expiry-aware polling;
  cancellation or terminal states stop it without replay.
- **A6:** HTTP queue/room reads are bootstrap/recovery resources. Commands return
  acknowledgements/recovery hints; no adapter writes the WS-owned admission,
  permissions, roster, current playback or live queue. Media, HTML, WS and
  adaptor operations are excluded from the page SDK.
- **A7/A8:** Aggregate compatibility tests, typecheck, lint and production build
  pass. Existing Vue/Eden consumers, M1 session/player ordering and adaptor
  runtime remain intact; no React workspace, QueryClient wiring, domain rewrite
  or UI migration was introduced.

## Final verification

All `./dx` commands ran serially, with no concurrent port-binding containers.

| Command | Result |
| --- | --- |
| `./dx bun install --frozen-lockfile` | Pass against normalized existing Bun type versions |
| `./dx bun run contract:generate` | Pass after Eisha schema correction |
| `./dx bun run contract:drift` | Pass; 18 artifact/generated files match the checked baseline and two consecutive generations |
| `./dx bun test packages/housou/test/http-contract.test.ts packages/kyoushitsu/test/http-contract.test.ts packages/kyoushitsu/test/http-contract-types.test.ts packages/kyoushitsu/test/resources.test.ts` | 46 pass, 0 fail; 228 assertions across 4 files |
| `./dx bun run typecheck` | All 6 packages pass, including the compile-time contract fixture |
| `./dx bun run lint` | Pass; 265 files checked, no fixes needed |
| `./dx bun run test` | 434 pass, 0 fail; 2,019 assertions across 82 files; 10.40 s |
| `./dx bun run --filter houkago-kyoushitsu build` | Pass; Vite 8.0.16, 444 modules transformed; bundle phase 2.47 s |
| `git diff --check` | Pass after final source/generated changes |

Targeted Biome formatting fixed one changed test file before the final gate.
There are no remaining M2 implementation findings. Main was notified of the
transport guard and Eisha status additions for spec/evidence synchronization.

## Limits

The build emitted an observed `COMMONJS_VARIABLE_IN_ESM` warning from the
unchanged dashjs 5.2.0 dependency; the room chunk remains about 1,600.29 kB
(468.72 kB gzip). The minified dependency excerpt made the tool output extremely
large and truncated, so this report does not claim to enumerate every warning.
The command exited successfully. No browser/Playwright run or live provider
validation was performed in this review: M2 retains the current UI, and its
required compatibility gate is the aggregate tests/build plus contract evidence.

An initial attempt to redirect the host-side test output encountered Docker
socket sandbox denial; the ordinary authorized `./dx bun run test` command
then completed successfully. No check remains blocked by that attempt.
