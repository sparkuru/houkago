# Validation: Warm Club 2.0 interaction surface polish

## Baseline

- Existing focused browser scenarios passed 6/6 in the host Chrome profile:
  mobile chat sheet, cinema with desktop chat rail, Baidu connection dialog,
  Baidu file dialog, member removal, and queue clearing.
- Initial sandbox Chrome startup ended with `SIGTRAP`; browser checks then used
  the project-approved host profile (`/usr/bin/google-chrome`) against the
  local `./dev.sh` services. No production account or data was used.
- Baseline diagnostic screenshots are in
  `/tmp/warm-club-interaction-baseline/`.

## Code and package checks

| Command | Result |
| --- | --- |
| `./dx bun test packages/kyoushitsu/test` | Passed, 203/203 tests. |
| `./dx bun run --filter houkago-kyoushitsu typecheck` | Passed. |
| `./dx bun run lint` | Passed after correcting two formatting findings in the e2e changes. |
| `./dx bun run --filter houkago-kyoushitsu build` | Passed. Existing dashjs CommonJS-in-ESM warning remains. |
| `git diff --check` | Passed. |
| `python3 ./.trellis/scripts/task.py validate .trellis/tasks/09-28-warm-club-interaction-surface-polish` | Passed; 10 implement and 10 check contexts. |

## Browser checks

App services were started with `./dev.sh`. Browser checks used the repository
Playwright config and host Chrome:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=phone-375 --project=ipad-mini --project=desktop-short --project=desktop-tall --project=governance-phone --project=governance-desktop
```

- Focused run passed 7/7 cases, covering mobile/tablet sheet behavior, cinema,
  provider dialogs, member removal, and queue clearing.
- The sheet test was rerun for `phone-375` and `ipad-mini` after adding a wait
  for the existing 180ms entrance opacity/translation animation. Both passed
  (2/2) with strict viewport bounds and no geometry tolerance.
- The full browser suite was run. The serial run reported 40 passed and 8
  project-configured skips. A retained failure in
  `packages/kyoushitsu/test-results/.last-run.json` records one intermittent
  iPad setup timeout before room entry: `createRoom` could not find the
  registration button. This happened before the changed sheet behavior. The
  later focused phone/iPad rerun passed. Do not treat the full suite as an
  unconditional green run.
- A parallel full-suite run also had one `subtitle-desktop` click intercepted
  by ArtPlayer's `.art-progress` while selecting 720p. The isolated rerun
  passed 1/1; this is recorded as timing-sensitive browser behavior outside
  the changed surfaces.

The full-suite command was:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

## Diagnostic screenshots

Final screenshots are in `/tmp/warm-club-interaction-final/`:

| File | Viewport/state |
| --- | --- |
| `room-shell-portrait-375.png` | 375×812 room shell. |
| `chat-sheet-portrait-375.png` | 375×812 open mobile chat sheet. |
| `chat-composer-settings-375.png` | 375×812 composer settings. |
| `room-shell-portrait-768.png` | 768×1024 room shell. |
| `chat-sheet-portrait-768.png` | 768×1024 stable open chat sheet after its entrance animation. |
| `chat-composer-settings-768.png` | 768×1024 composer settings. |
| `room-shell-short-1280x640.png` | 1280×640 short desktop. |
| `room-shell-tall-1280x1200.png` | 1280×1200 tall desktop. |
| `cinema-1280x1200.png` | 1280×1200 cinema with desktop chat rail visible. |
| `baidu-retention-1280x1200.png` | Credential-retention step. |
| `baidu-files-1280x1200.png` | Baidu file-selection dialog. |
| `member-removal-1280x900.png` | Member-removal dialog. |
| `queue-clear-1280x900.png` | Queue-clear confirmation. |

Screenshots are diagnostic evidence, not pixel baselines. Human review is still
needed for subjective visual fit and real-device/assistive-technology behavior,
especially nickname/admission gate states and the player join gate.

## Scope review

- Changed paths are limited to the six named Vue surfaces, their three direct
  e2e specs, the component guideline's screenshot synchronization note, and
  the approved Trellis task/continuity records.
- No API, store, WebSocket, permissions, queue actions, provider workflow,
  chat/danmaku send, or playback lifecycle code changed.
- The desktop chat rail remains visible in cinema; mobile chat draft/settings
  preferences and user-selected text color/font size remain owned by the
  existing ChatPanel state.
- The final code review found one semantics mismatch: the custom provider-info
  overlay had been given `aria-modal="true"` without focus management. The
  attribute was removed to preserve its existing focus behavior.
- The owner approved the visual result and requested archival on 2026-09-28.
