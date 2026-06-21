# Bilibili danmaku timing and speed

## Goal

Make Bilibili online danmaku behave like a first-class timeline overlay: fetched danmaku should appear automatically during normal playback without needing a pause/play nudge, and users should be able to adjust danmaku movement/display speed from the existing danmaku settings panel.

## What I already know

* The user does not want to pursue "清晰度选择广播同步"; remove that item from the mainline roadmap.
* The current bug happens with Bilibili online video + fetched Bilibili danmaku.
* When the danmaku switch is already on, fetched danmaku does not automatically appear after loading a video.
* Pausing and playing makes danmaku appear, but it appears in a burst.
* Refreshing the page or replaying the video reproduces the behavior.
* Bilibili fetched danmaku uses the same timeline path as local file danmaku:
  * `BushitsuView.vue` fetches cue JSON from `housou.eisha.danmaku`.
  * `currentTimelineDanmaku` prefers local file danmaku over fetched danmaku.
  * `FileDanmakuOverlay.vue` renders `visibleFileDanmakuCues(...)` from `currentTime + timeOffset`.
* `EnmokuPlayer.vue` currently emits `time` on `video:timeupdate` and `video:seeked`; `playing` is emitted on play/pause/ready.
* Existing danmaku settings include size, opacity, time offset, and source selection.
* Existing file-danmaku logic has unit tests in `packages/kyoushitsu/test/file-danmaku.test.ts`.
* Manual browser feedback passed the first-play timing fix.
* New feedback: dense fetched danmaku can disappear mid-screen, especially after lowering speed, because active cues are capped while their effective duration grows.
* New feedback: the settings panel should use different control shapes for different settings.
* Second manual feedback passed the dense visibility fix, speed buttons, opacity points, and basic time-offset stepper.
* New feedback: size should be a multiplier (`0.5x`, `1x`, `1.5x`, `2x`) rather than raw pixels.
* New feedback: time offset should support `-1s -0.1s X.Xs +0.1s +1s`, with editable `X.Xs` accepting values like `+2` and `-1.2`.
* New feedback: danmaku movement still looks slightly choppy.
* Video evidence: `/tmp/tmp/2026-06-21 12-41-50.mkv` is a 1920x1080 60fps recording showing the panel layout and dense danmaku movement.
* New feedback: setting labels should align as a left column, e.g. `弹幕大小`, `弹幕透明度`, `弹幕速度`.

## Requirements

* Remove "清晰度选择尚未广播同步" as a mainline TODO/gap from `design.md`.
* When fetched Bilibili danmaku loads while the current video is already playing, the overlay must begin rendering automatically without requiring the user to pause or play.
* Fetched danmaku must not burst old cues after a pause/play nudge; the visible timeline should stay aligned with the current playback time.
* Keep local file danmaku precedence over fetched online danmaku.
* Preserve existing size, opacity, time offset, and enabled/disabled behavior.
* Add a danmaku speed control in the existing danmaku settings panel.
* Dense fetched danmaku must not disappear halfway across the player just because more recent cues entered the visible window.
* Speed control semantics:
  * Default `1.0x` preserves current behavior.
  * Faster speed makes scrolling danmaku cross the screen sooner and fixed danmaku stay for less time.
  * Slower speed makes scrolling danmaku cross the screen later and fixed danmaku stay for longer.
  * Provide exactly four options: `0.5x`, `1x`, `1.5x`, and `2x`.
* Settings control shapes:
  * Size uses multiplier options: `0.5x`, `1x`, `1.5x`, and `2x`.
  * Opacity keeps a slider, plus clickable preset points on the slider row.
  * Speed uses four option buttons, not a slider.
  * Time offset uses `-1s -0.1s X.Xs +0.1s +1s`, with editable `X.Xs` and `0.0s` as the default.
* Timeline danmaku motion should update smoothly during playback rather than only when `video:timeupdate` fires.
* Use compositor-friendly transforms for moving danmaku to reduce visible stutter under dense overlays.
* Settings labels should share a fixed, justified left column.

## Acceptance Criteria

* [x] `design.md` no longer lists quality/source selection broadcast sync as a remaining mainline gap.
* [x] Loading a Bilibili video with fetched danmaku and danmaku enabled shows timeline danmaku automatically during playback.
* [x] Pausing and resuming no longer causes a burst of stale fetched danmaku.
* [ ] Refreshing the room and replaying the same Bilibili video keeps the automatic fetched-danmaku behavior.
* [x] The settings panel exposes a danmaku speed slider with a visible `x` multiplier.
* [x] `1.0x` matches previous durations; `2.0x` halves effective cue duration; `0.5x` doubles effective cue duration.
* [x] Local file danmaku still overrides fetched Bilibili danmaku for the same enmoku.
* [x] Existing realtime chat danmaku bubbles are not changed by this speed setting.
* [x] Dense fetched danmaku does not vanish halfway across the player at `0.5x`.
* [x] Size uses multiplier option buttons.
* [x] Opacity slider exposes clickable preset points while preserving drag.
* [x] Speed is selectable only through `0.5x`, `1x`, `1.5x`, and `2x` buttons.
* [x] Time offset uses `-1s -0.1s X.Xs +0.1s +1s`, and `X.Xs` is editable.
* [x] Timeline danmaku receives smooth playback-time updates during playback.
* [x] Moving danmaku uses compositor-friendly `translate3d(...)` transforms.
* [x] Setting labels align in a fixed justified left column.

## Definition of Done

* Unit tests cover effective danmaku duration/speed calculations and visible-cue behavior.
* Existing relevant danmaku tests still pass.
* `./dx bun run format`, `./dx bun run lint`, `./dx bun run typecheck`, and relevant tests pass.
* Manual browser checkpoint covers Bilibili fetched danmaku first playback, pause/resume, refresh/replay, and speed changes.

## Technical Approach

* Keep the fix inside the frontend timeline danmaku path unless code inspection proves an eisha/server issue.
* Prefer deriving visible cue position from the current playback time rather than relying on pause/play side effects.
* Extend file/timeline danmaku utility functions with an explicit speed multiplier so tests can validate duration math without DOM.
* Pass the speed multiplier from `BushitsuView.vue` into `EnmokuPlayer.vue` settings and `FileDanmakuOverlay.vue`.
* Keep the control as local view preference for now; do not broadcast it across room clients.

## Architecture Guardrails

* Preserve the parser/server/frontend boundary: `eisha` owns provider parsing and fetched danmaku retrieval, `housou` persists/broadcasts `Enmoku` metadata, and `kyoushitsu` consumes typed `Enmoku` fields.
* Keep ArtPlayer, hls.js, dash.js, fullscreen patches, and imperative playback commands inside `EnmokuPlayer.vue`.
* Keep playback authority and drift math in `useShinkou`, using only the narrow player handle (`apply`, `alignTransport`, `setRate`, `snapshot`).
* Keep timeline/file/fetched danmaku separate from realtime websocket `DANMAKU`; this speed setting must not alter chat danmaku.
* If another danmaku source, source priority rule, or fetch cache is added during this task, extract route-level timeline danmaku state from `BushitsuView.vue` into a composable before growing the route component further.

## Decision (ADR-lite)

**Context**: Fetched Bilibili danmaku is timeline-based and should follow local playback time, while realtime chat danmaku is a separate bubble overlay.

**Decision**: Treat the new speed setting as a local timeline-danmaku presentation setting. It changes CSS animation durations for file/fetched timeline cues only; it does not modify source cue timestamps, server data, chat bubbles, or playback rate.

**Consequences**: Users can tune readability without changing sync authority or room state. Future canvas danmaku integration can map the same multiplier onto engine speed.

## Out of Scope

* Broadcasting danmaku speed to other clients.
* Broadcasting source/quality selection.
* Replacing the Vue/CSS overlay with `weizhenye/Danmaku`.
* Backend danmaku upload/storage/management.
* ASS support or danmaku search.

## Technical Notes

* Likely files:
  * `design.md`
  * `packages/kyoushitsu/src/views/BushitsuView.vue`
  * `packages/kyoushitsu/src/components/player/EnmokuPlayer.vue`
  * `packages/kyoushitsu/src/components/danmaku/FileDanmakuOverlay.vue`
  * `packages/kyoushitsu/src/lib/file-danmaku.ts`
  * `packages/kyoushitsu/src/i18n/messages.ts`
  * `packages/kyoushitsu/test/file-danmaku.test.ts`
* Relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/type-safety.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
