# Research: Portable reuse boundary for the sibling React app

- Query: Choose the smallest explicit reuse surface for the existing M2 SDK/resources and framework-free entry helpers without coupling React to Vue/Eden/server App or duplicating generated DTOs.
- Scope: internal source/configuration research; narrow comparison of existing-workspace subpaths and a new shared core workspace.
- Date: 2026-09-26

## Findings

### Recommendation

For M3, **expose explicit portable subpaths from `houkago-kyoushitsu`**. Keep
the SDK, OpenAPI, resource policies, translations and Warm Club CSS at their
existing paths. Add one handwritten HTTP barrel that excludes Eden, and change
one framework-workspace alias to a relative import. Extract the existing
site-config loader/title into a pure sibling module to share its fallback
contract while preserving the Vue API. No generated file move, generated
output copy, shared core package or TS/Vite alias to the whole Vue source tree
is needed.

This is a bounded migration dependency: React depends on selected pure modules
owned by the existing frontend workspace, not its application entry. Record
this deliberate interim direction for M6 retirement. A separate framework-free
workspace is appropriate when ownership must outlive Vue retirement; extracting
it now requires avoidable generator/drift/spec/test moves and does not solve a
runtime coupling that the current pure module closure already avoids.

### Evidence and actual dependency closure

| File / source anchor | Observed pattern |
| --- | --- |
| `packages/kyoushitsu/package.json:1-12` | Private source workspace with no current `exports` map or package-root module entry. Existing Vue uses its own local paths. Repository search found no source consumer importing the package root. |
| `packages/kousoku/package.json:6-12`; `packages/kokuban/package.json:6-12` | Existing monorepo convention exports TypeScript source directly and uses noEmit typechecking; a new build-to-dist library is unnecessary. |
| `tsconfig.base.json:4-16` | Strict TS, moduleResolution bundler, isolated modules, noEmit; supports typed source package exports. |
| `packages/kyoushitsu/tsconfig.json:5-12`; `env.d.ts:1-6` | Vue-local `@/* -> src/*` and Vite client typing. Imported sibling modules are checked under the React compiler options, not automatically the sibling tsconfig. React should include vite/client typing but not this Vue declaration file. |
| `packages/kyoushitsu/src/api/index.ts:1-16` | Mixed barrel instantiates Eden and imports server `App`, then reexports M2 modules. It is not a portable public entry. |
| `packages/kyoushitsu/src/api/http-client.ts:1-2,36-55,105-107` | Only portable-closure alias leak is `@/lib/housou-url`. Remaining imports are local generated client. Module automatically configures a singleton; root can then explicitly configure approved origin/cookies. |
| `packages/kyoushitsu/src/lib/housou-url.ts:1-7` | Vite/browser helper, no Vue import; uses `VITE_HOUSOU_URL` or current hostname:3000. Works for both Vite apps with vite/client types. Not a general SSR library. |
| `packages/kyoushitsu/src/api/resources/http.ts:1-39,50-85` | Uses local generated SDK/DTOs and handwritten normalization, keys. No Vue, server App or external transport runtime. |
| `packages/kyoushitsu/src/api/resources/keys.ts:1-2,121-134` | Operation IDs inferred from generated SDK; private cache ports framework-independent. |
| `packages/kyoushitsu/src/api/resources/policy.ts:28-51,189-201` | Pure constants/functions, not QueryClient-bound. React owns Query binding. |
| `packages/kyoushitsu/src/api/generated/client.gen.ts:3-4`; `sdk.gen.ts:3-5`; generated client/core files | Generated transport imports are relative within the generated tree; no server/framework import or separate installed client-fetch runtime. SDK functions use configured singleton unless given a client option. |
| `packages/kyoushitsu/src/i18n/index.ts:1-9`; `messages.ts:1-47` | Pure typed translation lookup and data, including identity/home labels; safe to export intact. |
| `packages/kyoushitsu/src/lib/room-id.ts:5-11` | Pure normalization of input/URL to trailing segment; not an existence/admission validator. |
| `packages/kyoushitsu/src/lib/theme.ts:1-9` | Framework-free `warm-club` constant/root attribute helper; no runtime DOM access until called. |
| `packages/kyoushitsu/src/assets/theme.css:1-214,216-245` | One shared token source plus global typography/focus/reduced-motion rules. Import it once into each separate document; no token duplication or global Vue stylesheet edits. |
| `packages/kyoushitsu/src/lib/site-config.ts:1-12,47-50` | Contains Vue inject and InjectionKey even though loader/title helpers are mostly pure. Do not expose/import this mixed module from React. |
| `packages/kousoku/src/site-config.ts:65,87-101`; `src/index.ts` | Existing canonical site normalization/defaults already exported from a framework-free workspace; React can reuse these without importing Vue configuration injection. |

Recommended graph:

```text
React workspace composition / query adapters
  -> houkago-kyoushitsu/http             (handwritten portable barrel)
     -> api/http-client -> lib/housou-url + api/generated/client.gen
     -> api/resources/{http,keys,policy} -> api/generated SDK/DTOs
  -> houkago-kyoushitsu/http/generated   (DTO types; SDK only behind resource adapters)
  -> houkago-kyoushitsu/{i18n,room-id,theme,theme.css}
  -> houkago-kousoku                    (canonical site configuration)

Vue app -> existing local api/index -> Eden + server App type
Vue app -> existing Pinia/router/components and same local pure modules

Housou export -> authoritative OpenAPI -> page OpenAPI -> one generated tree
```

There is no runtime bridge between documents. Approved same-window navigation
from React to Vue destroys the React tree and its QueryClient; backend cookies
carry identity. Neither Query cache nor origin-local localStorage transfers to
another frontend port.

### Exact proposed product changes

1. `packages/kyoushitsu/package.json`: add the following explicit exports. Do
   not add a root `.` export pointing at the mixed Eden barrel or an unrestricted
   `./src/*` wildcard. React adds `"houkago-kyoushitsu": "workspace:*"` and
   `"houkago-kousoku": "workspace:*"`; it does not declare Vue, Pinia, Eden or
   Housou as its own dependencies.

```json
"exports": {
  "./http": "./src/api/public.ts",
  "./http/generated": "./src/api/generated/index.ts",
  "./i18n": "./src/i18n/index.ts",
  "./room-id": "./src/lib/room-id.ts",
  "./theme": "./src/lib/theme.ts",
  "./theme.css": "./src/assets/theme.css",
  "./site-config": "./src/lib/site-config-core.ts"
}
```

2. Add handwritten `packages/kyoushitsu/src/api/public.ts` exporting precisely
   `./http-client`, `./resources/http`, `./resources/keys`, `./resources/policy`.
   It must not reexport `./index`, Vue injection, stores, room views or framework
   bindings. Leave old `api/index.ts` behavior intact; duplicated export lines
   are harmless and avoid changing the Vue compatibility path.
3. `packages/kyoushitsu/src/api/http-client.ts:1`: change the import from
   `@/lib/housou-url` to `../lib/housou-url`. Otherwise a React-local `@` alias
   resolves this import to React's own source, or fails; package exports do not
   apply the exporting workspace tsconfig. No alias adjustment is necessary in
   generated files, keys, policies, i18n, room-id or theme. Keep React `@` scoped
   solely to its own source; do not add kyoushitsu Vite/TS aliases.
4. For M3 room creation, add a small typed `createRoom` resource adapter in
   `packages/kyoushitsu/src/api/resources/http.ts` using generated `roomCreate`,
   `RoomCreateData["body"]`, `RoomCreateResponse`, `HttpRequestOptions` and
   `unwrapResult` just like the existing identity adapters. The SDK already
   generates roomCreate (`generated/sdk.gen.ts`); the current handwritten
   adapters do not wrap it. Put the non-replay mutation binding in React, and
   use existing `RESOURCE_POLICIES.command` (`policy.ts:137-148`), without
   initiating room bootstrap/realtime. Do not manually redefine a DTO or call
   the generated function directly from a component.

5. Extract the existing `SiteConfigFetcher`, result type, memoized
   `createSiteConfigLoader` and `applySiteConfigTitle` from
   `packages/kyoushitsu/src/lib/site-config.ts` into
   `packages/kyoushitsu/src/lib/site-config-core.ts`. This new module imports
   only canonical kousoku config. The old Vue module retains `SITE_CONFIG_KEY`
   and `useSiteConfig`, and imports/reexports pure helpers/types at their old
   API path. Existing Vue bootstrap/test imports remain unchanged. This
   extraction is justified by sharing the nontrivial one-request/fallback vs
   schema-rejection contract, rather than duplicating its two-framework policy.

React-specific Query adapters/composition, title-helper invocation, Tailwind
mapping and safe same-window Vue target construction stay in React. Use the
pure translator; add new feedback messages to its single source only when
required by approved entry behavior.

### Public configuration fallback: exact portability contract

`test/site-config.test.ts:20-57` proves one-request memoization, transport
fallback with a value-free warning, and invalid successful schema rejection
with **no** fallback warning. `site-config.ts:27-35` implements that split by
normalizing in the success branch of a paired `.then(success, failure)`;
normalization errors are not caught by its transport-rejection handler.
`.trellis/spec/frontend/site-configuration.md:69-72,91-93` additionally includes
empty data in the fallback boundary. Preserve these distinctions.

The current pure loader catches every fetch rejection. Generated
`fetchSiteConfig()` now rejects malformed/null/empty success as protocol errors,
so blindly passing it through the unchanged loader silently defaults malformed
payloads. Add a generic optional failure predicate to the pure loader (e.g.
third options argument `shouldFallbackOnFailure(error:unknown):boolean`), with
the current fallback behavior as default for unchanged Vue callers. React
fetcher returns `{data: await fetchSiteConfig(), error:null}` and supplies a
predicate accepting only transport/HTTP failures or a specific stable
empty-response reason. Other protocol/schema failures propagate to the React
config error boundary. Do not catch errors from `normalizeSiteConfig` into the
fallback branch. Cancellation must not become successful default data after
the owning scope is disposed.

The reason must be typed by handwritten HTTP code, never inferred from an
error message. There is a concrete generated-transport ambiguity:
`generated/client/client.gen.ts:120-145,155-160` turns 204/Content-Length:0 and
zero-byte JSON responses into `{}`. A literal JSON `{}` also becomes `{}`.
At `unwrapResult`, shape alone cannot identify a true empty body, and
classifying every empty object as fallback would hide invalid schema.

**Pin the implementation to a per-call injected fetch, not a global
interceptor.** It is supported in the checked generated API:
`client/types.gen.ts:13-25,56-66` makes `fetch?:typeof fetch` part of RequestOptions,
`sdk.gen.ts:7-13` derives SDK options from them, and
`client/client.gen.ts:42-46` prefers the per-call fetch to configured/global
fetch. `client/client.gen.ts:25` supplies `getConfig()`.

Implement only in handwritten `fetchSiteConfig()` and error normalization:

1. Capture `housouHttpClient.getConfig().fetch ?? globalThis.fetch` once per
   call. Make a scoped wrapper with a call-local empty-response marker; forward
   the generated original Request and any init unchanged to that captured fetch,
   so configured fake fetch, credentials and AbortSignal continue to work.
2. For successful responses only, mark status 204 or an actual
   `(await response.clone().text()).length === 0` as empty. Return the original
   Response untouched. Do not treat JSON `null`, literal `{}`, primitives or
   whitespace-only/malformed JSON as empty. Do not rely solely on a possibly
   inconsistent Content-Length header. No body data is logged or retained.
3. Call generated `siteConfig({...options, fetch:scopedFetch, throwOnError:false})`.
   After it returns fields, preserve abort first (including an aborted caller
   signal or normalized aborted result); only then, if the marker is set, pass a handwritten
   `HoukagoHttpError("protocol", genericMessage, response.status, "EMPTY_RESPONSE")`
   as the error into `unwrapResult`, retaining the result Request/Response for
   metadata. Otherwise call ordinary `unwrapResult` unchanged. This keeps
   `fetchSiteConfig` rejecting a typed protocol error; fallback belongs only to
   the React loader. The local marker distinguishes zero bytes from the
   generator's `{}` sentinel without editing generated parsing or duplicating
   DTOs. Failed clone reads, aborts or other failures follow normal errors;
   cancellation must never be overwritten by `EMPTY_RESPONSE`.
4. `normalizeHttpError` must recognize an existing `HoukagoHttpError`, preserve
   its kind/code/message/status and existing metadata, and fill missing
   response/request metadata from the result arguments. Its current
   `errorDetails(Error)` at `http-client.ts:109-112` drops code, so adding a code
   without this normalization branch would erase the typed distinction.
5. React config predicate accepts typed HTTP/network failures or precisely
   `{kind:"protocol", code:"EMPTY_RESPONSE"}`; all other protocol errors,
   aborted requests and normalization failures reject. Old Vue callers retain
   their existing raw-Eden empty-data fallback through unchanged reexports.

Narrow tests for implementation: zero-byte HTTP 200 with/without length header
and 204 reject `fetchSiteConfig` with `EMPTY_RESPONSE` plus exact response and
request metadata, then default once through React/core. `null`, `{}`, malformed
JSON, primitives and nonempty partial-schema reject with no fallback warning.
Include a lying zero Content-Length plus nonempty body case to prevent shape
sentinel fallback. Validate configured fake-fetch invocation, original
credentials and signal, no global client/interceptor mutation, network/HTTP
fallback, aborted request propagation, concurrent one-request memoization and
title projection. Existing identity/body protocol tests remain unchanged.

Warm Club CSS can be imported via `houkago-kyoushitsu/theme.css` before
React-owned Tailwind/theme bridge rules. Preserve its values/rules and apply
`applyTheme(document.documentElement)` before visible render. Tailwind Preflight
and global focus styling can alter inherited behavior inside the new document;
check the actual React home, and do not modify Vue globals to accommodate it.
Do not set package-wide `sideEffects:false`: CSS imports and the existing
HTTP-client configuration initializer have side effects.

### Generation, migration and rollback effects

Keep these generator contracts unchanged:

- `openapi-ts.config.ts:4-8`: page document remains
  `packages/kyoushitsu/openapi.json`, output remains
  `packages/kyoushitsu/src/api/generated`.
- `scripts/prepare-page-openapi.ts:1-2`; `scripts/verify-http-contract.ts:1-3`:
  existing default input/output paths remain the same.
- `scripts/check-contract-drift.ts:1-3,32-46,62-68`: same generated glob,
  protected auto-generated headers/DTO boundary and two-generation baseline.
- `packages/housou/test/http-contract.test.ts:116-145`: path-based drift fixture
  remains valid.
- `biome.json:18-20`: generated exclusions remain valid; portable handwritten
  barrel/adapter are linted normally.

The public barrel is handwritten **outside** generated output. Regeneration
must not overwrite it. Existing M2 tests and Vue source paths remain valid.
There is no generator change merely because another app imports an exported
subpath. A workspace dependency/exports change requires the normal lockfile
update during authorized implementation; dependencies were not installed here.

Rollback is the old Vue dev/build path and ordinary navigation at 5173; it has
no requirement to run React. The export map, relative import fix and normalized
create adapter are additive to existing consumers. Removing React later needs
no generator rollback. At M6, migrate these public subpaths to a standalone
core workspace if Vue deletion is approved, keeping the same one-tree contract
generation and enforcing a single ownership transfer then.

### Narrow comparison

| Option | Effects | Decision |
| --- | --- | --- |
| Explicit existing kyoushitsu subpaths | One export map, one pure barrel, one alias fix, one create adapter and one config-core extraction with narrow error distinction; SDK paths/tests/drift unchanged. Package dependency still contains Vue app dependencies, but selected runtime/TS module graph does not. | Recommended for M3. |
| New framework-free core workspace | Move generated tree/resources/helpers/CSS, change generator/page document/drift paths and fixtures, exclusions/spec anchors; switch old consumers or retain forwarding modules; add independent manifests/tsconfig/tests. | Useful for final app retirement ownership, unnecessary M3 scope expansion. |

Do not copy the generated tree into React and do not declare a false dependency
direction by reexporting the mixed Vue barrel through a newly named core.

### Validation implications

- Existing focused M2 fake-fetch suites cover origin/cookies/AbortSignal,
  typed HTTP normalization and private lifecycle. Rerun them after the relative
  import/create adapter change. Add meaningful adapter coverage for one create
  request/body, success ID, typed failure and cancellation/no replay.
- React strict typecheck must consume package **subpaths**, with its own
  vite/client and DOM typing and no inclusion of Vue `env.d.ts`. A typed DTO
  assignment/use plus the real React production build validates portability
  more usefully than a snapshot of the export-map JSON.
- Existing `packages/kyoushitsu/test/site-config.test.ts` must still pass through
  its old Vue-module reexports. New generated-fetch/core integration tests must
  demonstrate the fallback/rejection split above, rather than only mock an
  already-classified error.
- Inspect the build module graph for no `.vue`, `vue`, `pinia`, Eden or Housou
  server module reached by React. The dependency manifest alone is not runtime
  graph evidence. An explicit automated forbidden-import closure guard is a
  useful durable boundary test if implemented; it must inspect the exposed
  transitive closure rather than grep all kyoushitsu files, which intentionally
  still contain Vue.
- Run contract drift to prove no generated content changed, both app builds,
  aggregate lint/typecheck/tests, focused React entry browser checks and old
  Vue entry checks. Add React tests to the root explicit test-directory list.
- Browser checks verify theme/global styles and approved same-window cookie
  handoff; package reuse alone does not establish account isolation or visual
  parity. See `research/browser-validation.md` for the bounded matrix.

### Related specs / external references

- `.trellis/spec/frontend/http-contract-resources.md:11-12,32,47-50,69-76,139-141`: generator ownership, local transport, canonical response types, cookie/error/abort semantics and strict DTO fixtures.
- `.trellis/spec/frontend/quality-guidelines.md:44-48`: components use the API boundary, not raw fetch; framework/domain boundaries remain separate.
- `.trellis/spec/trellis-plus/index.md:94-138`: focused browser and diagnostic evidence.
- External documentation was unnecessary for this focused module/path decision; evidence is the checked project config and actual source imports. No dependency-version recommendation is made here.

## Caveats / Not Found

- No product files, generation scripts, dependencies, services, runtime config,
  Git state or other research files were changed by this investigation.
- Source-subpath portability is recommended from inspected imports/config, not
  a executed React compilation: the sibling app is not implemented yet.
- `housouUrl` is Vite/browser-specific; this surface intentionally supports
  parallel browser apps, not SSR/server consumers.
- No public path exports the Vue site-config injection module, nickname/chat preferences,
  room/player implementation, or server App type. React may import canonical
  kousoku config independently without inventing new HTTP DTOs.
