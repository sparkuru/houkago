# Research: Firefly site configuration as a Houkago reference

- Query: How does `/home/wkyuu/cargo/repo/11-firefly` implement public TOML
  site configuration, where are its secret and runtime boundaries, and which
  parts should Houkago reuse for `config/config.toml`?
- Scope: internal comparison of Firefly and Houkago; no external network
  research
- Date: 2026-08-30

## Findings

### Executive recommendation

Reuse Firefly's **strict public configuration contract**, not its delivery
mechanism.

Firefly is a static Astro publication (`apps/site/astro.config.mjs:22-25`). It
loads and freezes the TOML during module import
(`apps/site/src/lib/site-config.mjs:247-263,308-325`) and directly embeds the
values into generated HTML (`apps/site/src/pages/index.astro:47-54`). Its own
contract explicitly says that the browser never fetches configuration
(`.trellis/spec/frontend/site-configuration-contract.md:145-153`). Build-time
loading is therefore natural there.

Houkago instead runs Kyoushitsu and Housou as separate processes
(`dev.sh:90-100`), derives the Housou origin at browser runtime
(`packages/kyoushitsu/src/lib/housou-url.ts:1-7`), and already routes all REST
calls through a typed Eden Treaty client (`packages/kyoushitsu/src/api/index.ts:5-10`).
Build-time injection would couple deployment branding to every Kyoushitsu
rebuild and create a second config-loading path. Houkago should therefore:

1. read `config/config.toml` once when Housou starts;
2. fail Housou startup on a missing, malformed, or semantically invalid file;
3. expose only the validated public projection through an unauthenticated,
   typed `GET /site-config` route;
4. have Kyoushitsu load it once through Eden before mounting, set
   `document.title`, and retain the resulting immutable value for the page
   lifetime;
5. use a shared default (`社团活动室`) only when Housou is unreachable, so a
   configuration outage does not leave a blank entry page.

This preserves the approved boundary: public presentation values live in TOML;
OAuth credentials, encryption keys, database/CORS/port controls, and other
operational environment values remain in `.env`.

### Firefly schema and defaults

Firefly's tracked template states its boundary in the file itself: every value
is public and embedded into the static publication
(`config/site.toml.example:1-2`). It groups values by concern:

- `[site]`: name, description, language, optional public URL and author
  (`config/site.toml.example:4-14`);
- `[terminal]`: public UI identity and optional link records
  (`config/site.toml.example:16-36`);
- `[seo]`: title suffix, robots, Twitter card, optional image
  (`config/site.toml.example:38-46`);
- `[plugins.comments]`: only activation and a repository-relative config path,
  not the plugin's private runtime settings (`config/site.toml.example:48-54`).

The parser uses strict nested Zod objects
(`apps/site/src/lib/site-config.mjs:163-196`). Optional values are normalized at
the schema boundary; for example omitted URL/author/image become `null`, while
friends default to an empty list (`site-config.mjs:128-136,147-161,163-190`).
The result is recursively frozen (`site-config.mjs:198-203,258-262`).

For Houkago, a bounded public shape is preferable to moving all translations:

```toml
[site]
name = "社团活动室"
# Optional; omitted means no second identity line.
# subtitle = "Houkago"
browserTitle = "社团活动室"

[entry]
floorCode = "2F"
floorLabel = "社团活动楼层"
hint = "沿着安静的走廊，前往你已经约好的教室。"
privacyNote = "这里不会展示其他教室。请使用收到的教室号码或邀请链接。"
defaultBushitsuName = "新部室"
```

These fields replace the deployment-specific constants currently in
`packages/kyoushitsu/src/i18n/messages.ts:5-11,49` and their Home consumers in
`packages/kyoushitsu/src/views/HomeView.vue:77,146-154`. Authentication labels,
actions, pending/error text, and ordinary translated prose should remain in the
i18n catalog; the frontend spec already forbids new visible component strings
outside that catalog (`.trellis/spec/frontend/component-guidelines.md:402-403`).
An optional subtitle should be omitted rather than represented as a fake TOML
null or a required empty string, matching Firefly's omission rule
(`site-configuration-contract.md:89-94,134-143`).

### Path resolution

Firefly supports an optional `FIREFLY_SITE_CONFIG_PATH`, but accepts only a
trimmed repository-relative `.toml` path with safe segments. It rejects absolute
paths, traversal, backslashes, missing/non-regular files, symlinks, and paths
whose real path escapes the repository (`apps/site/src/lib/site-config.mjs:22-55`).
Without an override it checks known current-working-directory/source-root
candidates (`site-config.mjs:13-27,58-59`). Its container wrapper repeats the
same containment checks before entering Docker (`sam:128-159`) and bind-mounts
the owner-local file read-only (`sam:326-334`).

Houkago does not need that whole override system for this slice. Both development
servers run inside the repository bind mount (`dx:43-50`), Housou package scripts
run from `packages/housou` (`packages/housou/package.json:10-14`), and the user
named one canonical location: `config/config.toml`. Resolve that location from
the loader module's `import.meta.url`, not only from `process.cwd()`. This avoids
Firefly's multiple-candidate complexity and prevents a package working directory
from changing which file is read. If a future deployment needs an override,
add one later with Firefly's contained regular-file rules; do not accept an
arbitrary absolute environment path by default.

A tracked `config/config.toml` is the best fit for Houkago's current clone and
test flow. Firefly intentionally ignores the active file and tracks only an
example (`.gitignore:21`; `readme.md:125-127`), which requires an owner setup
step. Houkago currently has no site-config setup step and all tests import the
real app (`packages/housou/test/rest.test.ts:1-8`). Tracking the safe default
keeps clones and tests runnable. Do not also maintain a second editable JSON,
YAML, or TOML example; Firefly explicitly rejects multiple config sources of
truth (`site-configuration-contract.md:134-143`).

### Parsing, validation, and startup failure

Firefly parses with `smol-toml` 1.8.0
(`apps/site/package.json:24-33`). Read failures, TOML syntax errors, and semantic
errors are wrapped with the source path; semantic errors include joined field
paths (`apps/site/src/lib/site-config.mjs:205-210,247-257,308-323`). Unknown keys
are rejected because the schemas are strict (`site-config.mjs:163-196`). The
module-level `SITE_CONFIG = loadSiteConfig()` means invalid configuration stops
the build/import before rendering (`site-config.mjs:325`).

Reuse those properties in Housou:

- one TOML parser (`smol-toml` is already proven under Firefly; no second JSON or
  YAML reader);
- strict objects with `additionalProperties: false`;
- non-empty, trimmed, single-line public strings; reject controls and line
  separators for all values rendered into text/title;
- error messages containing the source and field without echoing full values;
- deep freeze (or an equivalently immutable readonly object) after validation;
- module/startup-time loading so Housou never serves a partially defaulted custom
  file.

Houkago already shares TypeBox schemas through `houkago-kousoku`
(`packages/kousoku/src/index.ts:1-5`) and requires domain/REST types to live there
(`.trellis/spec/frontend/type-safety.md:9-23,32-41`). Define the public
`SiteConfigSchema`, derived `SiteConfig` type, and fallback default in Kousoku;
validate the parsed TOML in Housou using that single schema. The existing code
already uses strict TypeBox objects extensively, e.g.
`packages/kousoku/src/domain.ts:56-78`, and validates untrusted values with
`Value.Check`, e.g. `packages/housou/src/lib/danmaku-content.ts:21-23`.

Do not copy Firefly's very broad URL/path/SEO validators into this text-only
slice. Add field-specific validation only for fields actually exposed by
Houkago. The loader should still have direct unit tests with an explicit fixture
path, so negative tests do not mutate the tracked deployment file.

### Public versus secret and runtime boundary

Firefly keeps the boundary explicit at three levels:

- the site contract says the public config is never a secret store
  (`.trellis/spec/frontend/site-configuration-contract.md:7-12`);
- the static site reads only a plugin's public projection, deliberately excluding
  SMTP/runtime fields (`apps/site/tests/site-config.test.mjs:80-120,122-172`);
- the private service rejects non-secret settings in `secrets.env`, requires a
  regular non-symlink owner-readable file, and rejects group/other permissions
  (`services/comments/src/config.ts:40-62,64-115`). Literal passwords in TOML are
  explicitly forbidden in favor of an environment variable name
  (`plugins/comments/config.mjs:281-297,361-362`).

The relevant reuse for Houkago is the **projection rule**, not Firefly's plugin
and secrets-file machinery. The new route must construct/return the validated
public `SiteConfig` type only. It must never serialize `process.env`, the raw TOML
parse tree, or an open-ended generic config object. Existing secrets and
operational values remain where they are:

- Baidu client secret and credential key are documented in `.env.example:1-8`;
- Housou currently reads CORS and port/runtime environment values in
  `packages/housou/src/lib/origin.ts:1-11` and
  `packages/housou/src/index.ts:46-53`;
- the browser receives only an already-typed REST surface through Eden
  (`packages/kyoushitsu/src/api/index.ts:5-10`).

No secret-file permission parser, plugin namespace, arbitrary private path, or
environment migration is warranted for this task.

### API exposure and frontend loading/caching/fallback

Firefly has no runtime configuration API. Astro imports `SITE_CONFIG` while
building (`apps/site/src/pages/index.astro:11,47-54`; layouts consume it at
`apps/site/src/layouts/DocumentLayout.astro:4,23-48` and
`apps/site/src/layouts/TerminalLayout.astro:4,24-52`). Some public values are
encoded into static `data-*` attributes
(`apps/site/src/components/TerminalHome.astro:33-40,63-70`), then decoded by
browser enhancement; no browser configuration request or runtime cache exists.
Static output tests assert the embedded result
(`apps/site/tests/static-output.test.mjs:180-220,596`).

For Houkago, add a small unauthenticated route before the existing route groups
in the Housou app composition (`packages/housou/src/index.ts:14-41`). Its response
schema should be the shared Kousoku schema so Eden carries the exact type into
Kyoushitsu. Return the same frozen startup object for every request. A conservative
HTTP policy is `Cache-Control: no-store`: the object is already process-cached,
the client requests it only once, and operators should not receive an old brand
after restarting/redeploying. If conditional HTTP caching is later needed, add
an explicit version/ETag rather than a long max-age.

Kyoushitsu should use a small generic config loader in `src/lib/` or `src/api/`,
not a room/session Pinia store. The project state contract reserves Pinia for
shared room/session truth and keeps presentation state outside it
(`.trellis/spec/frontend/state-management.md:19-49,220-233`). The loader should:

1. memoize one promise per page load;
2. call `housou.siteConfig.get()` (or the exact Eden route name), never raw
   `fetch`, per `.trellis/spec/frontend/hook-guidelines.md:48-57`;
3. return the shared default and log a value-free warning if the network/route
   fails;
4. complete before `createApp(...).mount(...)` in
   `packages/kyoushitsu/src/main.ts:1-10`, then set `document.title` and expose the
   immutable config to Home;
5. leave `packages/kyoushitsu/index.html:1-7` with the same safe default title
   (`社团活动室`) so there is no old Houkago title before JavaScript starts.

Waiting before mount prevents the current fixed identity from flashing before a
custom identity arrives. The fallback is for **transport unavailability only**;
malformed deployment config must already have stopped Housou. Configuration is
not hot-reloaded: editing the TOML requires a Housou restart and browser reload.
This is clearer and safer than a watcher or polling loop.

### Tests and documentation to reuse

Firefly's strongest reusable pattern is its negative test matrix:

- valid values, normalization, and deep freeze
  (`apps/site/tests/site-config.test.mjs:53-78`);
- public-only projection that excludes runtime fields
  (`site-config.test.mjs:80-120,122-172`);
- contained-path and symlink rejection when an override exists
  (`site-config.test.mjs:174-204`);
- defaults and unsafe/unknown field rejection
  (`site-config.test.mjs:206-278`);
- malformed/duplicate TOML and checked-in-template validation
  (`site-config.test.mjs:280-332`);
- built-output assertions that prove the visible title and metadata follow the
  config (`apps/site/tests/static-output.test.mjs:180-220`).

Houkago should cover:

- shared schema/default contract and optional subtitle omission;
- valid tracked `config/config.toml` and explicit temporary fixture loading;
- missing file, malformed/duplicate TOML, unknown key, missing field, empty or
  multiline/control-containing text, and source/field diagnostics;
- `GET /site-config` exact public response with secret-sentinel environment
  values absent;
- frontend success, transport fallback, one-request memoization, and browser
  title update;
- Home rendering with a custom name and no hard-coded `放学后 / HOUKAGO`;
- room creation with an empty name posting configured
  `entry.defaultBushitsuName`;
- existing unauthenticated/authenticated desktop and phone entry coverage. The
  current fixed-heading assertion is at
  `packages/kyoushitsu/e2e/entry-home.spec.ts:34-51` and must become a
  config-backed assertion.

Document `config/config.toml` as public, tracked, restart-required configuration;
document `.env` as the unchanged secret/operational boundary. Firefly gives a
good concise model in `readme.md:125-155`.

### Deployment integration

Firefly build tooling validates an optional override before Docker, mounts local
config read-only, and passes the override into the container (`sam:128-159,
293-299,323-348`). Its production runtime is static Nginx output
(`Dockerfile:24-45`), so config changes require rebuilding the publication.
Private plugin TOML and secrets are mounted read-only into a separate service
(`compose.yml:45-55`).

Houkago currently has no production Compose or Dockerfile in the repository.
Development uses the entire repository bind-mounted at `/app`
(`dx:43-50`), so `config/config.toml` is already visible and `dev.sh` needs no
new mount. Housou runs from source with `.env` loaded from the repository root
(`packages/housou/package.json:10-14`; verified by
`packages/housou/test/startup-config.test.ts:40-67`). The implementation should
add a startup test for the canonical TOML path and update the README with the
restart rule. A future production container must copy or read-only mount the
same exact path; do not add a different environment-serialized copy of the
public values.

### Reuse versus avoid

Reuse:

- one documented TOML source;
- strict nested schema and unknown-key rejection;
- field/source diagnostics without dumping values;
- explicit optional defaults and immutable normalized output;
- startup fail-fast for invalid deployment config;
- explicit public response projection;
- positive, negative, and visible-consumer tests;
- documentation beside the config defining public/secret ownership.

Avoid:

- Firefly's build-time embedding in a runtime-separated SPA/server;
- importing raw TOML or server filesystem APIs into Kyoushitsu;
- moving translations, OAuth keys, credential keys, CORS, database paths, ports,
  or Komon controls into the public TOML;
- exposing the raw parse tree or environment;
- an ignored active file plus mandatory copy step for the current clone-ready
  Houkago flow;
- multiple path candidates, arbitrary absolute overrides, plugin namespaces,
  or secrets-file permission machinery before Houkago has those requirements;
- silent server-side fallback when a present config is malformed;
- repeated per-component requests, long-lived HTTP caching, config polling, or
  hot reload in this slice.

## Files found

- `/home/wkyuu/cargo/repo/11-firefly/config/site.toml.example` — complete public
  build-time config template.
- `/home/wkyuu/cargo/repo/11-firefly/apps/site/src/lib/site-config.mjs` — path
  resolution, TOML parsing, strict validation, normalization, freezing, and
  import-time load.
- `/home/wkyuu/cargo/repo/11-firefly/apps/site/tests/site-config.test.mjs` — main
  positive/negative config contract tests.
- `/home/wkyuu/cargo/repo/11-firefly/apps/site/tests/static-output.test.mjs` —
  generated output follows config.
- `/home/wkyuu/cargo/repo/11-firefly/.trellis/spec/frontend/site-configuration-contract.md`
  — durable public/secret, validation, consumer, and test contract.
- `/home/wkyuu/cargo/repo/11-firefly/services/comments/src/config.ts` — strict
  secrets file and private runtime config boundary.
- `/home/wkyuu/cargo/repo/11-firefly/plugins/comments/config.mjs` — explicit
  public/runtime projections and literal-secret rejection.
- `/home/wkyuu/cargo/repo/11-firefly/sam` — pre-container path validation and
  read-only config mounts.
- `/home/wkyuu/cargo/repo/11-firefly/Dockerfile` and `compose.yml` — static
  publication runtime and private plugin deployment boundary.
- `packages/housou/src/index.ts` — Houkago Housou app composition/startup.
- `packages/kyoushitsu/src/api/index.ts` and `src/lib/housou-url.ts` — typed
  runtime REST and runtime Housou-origin boundary.
- `packages/kyoushitsu/src/main.ts`, `index.html`, `src/i18n/messages.ts`, and
  `src/views/HomeView.vue` — current bootstrap/title/hard-coded entry consumers.
- `dx`, `dev.sh`, and `packages/housou/package.json` — current development and
  startup config visibility.

## External references

- No network references were needed. Firefly's checked-in dependency evidence is
  Astro `7.1.6` and `smol-toml` `1.8.0`
  (`/home/wkyuu/cargo/repo/11-firefly/apps/site/package.json:24-39`).

## Related specs

- `.trellis/spec/frontend/hook-guidelines.md:48-57` — REST must use Eden Treaty,
  not raw `fetch`.
- `.trellis/spec/frontend/type-safety.md:9-23,32-41` — shared contracts belong in
  Kousoku and server responses are runtime-validated.
- `.trellis/spec/frontend/state-management.md:19-49,220-233` — presentation
  config is not room/session Pinia state.
- `.trellis/spec/backend/directory-structure.md:37-55` — Housou routes are thin
  and generic loader mechanics belong in `src/lib/`.
- `.trellis/spec/backend/error-handling.md:36-53` — typed/unexpected REST errors
  and no leaked internals.
- `.trellis/spec/backend/quality-guidelines.md:48-73` — strict schema-first I/O,
  Kousoku/Eden contract sharing, and no unchecked casts.

## Caveats / Not Found

- Firefly has no runtime site-config endpoint, client fetch cache, or network
  fallback to copy; those choices above are Houkago-specific inferences from its
  separate SPA/Housou architecture.
- Houkago has no production Dockerfile/Compose deployment contract yet. Only the
  existing `dx`/`dev.sh` source-run path can be verified locally.
- The exact endpoint spelling (`/site-config`) is a recommendation, not an
  existing contract.
- A shared fallback duplicates the tracked TOML's safe defaults. Keep a test
  asserting that the tracked file decodes to the shared default so the fallback
  cannot drift silently.
- Do not claim runtime config hot reload: the recommended model requires a
  Housou restart and browser reload.
