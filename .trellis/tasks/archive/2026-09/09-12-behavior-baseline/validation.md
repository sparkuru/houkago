# Frontend behavior baseline

Baseline date: 2026-09-12 (Asia/Singapore)

This is a pre-migration snapshot of the existing Vue frontend and its
cross-package checks. It records observed command results only; a blocked
browser check is not a product failure and no result below is treated as a
migration regression.

## Environment and execution notes

- Repository: `/home/wkyuu/cargo/repo/07-houkago`
- Branch and baseline commit: `k-on`, `cae7202`
- Project wrapper: `./dx`, using the repository's `oven/bun:1` container.
- The successful checks used Bun `1.3.14`.
- The existing worktree already contained Trellis planning changes. No product
  source, package manifest, dependency, runtime configuration, database, or
  protocol file was changed by M0.
- Commands were run against the current worktree. Their results therefore
  describe the current baseline, not a clean historical checkout.

## Command baseline

Durations are the observed `exec_command` wall-clock values for this run. The
exit status is authoritative; output is summarized to stable result lines.

| Command | Result | Duration | Evidence |
| --- | --- | ---: | --- |
| `./dx bun run typecheck` | PASS (exit 0) | 7.820s | All six packages (`kokuban`, `kousoku`, `eisha`, `adapter`, `housou`, `kyoushitsu`) reported exit code 0. |
| `./dx bun run lint` | PASS (exit 0) | 0.682s | Biome checked 244 files and applied no fixes. |
| `./dx bun run test` | PASS (exit 0) | 6.897s | `HOUSOU_DB=:memory:`; Bun reported 372 pass, 0 fail, 1,728 expect calls across 76 files. |
| `./dx bun run --filter houkago-kyoushitsu build` | PASS (exit 0) | 5.202s | `vue-tsc --noEmit` completed; Vite 8.0.16 transformed 424 modules and built successfully. Existing `dashjs` `COMMONJS_VARIABLE_IN_ESM` warning was emitted for its bundled `exports` variable. |
| `./dx bun run --filter houkago-kyoushitsu test:e2e` | BLOCKED (exit 1) | 5.815s | All 48 configured tests failed during Chromium launch because `libglib-2.0.so.0` was missing. The failure occurred before application assertions. |
| `./dx bun run --filter houkago-adapter build:chromium` | PASS (exit 0) | 0.642s | Chromium extension artifact build completed. |
| `./dx bunx playwright test --config packages/kyoushitsu/playwright.chromium-adapter.config.ts --project chromium-adapter-installed` | BLOCKED (exit 1) | 1.515s | The one smoke test exited before browser launch because `openssl` was not available for temporary certificate generation. |

The normal Kyoushitsu Playwright config has no `webServer` entry, so an
isolated Housou and Vite server are also required for a meaningful browser
run. Because Chromium could not launch in this container, server startup,
browser assertions, visual parity, and live-provider behavior remain
unverified. No dependency or system package was installed during M0.

## Behavior and fixture inventory

The paths below show existing coverage or fixture seams, not a claim that
browser scenarios passed.

### Room/session, admission, state and snapshot ordering

- Unit seams: `packages/kyoushitsu/test/bushitsu-store.test.ts`,
  `client.test.ts`, `join-gate.test.ts`, `member-presence.test.ts`,
  `room-id.test.ts`, `enmoku-resolve.test.ts`, `bangumi-actions.test.ts`,
  `use-shinkou.test.ts`, `clock-offset.test.ts`, `kengen.test.ts`, and
  `kengen-policy.test.ts`.
- Backend/realtime fixtures and behavior: `packages/housou/test/auth-fixture.ts`,
  `nyuushitsu.e2e.test.ts`, `meibo.e2e.test.ts`, `ws.test.ts`, `sync.e2e.test.ts`,
  `jouei.e2e.test.ts`, `seitoshou.e2e.test.ts`, and `tenko.test.ts`.
- Browser entry/room fixtures: `packages/kyoushitsu/e2e/entry-home.spec.ts`,
  `mobile-room.spec.ts`, `desktop-room.spec.ts`, and
  `room-governance.spec.ts`.

### Playback sync, media/player, subtitles and fullscreen

- Sync and clock seams: `use-shinkou.test.ts`, `clock-offset.test.ts`,
  `zure.test.ts`, `seekable.test.ts`, `client.test.ts`, and
  `enmoku-metadata.test.ts`.
- Player/provider lifecycle coverage: `baidu-grant-polling.test.ts`,
  `baidu-oauth-handoff.test.ts`, `baidu-oauth-window.test.ts`,
  `baidu-source-creation.test.ts`, and the desktop-room media scenarios.
- Controlled subtitle fixtures: `packages/kyoushitsu/e2e/subtitle-fixture.ts`,
  `subtitle-desktop.spec.ts`, and `subtitle-phone.spec.ts`. Fullscreen and
  player-shell assertions are in the desktop/mobile room specs; they were not
  reached because the browser prerequisite was missing.

### Queue and governance

- Frontend policy/action coverage: `bangumi-actions.test.ts`,
  `bushitsu-store.test.ts`, `kengen.test.ts`, and `kengen-policy.test.ts`.
- Backend queue and authorization coverage:
  `packages/housou/test/queue-management.e2e.test.ts`,
  `kengen.e2e.test.ts`, `kengen.test.ts`, `nyuushitsu.e2e.test.ts`,
  `nyuushitsu.test.ts`, and `rest.test.ts`.
- Browser scenarios: `room-governance.spec.ts`, plus queue portions of
  `desktop-room.spec.ts` and `mobile-room.spec.ts`.

### Danmaku

- Frontend parsing/selection/render seams: `file-danmaku.test.ts`,
  `file-danmaku-pref.test.ts`, `local-danmaku-candidate.test.ts`,
  `danmaku-selection.test.ts`, and `danmaku-track.test.ts`.
- Cross-package parser/source coverage: `packages/kokuban/test/`,
  `packages/eisha/test/danmaku.test.ts`, and Housou
  `danmaku-foundation.test.ts`, `danmaku-source.test.ts`,
  `danmaku-hybrid.e2e.test.ts`, and `baidu-danmaku-matching.test.ts`.
- Browser source UI: `packages/kyoushitsu/e2e/danmaku-source.spec.ts`.

### Baidu/provider and adapter

- Kyoushitsu provider/auth seams: `baidu-provider.test.ts`,
  `baidu-adapter.test.ts`, `baidu-grant-polling.test.ts`,
  `baidu-oauth-handoff.test.ts`, `baidu-oauth-window.test.ts`, and
  `baidu-source-creation.test.ts`.
- Adapter protocol/security/lifecycle suites:
  `packages/houkago-adapter/test/build.test.ts`, `security.test.ts`,
  `runtime.test.ts`, `chromium-lifecycle.test.ts`, `dlink-exchange.test.ts`,
  `media-fingerprint.test.ts`, and `polling.test.ts`.
- Backend/provider fixtures: `packages/housou/test/baidu.e2e.test.ts`,
  `baidu-foundation.test.ts`, and `baidu-danmaku-matching.test.ts`.
- Installed-browser smoke: `packages/kyoushitsu/e2e/chromium-adapter-installed.spec.ts`
  with `playwright.chromium-adapter.config.ts`; extension build passed but
  the smoke was blocked by missing `openssl`.

### Entry and responsive layouts

- Entry scenarios: `packages/kyoushitsu/e2e/entry-home.spec.ts`, including
  session restore, auth feedback, classroom creation, public config, and
  reduced motion.
- Responsive room scenarios: `mobile-room.spec.ts`, `desktop-room.spec.ts`,
  `room-governance.spec.ts`, `danmaku-source.spec.ts`, and subtitle specs.
- `packages/kyoushitsu/playwright.config.ts` defines 12 projects covering
  phone-375, iPad Mini, short/tall desktop, entry, subtitle, governance, and
  danmaku variants. The attempted run scheduled 48 tests across these
  projects; none reached an application assertion.

## Worktree and limitations

- `git status --short --branch` after the checks showed only the existing
  Trellis document edits and the two Trellis task directories (including this
  evidence file). Build output and Playwright `test-results` were ignored.
- No product-code, dependency, runtime-config, database, or protocol diff is
  attributable to M0.
- Follow-up before M1: use the project-defined host-browser Playwright profile
  (`PLAYWRIGHT_CHROMIUM_EXECUTABLE` plus the supported host executable), start
  isolated Housou/Vite fixture services, rerun both browser configurations, and
  retain the resulting assertion/fixture evidence. Do not install system
  packages into the normal `./dx` image for this purpose.
- Provider credentials and live upstream availability were not exercised. The
  controlled unit fixtures passed, but that does not prove live provider
  compatibility.
