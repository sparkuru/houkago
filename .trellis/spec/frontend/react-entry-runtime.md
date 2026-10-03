# React Entry Runtime

## 1. Scope / Trigger

Use this contract for the `houkago-kyoushitsu-react` entry, its identity
lifecycle, Query binding and room routing. React is the default local frontend
in M4. The room route owns a separate room session and socket, specified in
[React Room Runtime](../houkago-kyoushitsu-react/frontend/room-runtime.md).
Provider and media lifecycles are specified in
[React Media, Baidu and Danmaku](../houkago-kyoushitsu-react/frontend/media-provider-danmaku.md).

## 2. Signatures

The composition root creates one `AppRuntime`, QueryClient and typed Router
outside React render. `AppRuntime` in `packages/kyoushitsu-react/src/app/runtime.ts`
exposes `bootstrap()`, `restore()`, `authenticate(mode, body)`, `logout()`,
`create(name)`, `identity()`, `identityKey()` and `dispose()`.
`subscribe` / `getSnapshot` expose lifecycle state for React; `subscribeQueries`
and `useResourceState` project stable QueryCache snapshots. Identity data belongs
to the current Query key, not a second account store.

```ts
identityMeKey(`epoch:${epoch}`)
resourceQueryOptions("identityMe")
safeRoomId(id)
```

Run development and checks through the existing wrapper:

```sh
./dx bun run dev:react
./dx bash scripts/dev-react-preview.sh
./dx bun run --filter houkago-kyoushitsu-react typecheck
./dx bun run --filter houkago-kyoushitsu-react build
```

## 3. Contracts

- Bootstrap memoizes one public-config read and one initial identity restoration.
  Query's ordinary AbortSignal reaches the generated resource adapter. UI
  subscriptions do not independently repeat restoration. Room deep links restore
  identity before constructing their room session; route preload does not open
  a room socket.
  Identity/config UI uses stable QueryCache snapshots through
  `useSyncExternalStore`, without mounting QueryObservers for these runtime-owned
  reads. Even `useQuery({ enabled: false })` creates an observer whose final
  unsubscribe can cancel a signal-consuming fetch during StrictMode replay.
  Keep StrictMode enabled. Retain identity and config with `gcTime: Infinity`
  for the runtime lifetime; private fencing/disposal still cancel and purge them
  as appropriate. A passive cache subscription alone does not stop Query GC.
- Map M2 policies explicitly: stale time, focus/reconnect, retry attempt and
  retention. Commands have `retry: false`. Neither Router nor effects own another
  HTTP cache or cookie restoration. Private work uses ordinary cancellable Query
  APIs; Suspense is limited to lazy code.
- A monotonic non-secret epoch scopes private keys before identity is known.
  Cookie-changing commands are serialized. Fence old completions, abort owned
  operations, and cancel/remove private queries before accepting a new account.
  Remove runs even if cancellation rejects; public config survives.
- Mutation variables contain operation name and epoch only. Passwords stay in
  the active form/command closure and are cleared after completion or identity/
  mode transitions. Consumed mutations leave the cache. No password/token/body
  persistence, logging or URL propagation is permitted.
  Preserve the local registration mode while an auth command fences the epoch;
  an epoch-only key must not remount an anonymous form and turn registration
  into sign-in. Submit/mode change clear password/reveal state; actual identity
  transitions unmount the form.
- Failed or ambiguous cookie commands reconcile using fresh current-epoch `/me`.
  Entry/auth remain gated while reconciliation is pending or fails. Never show a
  failed logout as completed or revive an old cached account. Every asynchronous
  seed/navigation checks operation ownership and epoch.
  Public `restore()` ignores calls during a command; internal reconciliation reads
  identity while retaining the command lock. Do not clear that lock before the
  read: doing so can unmount the auth form or admit another cookie command.
  Creating a room clears its pending command before the final epoch check, so
  synchronous completion subscribers cannot dispose/switch identity and still
  return a usable target. The consuming entry feature also verifies mounted,
  epoch, ready phase, no pending command and current identity before navigation.
- Reuse exact `houkago-kyoushitsu-core` subpaths (`http`, `http/generated`, `i18n`,
  `room-id`, `theme`, `theme.css`, `site-config`). No root import or wildcard alias.
  React's `@` alias resolves only its own source. Generated files remain owned by
  the existing contract pipeline. Verify the actual build graph excludes Vue,
  Pinia, Eden and Housou server modules. Media engines are allowed only in the
  lazy room chunk through the React player driver.
- React serves the normal local entry on port 5173. Validate decoded room ID
  segments before a room session is constructed. Home create/join and direct
  `/bushitsu/:id` navigation render the React route. Route-code preload must
  never open a socket or start protected room reads.
- React imports the existing Warm Club CSS and typed copy. Tailwind aliases map
  shared semantic tokens without copying palettes or adding another theme source.
  Shared copy/tokens are owned by core; React imports neither the legacy app nor
  its framework bindings. Controls retain visible labels/focus, pending status, 44px targets and reduced
  motion; there is no new theme/storage preference.
  Use `--color-outline: var(--color-border)` with `border-outline` for cards;
  the shared `--color-border` declaration alone does not generate Tailwind's
  `border-border` utility. Verify actual computed border color, not class names.
  Disable join while pending or while the trimmed room input is empty. Router
  search validation accepts string/numeric `revoked=1`, preserves canonical 1
  and supplies the notice through typed route search.
- `pagehide` disposes the runtime. A persisted `pageshow` reloads the document
  and creates a fresh runtime/cookie restoration; reusing a disposed runtime
  would keep its memoized bootstrap and cleared cache. Synthetic persisted
  PageTransitionEvent checks prove this lifecycle handling, not eligibility for
  a particular browser's Back/Forward Cache.
- `DX_EXTRA_PORTS` accepts comma-separated decimal ports 1–65535, deduplicated
  with defaults 3000/5173 and validated before Docker; it never evaluates input.
  The preview runner owns a single container's memory Housou and React frontend.
  `--backend-port` and `--frontend-port` allow task-owned ports when defaults
  are occupied; both values must be valid distinct decimal ports.
  It uses Bun `--no-env-file`, `HOUSOU_DB=:memory:` and
  `HOUKAGO_ISOLATED_PREVIEW=1`. The React Vite config disables `envDir` under that
  flag, because Bun's option alone does not disable Vite dotenv loading. Ordinary
  service startup retains its existing env behavior. Track actual child service
  PIDs and clean them on first service exit or signals.

## 4. Validation & Error Matrix

| Condition | Observable outcome |
| --- | --- |
| `/me` 401 with `UNAUTHORIZED` | Anonymous; enable auth after restoration |
| Network/5xx restoration failure | Bounded M2 retry; recoverable gated error |
| Old response after epoch change/disposal | No account seed, room navigation or private data revival |
| Private cancellation rejects | Private keys still removed; epoch fence remains authoritative |
| Sign-out fails | Failure feedback; fresh `/me` reconciliation before enabling commands |
| Reconciliation fails | Error/retry state; no success claim or old cache reuse |
| Unsafe room segment | Accessible error; no socket or protected read |
| Direct React room URL | Restore identity, then one room socket; protected reads wait for admission |
| Invalid extra-port list | Fail before invoking Docker |
| Preview child exits or TERM/INT arrives | Stop/reap owned siblings and propagate status |

Public-config empty/invalid response distinctions are governed by
[site-configuration.md](site-configuration.md); transport fidelity is governed by
[http-contract-resources.md](http-contract-resources.md).

## 5. Good / Base / Bad Cases

- Good: logout while an old private response is pending; clear the private scope,
  reject its late completion, reconcile any uncertain cookie result, keep config.
- Base: restore once on home, authenticate, create/join and render the React
  room through typed router navigation.
- Bad: add a second home restoration effect, retain credential mutation
  variables, replay auth/create after network failure, or start room HTTP
  before server admission.

## 6. Tests Required

- Runtime tests cover one bootstrap, real 401 anonymous, retry/recovery, duplicate
  submits, stale restore/auth/create, private purge despite cancel rejection,
  logout reconciliation, disposal and no retained credentials.
- URL tests cover room ID normalization and unsafe/control/dot segments.
- Run drift, aggregate tests/typecheck/lint and both production builds. Inspect
  the emitted `module-graph.json` for the actual transitive boundary.
- React entry Playwright covers 1280x900 and 375x812, focus/labels/status/pending,
  config/title/default name, refresh/deep links, direct room rendering,
  overflow and motion. Keep identity mocks separate from isolated real-cookie
  register/refresh/room/return/logout continuity. Run affected room regressions;
  Vue browser parity is not an M4 gate.
- Fake Docker/Bun checks verify port validation and preview process cleanup;
  actual service teardown is an integration check. Browser screenshots are
  diagnostic evidence, never automatically updated baselines.

## 7. Wrong vs Correct

Wrong: create the runtime in component render, restore in a mount effect and
submit credentials as retained mutation variables.

Correct: create the runtime once at the composition root, let home bootstrap
restore once, submit through its serialized metadata-only command and fence
every completion before committing identity or navigation.

Wrong: launch Housou and React in unrelated containers, or terminate unknown
processes to free ports. Correct: run the isolated memory preview in one
task-owned container and stop only its child services.
