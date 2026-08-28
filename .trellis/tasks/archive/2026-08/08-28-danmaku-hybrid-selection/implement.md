# Implementation plan: hybrid danmaku source selection

## Ordered work

1. Add candidate/policy/default shared contracts and housou REST/WS boundaries.
2. Add policy and Enmoku-default persistence/authorization with full snapshot
   broadcast tests.
3. Add versioned viewer override storage and pure precedence/fallback helpers.
4. Extract `useTimelineDanmaku`; route one active cue set to the existing
   timeline overlay and remove priority/cache ownership from `BushitsuView`.
5. Add source panel, i18n, access states, component/unit tests, and desktop/phone
   Playwright coverage.

## Validation

```sh
./dx bun run --filter houkago-kousoku test
./dx bun run --filter houkago-housou test
./dx bun run --filter houkago-kyoushitsu test
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --grep "danmaku source"
```

## Rollback points

- Keep legacy candidate wrapping until source migration proves parity.
- Reject local/non-eligible room defaults at the server, regardless of UI gate.
- A selection failure must return one safe fallback/no-track state and must not
  write a replacement preference or alter playback.

