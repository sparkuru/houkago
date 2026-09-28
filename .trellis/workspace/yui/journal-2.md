# Journal - yui (Part 2)

> Continuation from `journal-1.md` (archived at ~2000 lines)
> Started: 2026-08-30

---



## Session 66: Warm Club 2.0 room shell

**Date**: 2026-08-30
**Task**: Warm Club 2.0 room shell
**Package**: houkago-eisha
**Branch**: `k-on`

### Summary

Implemented the approved player-first room shell across BushitsuView: room tokens, media context, desktop chat rail, quiet workbench surfaces, portrait disclosures, and cinema presentation while preserving room state and media behavior. Added focused desktop/mobile Playwright bounds and synchronized the Kyoushitsu component contract. Focused unit/browser/typecheck/lint/build gates passed; full-suite backend baseline failures and two pre-existing governance alert-text assertions remain recorded. Human visual review approved the screenshots.

### Git Commits

| Hash | Message |
|------|---------|
| `ea61fb0` | (see git log) |

### Status

[OK] **Completed**


## Session 67: Warm Club queue control consistency

**Date**: 2026-08-31
**Task**: Warm Club queue control consistency
**Package**: houkago-eisha
**Branch**: `k-on`

### Summary

Unified Warm Club queue and URL composer hierarchy, responsive controls, accessibility states, Playwright coverage, and durable frontend testing contracts; task checks pass with two unrelated governance baseline assertions documented.

### Git Commits

| Hash | Message |
|------|---------|
| `1bb23a6` | (see git log) |

### Status

[OK] **Completed**


## Session 68: Frontend behavior baseline

**Date**: 2026-09-12
**Task**: Frontend behavior baseline
**Package**: houkago-kyoushitsu
**Branch**: `k-on`

### Summary

Completed and archived M0 frontend behavior baseline. Typecheck, lint, 372 unit/integration tests, Kyoushitsu build, and Chromium adapter build passed; main Playwright and installed Chromium adapter smoke were blocked by missing container prerequisites. Recorded behavior/fixture coverage, documented host-browser validation, and left M1–M6 unauthorized.

### Git Commits

| Hash | Message |
|------|---------|
| `6fefded` | (see git log) |
| `b222103` | (see git log) |

### Status

[OK] **Completed**


## Session 69: 完成 M1 房间会话与播放器边界

**Date**: 2026-09-13
**Task**: 完成 M1 房间会话与播放器边界
**Package**: houkago-kyoushitsu
**Branch**: `k-on`

### Summary

完成 Vue 保持兼容的 room session、队列权威、同步/播放器端口提取；补齐 stale callback/跨房间响应/重连 epoch 测试，并归档 M1。M2–M6 仍未授权。

### Main Changes

- 新增框架无关 PlayerHandle、ShinkouController 与 RoomSessionController。
- BushitsuView 改为注入 session；KousokuClient 强化 active-socket identity；store 增加 room reset。
- 新增 session/sync focused tests，更新 M1 validation 与主线状态。

### Git Commits

| Hash | Message |
|------|---------|
| `53012a8` | (see git log) |
| `c0d3bab` | (see git log) |

### Testing

- [OK] focused: 32 passed
- [OK] full: 388 passed
- [OK] typecheck, serial lint, and Kyoushitsu build passed

### Status

[OK] **Completed**

### Next Steps

- 等待用户明确决定是否进入 M2；不自动串行推进。


## Session 70: 完成 M2 HTTP 契约与资源层

**Date**: 2026-09-26
**Task**: 完成 M2 HTTP 契约与资源层
**Package**: houkago-kyoushitsu
**Branch**: `k-on`

### Summary

完成并归档 M2：隔离 OpenAPI 导出、确定性 Hey API 客户端、框架无关资源策略与取消/grant 流程；独立全范围审查通过，用户确认后完成工作提交、归档和主线同步。

### Main Changes

- 59 个完整契约操作、46 个浏览器 JSON 操作；运行时路由对照、认证与媒体边界、生成漂移检查。
- 保留 cookie/status/domain error/AbortSignal/union 类型；补齐会话代次键、logout 清理、grant 有界轮询与搜索取消。
- 同步可执行规范与 M2 验收证据；保留未提交的既有 dev.sh URL 改动。

### Git Commits

| Hash | Message |
|------|---------|
| `d7410cf` | (see git log) |
| `d76c8e5` | (see git log) |

### Testing

- [OK] Focused: 46 passed, 0 failed; full: 434 passed, 0 failed across 82 files.
- [OK] Six-package typecheck, lint (265 files), contract drift (18 stable files), Kyoushitsu build and git diff --check passed.
- [OK] No browser/Playwright or live-provider validation this round; existing dash.js build warning recorded.

### Status

[OK] **Completed**

### Next Steps

- 等待用户明确决定是否进入 M3 React shell/UI foundation；不自动推进或推送。


## Session 71: Complete M3 parallel React entry and Vue handoff

**Date**: 2026-09-26
**Task**: Complete M3 parallel React entry and Vue handoff
**Package**: houkago-kyoushitsu
**Branch**: `k-on`

### Summary

Implemented and verified M3, owner approved residual review and commit/archive with 提交; archived M3 and synchronized mainline. Preserved dev.sh; no push or M4 start.

### Main Changes

- Parallel React Router/Query identity/home, Warm Club primitives, safe same-window Vue room handoff and pure M2 resource/config exports.
- Epoch fences, StrictMode-safe QueryCache subscriptions, auth reconciliation, late-create navigation protection, typed revoked search and persisted-page recovery.
- Validated DX_EXTRA_PORTS and isolated memory Housou/Vue/React preview; task-owned services stopped and ports released.

### Git Commits

| Hash | Message |
|------|---------|
| `8c5a326` | (see git log) |
| `ae37464` | (see git log) |

### Testing

- [OK] 465 tests, 56 distinct browser cases, 124 shell checks; seven workspace typechecks, lint, deterministic contract drift and both builds passed.
- [OK] Real-cookie register/refresh/Vue admission/same identity/return/logout continuity passed; actual React graph 443 IDs, no forbidden runtime imports.

### Status

[OK] **Completed**

### Next Steps

- Await explicit M4 stage authorization; parent stays planning. Pre-existing dev.sh URL edits remain uncommitted.


## Session 72: Warm Club interaction surface polish

**Date**: 2026-09-28
**Task**: Warm Club interaction surface polish
**Package**: houkago-kyoushitsu
**Branch**: `k-on`

### Summary

Implemented and archived the reviewed Warm Club 2.0 room-surface polish; preserved product behavior and recorded browser-check caveats.

### Main Changes

- Polished room gates, dialogs, mobile chat sheet/composer, provider surfaces, and cinema controls with focused responsive assertions.
- Updated frontend motion screenshot guidance; archived the child task after owner approval.

### Git Commits

| Hash | Message |
|------|---------|
| `e0ff941` | (see git log) |
| `db9c50a` | (see git log) |

### Testing

- [OK] Kyoushitsu unit tests 203/203; lint, typecheck, build, task validation, and diff check passed; focused Playwright 7/7 passed.
- [OK] Full browser run retained an intermittent iPad setup timeout; subtitle interception passed isolated rerun.

### Status

[OK] **Completed**

### Next Steps

- 08-29 visual parent remains planning; await owner direction. M4-M6 remain unauthorized.
