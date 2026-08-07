# Subtitle selector — implementation plan

## Ordered work

1. Add a pure subtitle-choice helper and unit tests for Off/default, named
   metadata, stable values, and absent metadata.
2. Wire local current-`Enmoku` subtitle state through `BushitsuView`; reset on
   item change only and never write the room store or a WebSocket envelope.
3. Extend `EnmokuPlayer` props/emits and its HLS/native text-track lifecycle to
   select/hide tracks safely. Add the fullscreen-safe custom selector, localized
   labels, failure feedback, focus and responsive styles.
4. Extend focused frontend tests and responsive Playwright with a controlled
   subtitle-bearing HLS fixture or equivalent player test seam. Assert keyboard
   selection, Off/reset, quality independence, local-only state, phone overflow,
   and desktop/fullscreen control availability.
5. Run format, lint, typecheck, isolated package tests, production build, and
   focused desktop/phone Playwright. Capture durable player-control boundaries
   in the frontend code-spec, then commit and archive.

## Validation

```sh
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx sh -c 'HOUSOU_DB=/tmp/houkago-subtitle-ui-final.db bun test packages/kokuban/test packages/eisha/test packages/housou/test packages/kyoushitsu/test'
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --grep 'subtitle'
```

## Rollback points

- Keep `Enmoku.subtitles` unchanged; it remains display metadata if the player
  selector is removed.
- On a runtime-track mismatch or load error, force local Off and retain the
  existing video, source-quality, sync, and danmaku behavior.
