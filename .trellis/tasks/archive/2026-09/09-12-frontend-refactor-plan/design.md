# Proposed frontend architecture

Status: direction accepted for planning on 2026-09-12; no implementation approval. Companion contracts: `spec.md`. Findings: `audit.md`. Benefit priorities and authoritative execution order: `roadmap.md`.

## Decision frame

The accepted plan first separates responsibilities while retaining the functioning Vue client, then migrates to the requested React stack using the extracted domain/session/player logic. The Vue-preserving alternative remains a comparison/fallback, not an unresolved primary direction. The goal is thin pages, business features, an independent session controller, an HTTP Query layer and an independent player driver.

| Choice | Project-specific benefit | Cost / limit |
| --- | --- | --- |
| Hey API | Generate an independent HTTP SDK and query options from a public contract | Requires reliable OpenAPI export, error/schema coverage and generation drift checks; Eden is already typed |
| TanStack Query | Centralize HTTP loading/error/retry/cancellation and reusable resource queries | Does not define room authority, WS ordering or imperative player lifecycle |
| TanStack Router | Typed React navigation, validated params/search, lazy routes and coordinated prefetch | Only two routes today; preserve admission ordering rather than preloading protected resources indiscriminately |
| Tailwind | Shared layout/spacing conventions and reusable component variants | Translating all scoped CSS mechanically is churn; retain tokens and media-engine CSS where appropriate |
| shadcn/ui | Reusable owned dialog/form/button/select primitives | Does not supply room, queue, sync or player domain components; copied UI code requires maintenance |
| React | Fits the requested Router/Query/UI ecosystem | Vue templates, composables, Pinia bindings, motion and lifecycle wiring require migration |

Official documentation confirms Hey API generates TanStack Query v5 query keys/options and mutation options, and supports React and Vue integrations: [Hey API](https://heyapi.dev/docs/openapi/typescript/plugins/tanstack-query). Elysia supports OpenAPI schema/type-generation approaches, but the installed Elysia 1.4-compatible combination must be verified in a spike: [Elysia OpenAPI](https://elysiajs.com/patterns/openapi). Router can coordinate Query prefetch: [TanStack prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching). shadcn has a Vite setup: [shadcn Vite](https://ui.shadcn.com/docs/installation/vite).

## Alternatives

| Path | Scope | Assessment |
| --- | --- | --- |
| A: retain Vue | Extract session/player controllers, standardize HTTP resources, optionally use Vue Query; keep Eden initially | Lowest-risk response to maintainability concerns; does not fulfill a React ecosystem preference |
| B: requested React stack | Reuse backend/contracts/helpers, establish OpenAPI, build React frontend in parallel and cut over | Accepted planning target with boundary-first ordering; implementation remains unapproved |
| C: whole-system rewrite | Replace frontend, backend and protocols together | No evidence justifies this scope; loses useful tests and increases diagnosis/rollback difficulty |

## Proposed module boundaries for path B

Keep the existing backend/shared packages. During migration use a temporary sibling web workspace (provisional path `packages/kyoushitsu-next`), with an explicit retirement milestone. Final naming can return to Kyoushitsu at cutover. Avoid a Vue/React component bridge inside a live room: it multiplies lifecycle ownership.

Within the new frontend:

- `app/`: composition root, router, QueryClient, session context, theme/i18n and error boundaries.
- `routes/`: home and `/bushitsu/$id`; parse route input, mount feature shells and declare allowed prefetch.
- `features/session/`: identity binding, admission and lifecycle controller.
- `features/room/`: room shell, realtime snapshot adapter, commands and queue integration.
- `features/player/`: imperative driver and React host; keep ArtPlayer/HLS/DASH initially.
- `features/baidu/`, `features/danmaku/`, `features/chat/`, `features/governance/`: feature orchestration, selectors and UI.
- `api/generated/`: deterministic Hey API output; no manual edits.
- `api/client` and feature query definitions: credentials/error normalization, key scope, retry and invalidation policy.
- `components/ui/`: owned shadcn primitives; no domain/API imports.
- `lib/`: only genuinely shared pure utilities, not a second orchestration hub.

Dependency direction: routes compose features; feature UI calls controllers/query adapters; controllers depend on narrow transport/player ports and Kousoku contracts. Generated transport never imports UI. Reuse pure algorithms first in place; create a shared core package only for logic demonstrably consumed by both frontends during migration.

## Data flow

1. Restore identity with a cookie-authenticated HTTP resource. Validate route input.
2. Create a room-scoped session; connect WS and wait for `NYUUSHITSU entered` before protected bootstrap/commands.
3. Feed accepted room events into a single realtime snapshot/controller. Update it before driving playback effects.
4. HTTP resources use Query; session bootstrap results enter the realtime controller through guarded commands where they overlap WS-owned fields.
5. UI consumes selectors and resource status. Local preferences remain local. Player time/render callbacks do not invalidate resource queries or rerender the whole room.

Use a small external session store with React subscription bindings (for example `useSyncExternalStore`) rather than adding a second general state library by default. Selector subscription and render frequency require validation; this is a bounded implementation choice, not a demand for a generic framework.

## OpenAPI and client generation

Prefer backend-owned schema/export as the contract source, reusing existing TypeBox models. Inventory every web-consumed operation: identity, site-config, room/queue, Baidu, danmaku. Include success and error statuses, nullable fields, unions, parameters and cookie authentication. Separate JSON SDK operations from media streaming/redirect behavior; preserve existing media URLs and browser handling.

Generation should consume a local reproducible OpenAPI artifact, require no credentials or live upstream service, and not start listeners or mutate the normal database. Current Housou entrypoint imports DB initialization, so contract export isolation is part of the spike. Pin the tested generator/plugin versions and commit generated output with a regeneration diff check. Do not add a second handwritten HTTP DTO model beside generated DTOs; map to shared Kousoku domain types only at explicit boundaries where needed.

Do not assume current online docs match installed packages. The spike must establish exact compatible Elysia/OpenAPI/Hey API/React/Vite/Tailwind versions and browser requirements before changing dependencies.

## Styling and compatibility

Map existing semantic/room tokens into Tailwind and shadcn variables. Preserve theme storage keys, translated text, user-visible routes and the established cinema/mobile layout. Keep ArtPlayer selector overrides and fullscreen-root rules in owned CSS; Tailwind need not replace all CSS.

Replace primitives by behavior: focus return, Escape, disabled/pending states, touch targets and portal container. A portal defaulting to document body can disappear outside the native fullscreen subtree; player dialogs/overlays must target the owned fullscreen container.

## Rollout and rollback

Run old/new frontends against the same compatible backend in development, one frontend root per browser session. Keep old workspace/build available through parity validation. Production cutover is a future deployment decision: swap the frontend entry/build while preserving `/` and `/bushitsu/:id`, origin/cookie behavior and media paths. Roll back by serving the old frontend artifact. Additive contract changes should remain compatible with it; database migrations are not part of this plan.

Deferred details: tested dependency pins, baseline failures, exact rollout mechanism and residual visual review after the actual environment is inspected. The budget is an estimate and implementation requires separate authorization. None blocks the current plan/spec deliverable.
