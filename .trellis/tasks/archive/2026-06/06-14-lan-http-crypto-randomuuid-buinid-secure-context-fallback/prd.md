# LAN/HTTP 下 crypto.randomUUID 崩溃修复（buinId secure-context fallback）

## Goal

LAN 实跑验证时，从另一台机(9.2) 经 `http://192.168.9.4:5173`（明文 HTTP + 非 localhost）访问，整页空白。根因：`crypto.randomUUID()` 受浏览器 **secure context** 限制——仅 HTTPS 或 localhost/127.0.0.1 可用，明文 HTTP + LAN IP 下为 `undefined`，`identity.ts` 的 `buinId()` 抛 `TypeError`，HomeView setup → pinia store 初始化链路崩溃，全站白屏。这是 LAN 使能链路（接 06-14-p0-cors-lan-letterbox）才暴露的真 bug；headless 测的是 localhost 故未抓到。

## What I already know（现场已勘）

- 崩点唯一：[identity.ts:11](packages/kyoushitsu/src/lib/identity.ts#L11) `crypto.randomUUID()`，浏览器端执行。
- 服务端 [housou/src/lib/id.ts:4](packages/housou/src/lib/id.ts#L4) 也用 `crypto.randomUUID()`，但跑在 Bun（始终安全上下文）→ **无需改**。
- `crypto.getRandomValues()` **不受** secure context 限制，任何上下文可用 → 可用它拼 RFC-4122 v4 UUID 作 fallback。
- buinId 语义（identity.ts 注释）：稳定 per-browser id = WS `senderId`，房主时即 `buchouId`；只需唯一+持久，不强制 RFC 格式，但保持 v4 与服务端一致最稳。
- 控制台栈：`crypto.randomUUID is not a function` @ identity.ts:11 → bushitsu.ts:15 store init → HomeView.vue:10。

## Requirements

1. `buinId()` 在 secure context 缺失（明文 HTTP LAN）下不崩，返回稳定持久的 v4 UUID。
2. `crypto.randomUUID` 存在时仍优先用它（行为不回归）；否则走 `crypto.getRandomValues` v4 fallback。
3. localStorage 持久化语义不变（同浏览器刷新保持同一 id）。
4. 加回归测试：mock 全局 `crypto` 去掉 `randomUUID`，断言 `buinId()` 仍返回合法 v4 且二次调用持久一致。

## Acceptance Criteria

- [ ] 9.2 经 `http://192.168.9.4:5173` 访问首页/房间不再白屏，控制台无 `randomUUID` 报错。
- [ ] localhost 访问行为不回归（仍拿到稳定 buinId）。
- [ ] 回归测试覆盖 randomUUID 缺失分支（mock crypto），通过。
- [ ] 容器内 typecheck/lint/build 全绿；kyoushitsu test 不回归。

## Out of Scope

- 服务端 housou id.ts（安全上下文恒满足，不动）。
- 真正的 HTTPS/secure-context 部署方案（自签证书/反代 TLS）——属部署期，单列。
- 昵称显示、弹幕引擎等既有 backlog。

## Technical Notes

- fallback 落点：直接在 identity.ts 内联一个小 `uuidv4()` helper（仅此一处客户端用点，无需提共享 lib）。
- 验证：容器内 `./dx`；视觉/LAN 实跑由用户在 9.2 最终确认。
- 测试落点：identity.ts 同目录 `identity.test.ts`，bun test；用例间清 localStorage、保存/恢复全局 crypto 避免污染其他用例。
