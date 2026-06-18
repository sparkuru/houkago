# Frontend i18n Labels

## Goal

Move hard-coded frontend UI labels into a small i18n configuration layer so the default visible language is Chinese, while preserving the project's Japanese-style domain vocabulary and interaction habits.

## What I already know

* The user wants the switches and related frontend display text to be configurable through i18n rather than embedded directly in Vue templates.
* The desired default expression is Chinese.
* The product/domain style should keep Japanese-flavored concepts and habits.
* The current frontend has no i18n dependency.
* `packages/kyoushitsu` is a Vue 3 + Vite + Pinia app.
* UI strings are currently hard-coded mainly in:
  * `packages/kyoushitsu/src/views/HomeView.vue`
  * `packages/kyoushitsu/src/views/BushitsuView.vue`
  * `packages/kyoushitsu/src/components/chat/ChatPanel.vue`
  * `packages/kyoushitsu/src/components/kengen/KengenPanel.vue`
  * `packages/kyoushitsu/src/components/player/EnmokuPlayer.vue`
  * `packages/kyoushitsu/src/components/danmaku/DanmakuOverlay.vue`

## Requirements

* Add a frontend i18n configuration surface for user-facing labels.
* Use Chinese as the default displayed language.
* Keep Japanese-style domain concepts available in labels where they are part of the product vocabulary, for example room/club-room, joining, program list, host/guest, admission, and playback-control concepts.
* Replace hard-coded user-facing strings in the main kyoushitsu views/components with i18n lookups.
* Keep the implementation lightweight and dependency-free unless the existing codebase already requires a full runtime i18n library.
* Preserve accessibility text by routing `aria-label` values through the same label source.
* Do not translate protocol/domain identifiers, code identifiers, or comments as part of this task.

## Acceptance Criteria

* [ ] The kyoushitsu UI can obtain labels from a central i18n module.
* [ ] The default UI text is Chinese.
* [ ] The labels still retain the Japanese product vocabulary where appropriate.
* [ ] Permission/admission switches no longer hard-code Japanese labels directly in Vue templates.
* [ ] Existing type-check and lint checks pass.

## Definition of Done

* Tests added or updated where useful for pure label helpers.
* Lint and type-check pass.
* Existing unrelated worktree changes are preserved.
* No backend behavior changes.

## Technical Approach

Implement a small typed i18n module under `packages/kyoushitsu/src/i18n/`.

Recommended shape:

* `messages.ts` exports locale dictionaries, starting with default `zh-CN`.
* `index.ts` exports `t(key)` and small helper functions for dynamic labels.
* Components import `t` directly in `<script setup>` and bind labels in templates.

This keeps the first i18n pass small and reversible. A future switch to `vue-i18n` can reuse the same message keys if runtime locale switching becomes necessary.

## Decision (ADR-lite)

**Context**: The app has no i18n dependency, and the immediate requirement is configurability plus a default Chinese display, not runtime language switching.

**Decision**: Use an internal typed message dictionary and lookup helper first.

**Consequences**: This avoids adding app-wide plugin setup for a small label migration. It does not yet provide locale persistence, lazy-loaded locale bundles, plural rules, or runtime language switching.

## Out of Scope

* Full `vue-i18n` integration.
* Runtime language picker.
* Browser language auto-detection.
* Backend error-message localization.
* Translating internal code identifiers, comments, tests, or protocol names.

## Technical Notes

* `tsconfig.base.json` has `resolveJsonModule: true`, but TypeScript modules are preferable here for typed message keys.
* Current `packages/kyoushitsu/index.html` uses `<html lang="ja">`; if the visible default becomes Chinese, this should be updated to a Chinese locale unless there is a deliberate accessibility reason not to.
* Existing dirty file before this task: `readme.md` (unrelated user/worktree change).
