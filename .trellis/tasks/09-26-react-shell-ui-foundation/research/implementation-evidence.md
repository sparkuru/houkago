# M3 implementation evidence

## Compatible shell spike

Registry metadata inspected on 2026-09-26 using the npm registry through dx.
Exact pins: React/ReactDOM/types 19.3.0; Query 5.104.0 (React 18/19 peers);
Router 1.170.39 (React/DOM >=18, Node >=20.19); Tailwind/Vite plugin 4.3.3
(Vite 5–8 peers); React Vite plugin 6.1.1 (Vite 8 peer; Node >=20.19).
Existing resolved Vite 8.0.16 and Bun 1.3.14 are retained.

`./dx bun install`, React typecheck and React production build passed in the
minimal shell before feature work (15 modules). No old framework/toolchain pin
changed. Pinned shadcn CLI 4.21.0 registry sources for Button/Input/Label/Card/Alert
were inspected scoped to the new package. Owned primitives retain their native
semantics and Tailwind composition; only used variants are retained. Native
button/label avoid unnecessary Slot/Radix dependencies; cva 0.7.1, clsx 2.1.1
and tailwind-merge 3.7.0 are the actual helper dependencies. Warm Club tokens,
44px controls and shared focus outlines replace registry defaults. No theme
switch, generic palette, icon pack, form framework or remote font is introduced.

Validation results below are appended after implementation, not predicted.

## Current automation evidence

- `./dx bun run contract:drift`: passed; 59 operations, 46 browser operations,
  18 generated files byte-stable across two regenerations. Generated tree unchanged.
- `./dx bun run typecheck`: all seven workspace checks passed. Initial installation
  re-resolved old workspace `@types/bun:latest` to 1.4.2, creating distinct Elysia
  peer nodes and a legacy type failure. Restored original shared1.3.14 lock entries
  and verified `bun install --force --frozen-lockfile`; old version entries unchanged.
- `./dx bun run lint`: passed, 293 files at that stage.
- `./dx bun run test`: 460 passed, 0 failed, 2120 expectations across85 files
  (434 retained tests +26 new tests). Focused config/core Vue reexports also passed.
- `./dx bun run --filter houkago-kyoushitsu build`: passed445 modules; existing
  dashjs CommonJS/minified-source and large chunk warnings remain.

Browser, checker revisions and final checks are recorded below when executed.

- React production build passed444 transformed modules; emitted graph443 entries
  proves only explicit pure legacy subpaths are imported. No Vue/.vue/Pinia/Eden/
  Housou server/media engine entered React's graph; build guard rejects them.
  Lazy room handoff chunk is0.54kB; entry chunk494.13kB (151.67kB gzip).
- Old lock package entries were programmatically compared to HEAD: zero changed
  package values. New React/Tailwind dependencies are additive. Frozen reinstall
  retained original Bun types1.3.14 and existing toolchain versions.

## Browser commands / handoff to independent checker

The main session owns the isolated preview process and old Vue browser gates.
New React e2e and real-cookie are implemented; they have not yet been executed
at this handoff. Checker owns final product fixes and final browser execution,
so these are pending commands, not claimed results:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=entry-desktop --project=entry-phone
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5174 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu-react/playwright.config.ts --project=real-cookie
```

New mocked suite contains nine scenarios per viewport, diagnostic signed-out/
signed-in screenshots and layout/reduced-motion/contrast attachments. The last
contrast/reflow addition awaits final lint/typecheck. Real-cookie attaches its
backend WS frame observer before room submit and requires NYUUSHITSU entered;
no identity/room mocks, protected seeding or provider calls are introduced.

Do not run dx concurrently with host browser checks: creating/removing Docker
network interfaces can trigger Chrome net::ERR_NETWORK_CHANGED. Main observed
that environmental failure in an old room reload, then targeted rerun passed
when Docker lane was idle. Browser evidence must come from a final serial run.

Known review targets passed to checker: create completion needs an epoch check
at navigation consumption after subscriber notification; direct-room mock
socket counter must exclude Vite HMR; preserve registration heading across auth
fence remount; add actual Router preload and create failure/pending recovery
browser coverage. Existing human visual/auth-handoff residual gate remains main
session-owned after automation. No commit/staging/archive/production change made.
