# Shared room information panel

## Goal

Turn the room side information surface into the shared home for room identity, connection state, member presence, admission state, and safe viewer actions. Hosts should still see privileged controls there, while non-hosts should get the same room awareness without hidden host-only buttons.

## What I Already Know

* The previous WS reconnect task made the left panel visible to non-hosts and renamed the non-host header to `房间信息`.
* `KengenPanel.vue` already shows room name, WS status, and share link for all viewers, while admission and guest-permission controls are gated by `bushitsu.isBuchou`.
* `ChatPanel.vue` already has an online/history member popover backed by `useBushitsuStore.onlineBuinInfo` and `historyBuinInfo`.
* `useBushitsuStore` already tracks `SHUSSEKI` count, online/departed member presence, nicknames, roles (`yakuwari`), admission mode/status, and pending admission requests.
* `design.md` P3 still calls out missing independent member list / management panel, and the archived reconnect PRD explicitly notes a future shared room information surface with member/admission state and manual retry.
* No protocol or backend change appears necessary for a first slice.

## Assumptions

* This task should be a frontend information-architecture slice: move/duplicate existing visible data into the room information panel, not redesign backend state.
* The chat member popover can either remain as a shortcut or be reduced later; this MVP should avoid breaking chat ergonomics.
* Manual retry can be added as a safe action only if it reuses `KousokuClient.connect()` and does not create a second WebSocket.

## Open Questions

* None for the MVP.

## Requirements

* Shared room information panel is visible to host and non-host admitted viewers.
* Non-host panel must show at least room identity, connection status, share link, current admission mode/status, and member presence.
* Host panel keeps existing admission and guest-permission controls.
* Member presence uses existing store-derived online/history state; no new protocol.
* UI text goes through `i18n/messages.ts`; no hard-coded visible labels.
* A simple manual reconnect action may be included if it can reuse the existing `KousokuClient.connect()` path without introducing a second socket owner.

## Acceptance Criteria

* [x] Host and non-host both see a room information panel after entering a room.
* [x] Non-host can inspect online members and recent departed members without opening chat-only controls.
* [x] Host still sees admission mode, pending approvals, and guest permission switches.
* [x] Admission mode and current admission status are visible as read-only room information for non-hosts.
* [x] Existing chat member popover, admission, permission, reconnect, and playback behavior do not regress.
* [x] Focused frontend tests cover any extracted room/member view-model logic.

## Definition of Done

* Relevant frontend tests added/updated.
* `./dx bun run format`, `./dx bun run lint`, `./dx bun run typecheck`, and `./dx bun test` pass.
* Browser manual checkpoint covers host and non-host panel visibility.
* Specs updated if the task establishes a reusable room-information panel convention.

## Technical Approach

MVP: extend the existing `KengenPanel.vue` into a role-aware room information panel by adding read-only sections for admission state and member presence. Keep host-only controls gated in the same component for now to avoid new layout churn. Extract small pure helpers only if member/admission view labels become repetitive or need unit coverage.

## Decision (ADR-lite)

**Context**: Room identity/status moved into a shared panel during WS reconnect work, but member and admission awareness still lives partly in chat or host-only controls.

**Decision**: Consolidate existing room/member/admission read-only data into `KengenPanel.vue`, while preserving host-only controls. Include manual reconnect only if it stays a thin call into the single `KousokuClient` owner.

**Consequences**: This avoids protocol work and gives non-hosts a stable place to understand room state. It may leave component naming (`KengenPanel`) semantically stale; renaming can happen only if low-risk or as a later cleanup.

## Out of Scope

* New backend protocol fields or persistence.
* Individual member moderation actions such as kick/ban/promote.
* Authentication / `生徒証` identity.
* Full manual retry UX if it grows beyond a simple safe reconnect action.
* Large room layout redesign.

## Technical Notes

* Relevant files inspected:
  * `packages/kyoushitsu/src/components/kengen/KengenPanel.vue`
  * `packages/kyoushitsu/src/components/chat/ChatPanel.vue`
  * `packages/kyoushitsu/src/stores/bushitsu.ts`
  * `packages/kyoushitsu/src/i18n/messages.ts`
  * `packages/kyoushitsu/src/ws/client.ts`
  * `packages/kousoku/src/messages.ts`
  * `design.md`
* Likely relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/frontend/type-safety.md`
