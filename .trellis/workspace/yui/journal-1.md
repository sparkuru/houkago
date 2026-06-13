# Journal - yui (Part 1)

> AI development session journal
> Started: 2026-06-13

---



## Session 1: 后端选型落定：Bun + Elysia.js spike + 弹幕引擎决策

**Date**: 2026-06-13
**Task**: 后端选型落定：Bun + Elysia.js spike + 弹幕引擎决策
**Branch**: `k-on`

### Summary

对比 ChatGPT review 后定向选型：弹幕用 MIT weizhenye/Danmaku 不自研；housou 运行时 Bun；Web 框架经 /tmp docker spike 实测 Elysia.js（6/6 探针过，硬指标 #781 非WS全局publish PASS，未退 Fastify-on-Bun）。结论回填 design.md §3/§7/§8/§9 与 readme，spike 结果留档 research/elysia-spike-results.md。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ddea404` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: 填充 backend/frontend 编码规范，bootstrap 收尾

**Date**: 2026-06-13
**Task**: 填充 backend/frontend 编码规范，bootstrap 收尾
**Branch**: `k-on`

### Summary

以 design.md §2 命名词典 + Elysia spike 结论为依据填充 .trellis/spec 下 backend(5)/frontend(6) 共 11 个 guideline，index 状态转 Done，prd 勾选完成；归档 00-bootstrap-guidelines。下一步进入脚手架 + P0 MVP。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `48e9d13` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Scaffold Bun monorepo（kousoku/housou/kyoushitsu）+ docker(./dx) 开发环境

**Date**: 2026-06-13
**Task**: Scaffold Bun monorepo（kousoku/housou/kyoushitsu）+ docker(./dx) 开发环境
**Branch**: `k-on`

### Summary

搭起 Bun workspaces monorepo 脚手架(scaffold-only)：kousoku 共享契约(WS信封+§4全表判别联合+TypeBox)、housou(Elysia+WS pub/sub+bun:sqlite+最小REST+ShinkouSeigyo占位)、kyoushitsu(Vue3+Eden+WS骨架+ArtPlayer)。宿主机不装bun，改用 ./dx docker(oven/bun:1) 包裹器跑全部bun命令。vue-router 由实验性5.x降到稳定4.x。验收全绿(install/typecheck/lint/test6pass/build)。spec补Build&Run与vue-router锁版约定。P0同步算法留挂点未实现。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4105532` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: P0纵切1：单房间房主权威同步端到端

**Date**: 2026-06-14
**Task**: P0纵切1：单房间房主权威同步端到端
**Branch**: `k-on`

### Summary

实现 design.md §5 第一条同步链路：服务端 ShinkouSeigyo 房主权威(senderId==buchouId 否则 NotBuchou→KEIHOU 发回发送者，不广播)；客户端 useShinkou 进行制御(tsuijuuChuu 回声抑制200ms+投影追平)脱离.vue、EnmokuPlayer 独占 art 暴露 apply()、store isBuchou 派生。修了 HomeView 建房者 senderId/buchouId 双重生成不匹配致永远当不成部長的 bug，改 lib/identity localStorage 持久 buinId。测试 shinkou 单测5+sync.e2e 3(广播/OIKAKE追平/KEIHOU拒绝)，容器内 typecheck/lint/test14/build 全绿。biome 忽略.trellis；error-handling spec 记录 onError 不覆盖 WS message body 需 try/catch→KEIHOU。漂移校正 TENKO/zure 留第二片。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f56b415` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: P0纵切2：漂移校正（服务端权威钟心跳+zureHosei三档）

**Date**: 2026-06-14
**Task**: P0纵切2：漂移校正（服务端权威钟心跳+zureHosei三档）
**Branch**: `k-on`

### Summary

在纵切1房主权威同步上补 design.md §5 漂移校正。服务端权威钟：ws/tenko.ts 全局 setInterval(~4s) 遍历活跃房间 app.server?.publish GENJOU(projected+serverTime)，ShinkouSeigyo.has() 跳过未驱动房，仅 import.meta.main 启动+stop句柄防泄漏(spike#781)。客户端：lib/zure.ts zureHosei 纯函数三档(≤0.3忽略/>1.5seek/中档 playing→nudge±5% paused→seek)；useShinkou 重写为显式 type 路由替代slice1笼统watch硬seek(SHINKOU硬apply/GENJOU→alignTransport+zureHosei时间分量/nudge跨tick自回退)，全程tsuijuuChuu抑制、isBuchou跳过；EnmokuPlayer加alignTransport/setRate/暴露snapshot。心跳复用GENJOU统一追平与漂移，TENKO(C→S)v1不用，design§5回填。trellis-check 13文件过、修1过时注释。容器内typecheck/lint绿、housou16+kyoushitsu5测试过、build通过。决策:tick源=服务端权威钟、zure全三档(用户选);心跳复用GENJOU、软校正自回退(AI定)。Out:自由控制权/断线重连/NTP-lite/WebRTC。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a47e9ce` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
