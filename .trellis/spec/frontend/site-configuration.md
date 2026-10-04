# Public Site Configuration Contract

## 1. Scope / Trigger

Use this contract whenever changing `config/config.toml`, the public deployment
identity, entry-floor copy, the empty-name room default, `GET /site-config`, or
Kyoushitsu bootstrap configuration.

This is a public presentation boundary, never a secret store. OAuth credentials,
credential encryption keys, CORS, ports, database paths, Komon controls, and
other operational values remain in `.env` or their existing owner.

## 2. Signatures

```ts
// houkago-kousoku
normalizeSiteConfig(value: unknown): SiteConfig
DEFAULT_SITE_CONFIG: DeepReadonly<SiteConfig>

// houkago-housou
loadSiteConfig(source?: string): SiteConfig
GET /site-config -> SiteConfig

// houkago-kyoushitsu-core
createSiteConfigLoader(fetcher, warn?, options?: { shouldFallbackOnFailure?: (error: unknown) => boolean }): () => Promise<SiteConfig>
applySiteConfigTitle(config, target?): void
```

The REST response schema is `SiteConfigSchema` from `houkago-kousoku`. Housou
registers it as the Elysia response schema. React uses the generated
`fetchSiteConfig` resource rather
than component-owned raw `fetch`. The pure loader/title/types live in
`packages/kyoushitsu-core/src/config/site-config-core.ts`, exported through
`houkago-kyoushitsu-core/site-config`.

## 3. Contracts

`config/config.toml` is the one tracked, editable, public source:

```toml
[site]
name = "社团活动室"
# subtitle = "Houkago"
# browserTitle = "社团活动室"

[entry]
floorCode = "2F"
floorLabel = "社团活动楼层"
hint = "灯光已留好，等你和同伴入座。"
privacyNote = "这里不会展示其他教室。请使用收到的教室号码或邀请链接。"
defaultBushitsuName = "新部室"
```

- Objects are strict: unknown root, `[site]`, or `[entry]` keys are invalid.
- Required visible strings are 1–256 characters, already trimmed, single-line,
  and contain no C0/C1 controls or Unicode line separators.
- `site.subtitle` is optional and normalizes to `null`; an empty string is not
  an omission and is invalid.
- `site.browserTitle` is optional and normalizes to `site.name`.
- The normalized object and its nested objects are frozen. Consumers receive
  `DeepReadonly<SiteConfig>` and do not mutate it.
- Housou resolves the canonical file relative to the loader module, parses it
  once with `Bun.TOML.parse`, normalizes it before the app listens, and reuses
  the frozen singleton for every request.
- `GET /site-config` is unauthenticated and returns exactly `SiteConfig` with
  `Cache-Control: no-store`. Never return the raw TOML object, `process.env`, or
  an open-ended configuration record.
- React AppRuntime memoizes the config bootstrap through its public resource
  boundary, sets `document.title`, and exposes immutable identity/copy/default
  room name. No component owns another request or room config store.
- Home renders `site.name` once as the masthead's semantic h1, with the compact
  masthead type scale and wrapping for long configured names. The lower
  intro retains the optional subtitle without a duplicate site name.
- Home renders `entry.hint` once as the classroom figure caption. Do not repeat
  this configurable hint below the invitation or as a footer closing line.
- Allowed transport rejection or empty response uses
  `DEFAULT_SITE_CONFIG` and one value-free warning. A successful but invalid
  response rejects bootstrap; it must not silently fall back and hide contract
  drift.
- React supplies `shouldFallbackOnFailure(error)` to keep typed protocol/abort
  failures distinct: HTTP/network or `protocol` + `EMPTY_RESPONSE` may default.
  The resource distinguishes actual zero bytes/204 from `{}`, JSON null,
  primitives and malformed JSON before the generated parser can collapse them.
  The latter successful invalid bodies reject, and abort never becomes fallback.
- Changes require a Housou restart and browser refresh. There is no polling,
  watcher, live editor, per-room branding, JSON/YAML mirror, or config-path
  override in this contract.

Design decision: Firefly supplied the strict single-source/public-secret model,
but not the delivery mechanism. Firefly is static Astro and embeds config at
build time; Houkago's independently running Housou and Kyoushitsu use a typed
runtime projection so public copy changes do not require a frontend rebuild.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| missing or unreadable tracked TOML | Housou startup throws with source and `/`; no listener |
| malformed or duplicate TOML | startup throws `malformed TOML`; do not echo values |
| unknown/missing field or unsafe text | startup throws with source and TypeBox field path |
| valid omitted subtitle/browser title | normalize to `null` / `site.name` |
| secret sentinel exists in environment | serialized route contains neither name nor value |
| allowed transport rejection or actual empty body | frontend uses shared default and generic warning |
| successful response violates schema | frontend bootstrap rejects; no fallback warning |
| React actual zero bytes/204 | typed `EMPTY_RESPONSE`, then one default warning |
| React literal `{}`/null/primitive/malformed successful JSON | protocol failure; no fallback |
| React aborted request | preserve typed abort/metadata; no fallback warning |
| config request is called repeatedly | return the same memoized promise/result; one network request |
| default or long custom name at desktop/375px | readable layout with no horizontal overflow; default title stays on one line |

Error messages may name the source and invalid field. They must not include the
full TOML value, environment value, response body, or transport exception text.

## 5. Good / Base / Bad Cases

- Good: edit the tracked TOML with a non-empty public activity-room name,
  optional subtitle, floor copy, and default room name; restart Housou and
  refresh the browser.
- Base: omit `subtitle` and `browserTitle`; the page renders `社团活动室` without
  a second identity line and uses the name as the browser title.
- Bad: add an OAuth key or CORS origin, invent an unknown key, use an empty or
  multiline title, expose the raw parse tree, make each component fetch config,
  or catch a valid HTTP response's schema failure and silently default it.

## 6. Tests Required

- `packages/kousoku/test/site-config.test.ts`: defaults, optional normalization,
  deep freeze, strict unknown/missing fields, and unsafe visible text.
- `packages/housou/test/site-config.test.ts`: tracked file, explicit fixtures,
  malformed/duplicate TOML, source/field diagnostics without value leakage,
  exact response, `no-store`, and environment-secret sentinel exclusion.
- `packages/kyoushitsu-core/test/site-config.test.ts`: success normalization,
  one-request memoization, transport fallback and value-free warning, invalid
  successful response rejection, and browser title application.
- `packages/kyoushitsu-react/e2e/entry.spec.ts`: default name/no subtitle/title,
  custom long identity and subtitle, configured entry copy/default room POST,
  desktop/375px single-line default title, and no horizontal overflow.
- Run the full repository tests, all package type checks, lint, Kyoushitsu
  build, entry Playwright projects, and existing room desktop/phone regressions.

## 7. Wrong vs Correct

### Wrong

```ts
// Leaks an open-ended source and hides a server/client contract mismatch.
app.get("/site-config", () => ({ ...Bun.TOML.parse(source), ...process.env }))
const config = await rawFetch().catch(() => localDefaults)
```

### Correct

```ts
const siteConfig = loadSiteConfig() // strict, normalized, frozen startup value
app.get("/site-config", () => siteConfig, { response: SiteConfigSchema })

// AppRuntime owns the signal and typed fallback predicate.
const config = await createSiteConfigLoader(
  async () => ({ data: await fetchSiteConfig({ signal }), error: null }),
  console.warn,
  { shouldFallbackOnFailure: shouldFallbackConfig },
)()
// Only transport/empty-response failure defaults; invalid success rejects.
```
