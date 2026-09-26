# M3 technical design

## Decision and ownership

Approved interim behavior (2026-09-26): React home creates/joins rooms and
automatically hands off in the same window to existing Vue rooms. Admission,
realtime and media migration remain M4/M5.

New workspace: `packages/kyoushitsu-react`, package `houkago-kyoushitsu-react`.
Default Vue remains `houkago-kyoushitsu` on 5173; React is opt-in on 5174.
No Vue/React mounting bridge, shared live store or second room controller.

```text
React main -> app runtime (HTTP config + QueryClient + identity lifetime)
           -> typed Router -> thin Home -> identity/entry features -> resources
                           -> lazy room handoff -> full-document Vue room
resources -> kyoushitsu explicit pure subpaths -> one M2 generated client tree
public config -> pure loader -> kousoku normalization/default -> immutable context
UI -> React-owned primitives + token bridge -> shared Warm Club CSS
Vue room -> existing admission/session/player ownership
```

Source layout: `src/app/{runtime,router,query-client}.ts[x]`,
`src/routes/{home,room-handoff}.tsx`, `src/features/{identity,entry}/`,
`src/components/ui/`, `src/lib/legacy-room-url.ts`, `src/styles/`.
Pages compose features/config/runtime, not raw HTTP/cache purge/transport/player
lifetimes. Drafts/auth mode/password visibility stay local; Query owns HTTP data;
runtime owns epoch and operation lifetime. No new persistent token/global store.

## Portable M2 reuse

Use explicit `houkago-kyoushitsu` subpaths: `http`, `http/generated`, `i18n`,
`room-id`, `theme`, `theme.css`, `site-config`. No package-root export or wildcard
source alias. `research/reuse-boundary.md` records the exact closure and exports.
Add handwritten `api/public.ts` exporting client/resources/keys/policies only;
make the URL helper import relative `../lib/housou-url`. React's `@` resolves
only its own `src`; it supplies its own Vite/DOM types.

Add missing typed `createRoom` around generated `roomCreate` and `unwrapResult`.
Components never call the SDK directly or redefine wire DTOs. Keep Eden barrel,
generated paths, OpenAPI inputs, exporter, drift scripts and Vue imports intact.
Standalone core extraction is deferred to M6 ownership transfer; no generated
copy. Verify the transitive React build graph excludes `.vue`, Vue, Pinia, Eden,
Housou server and media engines, although the legacy package declares them.

## Composition and Query policy

Create one runtime outside React render, configure HTTP once, and create one
QueryClient and Router. Root providers and Router context share these instances.
Home's memoized bootstrap starts public config and one shared identity restore
operation concurrently, with labeled pending/error UI. StrictMode must not create
another runtime or mount-owned restore request. A direct room route uses only
the handoff boundary and does not need React identity restoration first.

Verified browser implementation decision: render identity/config through stable
QueryCache snapshots and `useSyncExternalStore`. Disabled QueryObservers still
cancel a consumed-signal fetch on their final unsubscribe, so StrictMode replay
can otherwise cancel the root-owned restore. This cache projection does not
introduce another cache or request owner. Identity/config use `gcTime: Infinity`
for the runtime lifetime, with explicit private fence/dispose cleanup; passive
cache subscriptions alone do not prevent active identity from being garbage-collected.

Use M2 keys/policies explicitly: stale windows, enabled conditions, retry
translation (`failureCount` to attempt), focus/reconnect, cancellation and
retention. Identity is enabled before a known session; public config survives
private purge. Ordinary Query APIs consume AbortSignal. No Suspense query hooks
for private work, duplicate Router HTTP cache or protected room/provider queries.

Commands use non-replay mutations (`retry:false`), operation AbortControllers
and submit locks. Retained mutation state must not hold credentials: pass only
non-sensitive operation metadata as mutation variables and keep credential
drafts in the owning short-lived form/command closure; clear on completion/mode
change/identity transition. Reset consumed mutation results/errors; no passwords,
cookie tokens or raw response bodies in persistence/logs/URLs. Visible feedback
uses the typed translation catalog, preserving HTTP metadata internally.

## Identity lifecycle and isolation

Runtime owns a monotonic non-secret epoch, initialized before restoration.
`identityMeKey(epochScope)` scopes reads before an account is known. Current
identity comes from current-epoch Query data; runtime tracks lifecycle/operation
ownership rather than a second authoritative account store. A restore 401 with
UNAUTHORIZED becomes an anonymous application result; network/5xx/protocol errors
remain recoverable failures, not successful-null DTOs.

1. Restore is one operation per home bootstrap; successful/401 initial restore
   makes one request. Transient retries obey M2's bounded policy. Manual recovery
   explicitly starts another current-epoch read; forms stay gated while uncertain.
2. Serialize cookie-changing auth commands; disable repeated submits/mode changes
   while pending. Fence old completions with a new epoch and cancel/remove private
   queries before accepting a new command result. Seed verified identity from the
   generated response only if operation/epoch remain active.
3. Logout immediately fences old writes, disables entry/auth, aborts private work
   and purges through M2's cache port. Confirmed sign-out clears identity/drafts;
   public config remains. Remove private queries even if cancel rejects.
4. Failed/uncertain sign-out is shown as failure, never completed logout.
   Reconcile with fresh current-epoch `/me` before enabling another auth command;
   it may reveal the previous account or anonymous state. Failed reconciliation
   stays explicitly blocked/retryable; never revive old cached identity.
5. Every async completion checks current epoch/operation. Cancellation cannot
   undo a server Cookie change; ambiguous auth failure also requires reconciliation
   and no automatic replay. Disposal aborts owned operations/listeners.

Test delayed old restore/auth/create results after a new epoch, purge despite
cancel rejection and absence of credentials in retained caches. Hard navigation
destroys the runtime; cache is not transferred to Vue.

## Public configuration

Extract loader/title/types to `lib/site-config-core.ts`; old `lib/site-config.ts`
keeps Vue injection and reexports pure APIs, preserving old callers/tests.
Memoized promise, deep-frozen canonical normalization, one value-free fallback
warning and title application remain. React provides immutable config itself.

React adapts `fetchSiteConfig` to the pure loader with an optional failure
predicate: only HTTP/network or typed protocol `EMPTY_RESPONSE` may default.
Malformed JSON, null/primitive/empty-object JSON and invalid successful schema
reject bootstrap. Abort never becomes fallback; schema normalization errors
remain outside transport fallback.

The generated parser normalizes zero-byte responses and literal `{}` alike.
At `fetchSiteConfig`, capture configured fetch and supply a supported per-call
wrapper that clones only this response to detect actual zero bytes/204, returning
the original to the SDK. On completion, preserve abort first; inject a typed
`EMPTY_RESPONSE` error with available Request/Response metadata for true empty
success. `normalizeHttpError` preserves existing typed kind/code/status and fills
missing metadata. No global interceptor, generated edits, message comparison or
catch-all protocol fallback. Exact source anchors/tests are in reuse research.
Existing Vue default failure classification remains compatible. Public config
is a one-request memoized projection, not polling; its existing fallback resolves
transport failure, so Query retry does not add hidden requests to that projection.

## Routes and handoff

Typed code-defined routes preserve `/` and `/bushitsu/$id` (external URL remains
`/bushitsu/:id`), lazy handoff code, error/not-found boundaries and home
`revoked=1` notice. Preloading route code has no navigation side effect. The actual
handoff is idempotent under StrictMode/remount and uses `location.replace`, so
Back does not loop through an auto-forwarding room route.

Home uses existing `normalizeRoomId` for IDs/invite paths. Validate nonempty safe
route segments, controls, decoding and special path segments; encode exactly
once with `encodeURIComponent`. This is not existence/admission validation and
must not introduce UUID-only restrictions. Create awaits typed ID then hands off;
join invents no REST admission call.

`VITE_LEGACY_FRONTEND_URL` is build/dev configuration, never user-provided URL
input. Development default is current protocol/hostname at 5173. Require an
http(s) origin without credentials/path/query/hash, distinct from React and using
the same protocol/hostname for M3's supported Cookie setup. Production preview
needs an explicit origin; no deployment is included. Missing/invalid/self targets
show accessible error instead of navigating. Never forward secrets or arbitrary
search/hash. Both apps address the same Housou origin using included cookies.

Direct room URLs hand off without React admission or protected HTTP/WS/media;
Vue owns auth/admission/playback. Its later return-home remains on Vue. Origin-local
storage does not move across ports; existing room preferences remain untouched.

## UI and compatibility

Preserve Warm Club attribute/tokens/copy/title and configured default room name.
Follow the UUPM override/token record in `research/dependency-and-ui-decisions.md`;
generic marketing palette/fonts/testimonials are not adopted. React owns Tailwind
aliases, entry layout and Button/Input/Label/Card/Alert/status primitives. Check
Preflight/layer effects in the new document without changing Vue CSS. Join remains
primary, create secondary; visible labels, native submit, inline status/alerts,
password reveal, pending locks, focus recovery, 44px targets/reflow and reduced
motion are required. No global theme toggle/storage or remote assets/fonts.

React 19, Query 5, Router 1, Tailwind 4 are target majors. First authorized
implementation step records exact compatible patches/shadcn source dependencies
and minimal build proof. Existing Bun/Vite/Hey API/Playwright pins stay intact;
material incompatibility returns to planning.

## Operations, rollback and review

Existing `dx` gains opt-in `DX_EXTRA_PORTS=5174`, preserving defaults. Syntax is
comma-separated decimal ports 1–65535, deduplicated and validated before Docker
without shell evaluation. React Vite binds 0.0.0.0:5174, strictPort/polling.
Keep pre-existing `dev.sh` edits unchanged. Quality commands run serially.

Add `scripts/dev-react-preview.sh` as a process runner **inside** existing dx,
not another Docker wrapper. One task-owned container runs isolated memory Housou,
Vue and React together. Both Vite configs set `envDir: false` only when
`HOUKAGO_ISOLATED_PREVIEW=1`; Bun's `--no-env-file` alone does not prevent Vite's
own dotenv loading. The runner sets this opt-in flag; ordinary startup retains
its existing env-file behavior. Runner tracks child PIDs, exits when one service fails,
and cleans its children on signals/exit using the established Bash pattern.
This avoids a port reservation race: dx publishes defaults even when a Vite-only
container has no API listener, so its TCP busy probe cannot prove another
container may publish 3000. `DX_EXTRA_PORTS=5174 ./dx bash scripts/dev-react-preview.sh`
is the reproducible three-service preview command. Do not rely on three separate
dx invocations for the real-cookie gate.

Browser uses project Playwright + host Chrome first; cached matching Playwright
container is fallback only. Verify actual ports/readiness and stop only task-owned
sessions. Concrete sandbox launch/network failures may need narrow escalation;
research presence is not a browser pass.

Rollback is opening unchanged Vue; no DB/protocol/default deployment switch.
Finish needs runnable checks and focused residual visual/auth human review.
Material failed/blocked gates stay incomplete. Commit plan includes Codex's
required co-author trailer; no automatic push or stage continuation.
