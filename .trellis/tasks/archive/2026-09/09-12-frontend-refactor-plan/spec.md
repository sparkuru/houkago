# Proposed migration contracts

Status: contracts for the direction accepted on 2026-09-12; implementation is not authorized. These migration contracts do not describe already shipped changes or replace current Vue implementation guidance. Existing behavior evidence is in `audit.md`; approved priorities and ordered stages are in `roadmap.md`.

## S1 — authority and ownership

| Data | Owner | Readers / permitted updates |
| --- | --- | --- |
| Account and public site config | Query-backed HTTP resource | App/session read; identity change invalidates private scope |
| Room admission, permissions, roster, current item, authoritative playback | Room-session realtime snapshot | WS decoder/controller writes; UI reads selectors |
| Bangumi queue | Room-session snapshot | WS BANGUMI is authoritative; guarded HTTP bootstrap/recovery may seed |
| Chat/live danmaku | Session event buffers | WS append; renderer reads; do not run per-frame updates through Query |
| Provider availability, file lists, candidate searches | Scoped HTTP resource adapters | Query handles fetch status; feature decides readiness and dependencies |
| One-use/expiring playback grants | Provider workflow | Explicit creation and bounded polling; do not treat acquisition as an idempotent cached read |
| Player engine, local time and pending seek | Player driver | Owns imperative media effects; emits typed callbacks |
| Panel state, cinema, subtitle/source choice, local danmaku preferences | Feature-local UI/preference state | Preserve existing persistence semantics; cannot override room authority |

The same live field must not be independently authoritative in both Query and the realtime snapshot. HTTP queue requests may use the SDK directly through a room resource adapter; components must not create a second queue subscription to a cached HTTP result.

## S2 — session lifecycle and stale results

- A room session is scoped by account identity, room ID and a monotonically changing local generation. Changing identity/room or disposing the session invalidates all pending work.
- Connect/disconnect and resource cleanup must be idempotent. Late results from old sockets, requests, timers or player instances cannot mutate the current session.
- `NYUUSHITSU entered` gates protected bootstrap and mutations. Revocation cancels room work and returns to the existing home/revoked flow. Backend remains the authorization authority.
- Resolve host identity before choosing OIKAKE behavior. Maintain the current store-before-playback message order.
- For HTTP queue bootstrap/recovery, capture the current session generation and local queue-event revision at request start. Apply only if both still match at completion; every accepted BANGUMI increments that revision. This is a local race guard, not a new server ordering protocol.
- Source-resolution completions also verify the requested current-item identity. Leaving/re-entering must not retain another room's chat, queue, authority or requests.
- Reconnect retains the existing bounded backoff and drops transient send buffers across reconnect. A newly admitted connection performs guarded bootstrap. Do not replay uncertain mutations automatically.

Acceptance: delay HTTP until after a newer BANGUMI; switch room/source before completion; simulate disconnect/reconnect and revocation; old data never replaces current authority, and one live session has one socket.

## S3 — HTTP contracts and Query policy

- Generated SDK uses the configured Housou base URL and `credentials: include`. Preserve trusted-Origin/CORS and cookie semantics.
- Query functions must reject non-success responses in a normalized error shape, including domain code/status; an Eden-style `{ data, error }` result must not accidentally become a successful query. AbortSignal must reach the transport.
- All private resource keys include identity/session scope and relevant room/source/search/cursor parameters. A logout/account switch cancels requests, disposes room state and removes private cached data.
- Set freshness, retry and focus/reconnect policies explicitly per resource. Do not retry authorization/validation failures; avoid polling data already pushed by WS. Query's default stale/refetch behavior must not trigger media acquisition or protected bootstrap ([Query defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)).
- Mutations do not optimistically commit permissions/current playback. Accept server events as truth. HTTP success is command acknowledgement, not permission to fabricate a realtime snapshot.
- Playback grant creation is an explicit non-replayed command. Poll only its pending request, stop at expiry/terminal state/dispose, and retain the current fingerprint-failure fresh-grant behavior. Never persist grant URLs in a general cache or localStorage.
- Generation must cover every migrated endpoint with concrete success/error schemas. Stable operation IDs and deterministic output are required. CI/future local checks regenerate and fail on drift; no manual generated-file edits.

Acceptance: expired identity, 403/422/domain errors, network abort, logout during fetch, repeated mount and grant expiration behave without stale/private data reuse or duplicate acquisition.

## S4 — playback controller and media wrapper

- Preserve `PlayerHandle` semantics: apply, alignTransport, setRate and snapshot. Only the owned driver manipulates ArtPlayer/HLS/DASH; domain sync cannot depend on React or DOM objects.
- Preserve current shared-control behavior: host and permitted guests may originate SHINKOU; explicit remote SHINKOU is followed by peers including the host; host skips periodic GENJOU self-follow. Unauthorized guests cannot originate playback changes.
- Preserve echo suppression, clock-offset sampling and drift-tier behavior using existing tests as the baseline. Any intentional correction is a separate reviewed behavior change.
- Keep deferred seek until media is seekable. Join-triggered sound playback stays within the browser user-gesture stack; asynchronous data loading cannot replace that gesture.
- Strict Mode setup/cleanup/setup, route exit and media switch destroy engines, listeners, animation frames and timers. Effect replay must not issue a second grant or WS mutation.
- Player frame/time events drive rendering locally; they are not a Query resource and do not rewrite authoritative playback progress.
- Native fullscreen includes the correct overlay and dialog subtree. Preserve subtitle/source controls, cinema mode and current control-permission behavior.

Acceptance: existing sync tests port without weakening assertions; two sessions validate authorized/unauthorized control, late joining, seek/rate/pause, fullscreen, subtitle switching and teardown. Use fixture media and adapter fixtures before optional live-provider checks.

## S5 — routes and UI

- Preserve `/` and `/bushitsu/:id`, refresh/deep-link behavior and existing revoked navigation semantics.
- Router can prefetch public data and the lazy room bundle; it must not issue protected room bootstrap before admission. Identity restore should be shared, avoiding separate loader/component requests.
- shadcn primitives have no API/domain dependencies; feature components own business labels and actions. Keep existing romaji domain vocabulary and translations.
- Preserve current semantic/room tokens and theme preference. Tailwind utilities do not introduce an independent palette.
- Desktop room keeps its intentional internal scroll ownership; portrait is player-first with reachable controls and no horizontal overflow. Cinema retains the conversation rail. Minimum touch target remains 44px where specified.
- Dialog replacement preserves keyboard focus, Escape, focus restoration and pending-action behavior, including native fullscreen portal targeting.

Acceptance: existing Playwright entry/room/governance/danmaku/subtitle scenarios retained across phone-375, ipad-mini, desktop-short and desktop-tall projects. Selector changes may adapt to accessible roles; behavior assertions cannot simply be deleted.

## S6 — extension seams

- A new HTTP endpoint changes backend contract/export and the owning feature adapter; generated files regenerate without page-level transport code.
- A new media provider implements the established provider/controller seam and its UI contribution; room-session and sync logic should not need provider-specific branches.
- A new panel uses session selectors/commands; it must not open a socket or own another player instance.
- Existing backend/shared/adapter tests remain in the aggregate test command after frontend replacement. Pure frontend helper tests should carry over; framework-specific harnesses may change.

These are reviewable dependency constraints, not arbitrary file-size limits. No generic plugin registry or new state-machine dependency is required by this proposal.
