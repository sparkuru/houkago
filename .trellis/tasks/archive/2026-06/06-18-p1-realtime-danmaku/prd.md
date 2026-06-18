# P1 实时 DANMAKU 最小纵切

## Goal

把设计里的 `DANMAKU` 实时弹幕通道从“协议存在但前端未消费”推进到可用的最小纵切：同房间成员发送 `DANMAKU` 后，所有客户端在播放器 overlay 上看到独立实时弹幕，不再把聊天消息当作弹幕替身。

## What I Already Know

* `design.md` 已把本项列为推荐下一项：P1 实时 `DANMAKU` 最小纵切。
* `houkago-kousoku` 已定义 `DANMAKU` 信封：`{ content, color?, mode? }`。
* `housou` WS handler 已对 `OSHABERI` 和 `DANMAKU` 共用 echo/broadcast 路径，并受 `chat` 权限 gate。
* `kyoushitsu` store 目前只消费 `OSHABERI` 到 `chat`。
* `DanmakuOverlay` 目前 watch `bushitsu.chat`，所以它显示的是聊天气泡，不是真正 `DANMAKU`。
* `ChatPanel` 目前只有一个聊天发送按钮。

## Requirements

* Frontend store must keep realtime danmaku lines separate from chat lines.
* Applying a `DANMAKU` envelope must append to the realtime danmaku list and must not append to chat.
* `DanmakuOverlay` must render realtime `DANMAKU` lines, not chat lines.
* The room view must be able to send `DANMAKU` messages over the existing `KousokuClient`.
* Chat UI must expose a small, keyboard-accessible way to send the current draft as danmaku.
* Existing chat behavior must remain unchanged.
* Existing permission behavior must be preserved: guests without chat permission cannot send chat or danmaku.
* Use existing Vue/CSS overlay for this slice; do not introduce `weizhenye/Danmaku` yet.

## Acceptance Criteria

* [ ] Store tests prove `OSHABERI` and `DANMAKU` land in separate lists.
* [ ] Backend tests prove `DANMAKU` broadcasts to room peers and is denied when `chat` permission is off.
* [ ] `DanmakuOverlay` watches `bushitsu.danmaku`.
* [ ] `ChatPanel` can emit `oshaberi` and `danmaku` separately.
* [ ] `BushitsuView` sends `DANMAKU` envelopes from the new emit.
* [ ] Lint, typecheck, and relevant tests pass.

## Definition of Done

* Code implemented.
* Tests updated.
* Lint/typecheck/test pass through `./dx`.
* Trellis task archived and journal recorded.

## Technical Approach

Keep this as a narrow frontend + backend-test slice:

* Add a local `DanmakuLine` type in `useBushitsuStore`.
* Add `danmaku = ref<DanmakuLine[]>([])`.
* Extend `apply()` with a `DANMAKU` branch.
* Return `danmaku` from the store.
* Extend `ChatPanel` emits with `danmaku`.
* Add a second submit button in the existing form using `event.submitter` to choose chat vs danmaku, preserving keyboard form behavior.
* Add `danmaku(content)` in `BushitsuView`, sending `{ type: "DANMAKU", payload: { content } }`.
* Change `DanmakuOverlay` watcher from `bushitsu.chat.length` to `bushitsu.danmaku.length`.

## Decision (ADR-lite)

**Context**: Full P1 eventually needs file danmaku, third-party fetch, and a canvas engine, but the protocol already supports realtime `DANMAKU`.

**Decision**: Implement realtime `DANMAKU` first using the existing Vue/CSS overlay and the existing WS gate.

**Consequences**: Users get a real separate danmaku path now. Dense danmaku performance, track timing, file parsing, source priority, and `weizhenye/Danmaku` integration remain future work.

## Out of Scope

* File danmaku loading/parsing.
* `houkago-kokuban`.
* `weizhenye/Danmaku` dependency/integration.
* Danmaku color/mode UI.
* Persisting danmaku.
* Browser automation smoke test, unless unit/e2e checks expose a risk.

## Technical Notes

* Relevant files:
  * `packages/kousoku/src/messages.ts`
  * `packages/housou/src/ws/handler.ts`
  * `packages/housou/test/*.test.ts`
  * `packages/kyoushitsu/src/stores/bushitsu.ts`
  * `packages/kyoushitsu/src/components/chat/ChatPanel.vue`
  * `packages/kyoushitsu/src/components/danmaku/DanmakuOverlay.vue`
  * `packages/kyoushitsu/src/views/BushitsuView.vue`
