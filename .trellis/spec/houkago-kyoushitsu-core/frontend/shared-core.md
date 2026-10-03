# Shared Core Ownership and Exports

## 1. Scope / Trigger

Use this contract when relocating browser/domain modules, changing core exports,
or changing the browser SDK pipeline. Core is the shared implementation boundary
for React and independent browser/domain tests.

## 2. Signatures

Consumers use explicit manifest subpaths such as `http`, `room-session`,
`ws-client`, `kengen-policy` and `member-presence`; there is no package-root API.

```ts
projectMemberPresence(previous: Readonly<Record<string, BuinPresence>>,
  members: readonly PresentMember[], serverTime: number): Record<string, BuinPresence>
onlineMembers(presence: Readonly<Record<string, BuinPresence>>): BuinPresence[]
historicalMembers(presence: Readonly<Record<string, BuinPresence>>): BuinPresence[]
kengenPresetId(kengen: Kengen): "chat" | "playback" | "playlist" | null
```

`PresentMember` is the protocol's `SHUSSEKI` member. `BuinPresence` adds
millisecond `joinedAt`, `lastSeenAt` and boolean `online`. Formatting helpers
accept timestamps and labels; they own no timer or session state.

## 3. Contracts

### Package boundary

`houkago-kyoushitsu-core` owns framework-independent browser/domain logic.
Its runtime dependencies are `houkago-kousoku`, `houkago-kokuban` and
`@sinclair/typebox` for existing adapter-message validation. It imports no
React, Vue, Pinia, Eden, Housou server application, app component or hook.
ArtPlayer/HLS/DASH engines remain owned by the React player driver rather than
by the core's player port or synchronization controller.

Frontend consumers use explicit `houkago-kyoushitsu-core/<subpath>` exports.
There is no package-root barrel, wildcard export, legacy export alias or
framework injection wrapper. Core internals use relative imports; consumers'
`@` aliases never resolve into another package. Move shared implementation and
its pure tests together rather than retaining two production copies.

### Source ownership

| Directory | Responsibility |
| --- | --- |
| `src/api` | Generated browser SDK and handwritten HTTP/resources/keys/policies |
| `src/config` | Pure site-config loader/title and configured Housou URL |
| `src/i18n`, `src/theme` | Typed shared copy, browser theme behavior and semantic CSS tokens |
| `src/room`, `src/ws` | Room ID/admission/session, command permission helpers, queue resolution and transport client |
| `src/playback`, `src/media` | Player port, server-authoritative sync/clock/drift and source/subtitle/seek metadata |
| `src/provider`, `src/danmaku` | Adapter/OAuth/grant helpers and local file/selection/preference/timeline behavior |

The Housou URL uses explicit `VITE_HOUSOU_URL` first, otherwise browser hostname
with `VITE_HOUSOU_PORT` and the standalone fallback port 3000. Preserve preview
port configuration when relocating client code. Core reads public browser
configuration only; never put backend secrets into frontend inputs or logs.

### Presence and permissions

The immutable presence projection retains `joinedAt` for continuing members,
retains names/roles on departure with server-authored `lastSeenAt`, and starts
a fresh arrival time on rejoin. Online members sort by arrival; history sorts
by descending departure time. Consumers scope the projection to one session.
No REST polling or second socket is needed.

Presets contain chat `{true,false,false}`, playback `{true,true,false}` and
playlist `{true,true,true}` in chat/playback/playlist field order. Unmatched
combinations return `null` (custom). Preset controls send the existing host
command and display server echo; they never grant guest governance.

### Contract generation

Housou's `packages/housou/openapi.json` remains authoritative. The browser
subset lives at `packages/kyoushitsu-core/openapi.json`; generated code lives
at `packages/kyoushitsu-core/src/api/generated/`. Update the generator, subset
preparation/verification, drift script, Housou contract tests, Biome exclusions
and typed-contract tests together when paths change. Generated files remain
generator-owned. Retain the 46 browser operations and their wire/abort/error
contracts; do not import server types to restore transport typing.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Core imports UI framework, app alias or server application | Boundary check fails |
| Static/dynamic import, export, import-equals or require reaches forbidden source | AST check fails; computed runtime module names fail closed |
| React graph includes old Vue source, Vue/Pinia/Eden or server modules | Build graph check fails |
| Regenerated SDK differs | Drift fails; fix generator inputs rather than generated output |
| Member disappears / rejoins | Retain departure history / restart duration without mutating previous snapshot |
| Permissions match no preset | Show custom and retain all checkbox values |
| Running Vite cannot see a new manifest export | Restart task-owned preview; do not bypass the error overlay |

## 5. Good / Base / Bad Cases

- Good: all clients consume one pure projection with server-authored membership
  and permissions.
- Base: React imports `houkago-kyoushitsu-core/http`; operations retain the
  [HTTP resource contract](../../frontend/http-contract-resources.md).
- Bad: React imports old Vue source, both apps copy a helper, or the browser SDK
  imports Housou server types to repair transport typing.

## 6. Tests Required

Run through `./dx`: root lint/typecheck/test/contract:drift, core typecheck/test
and React production build. `tsconfig.contract.json` verifies generated DTO
record fidelity and discriminated unions separately from runtime Bun tests.
`test/package-boundary.test.ts` guards the actual source/manifest boundary,
including negative fixtures for alternate import forms and computed modules.
Inspect React's emitted `dist/module-graph.json` for forbidden transitive
framework/server dependencies; manifest checks alone do not prove the bundle.

Preserve real-cookie/WS browser evidence at desktop/phone and required tablet,
short/tall/cinema/fullscreen layouts. The neutral extraction changes module
ownership, not server authority, command permissions, route URLs, player
lifecycles, provider retention, subtitles or local preferences. M6 parity and
owner acceptance permitted retirement of the old app. Restoration uses the
recorded Git checkpoint rather than retained application source.

Presence tests assert immutability, ordering, rejoin timestamps, name retention
and formatting. Permission tests assert exact presets and custom combinations.
Runtime/browser tests assert server echo, guest exclusion, session reset and
online/history information on desktop and phone.

## 7. Wrong vs Correct

Wrong: `import { api } from "houkago-kyoushitsu/http"` or importing server
application types into generated browser code.

Correct: `import { api } from "houkago-kyoushitsu-core/http"`; regenerate DTOs
from the browser OpenAPI subset and retain framework bindings in apps.

Wrong: mutate previous presence entries or select a preset locally before echo.

Correct: assign a new projection from `SHUSSEKI` and render the authoritative
`KENGEN` snapshot after the host command.
