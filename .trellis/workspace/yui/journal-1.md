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


## Session 6: P0纵切3：聊天气泡 overlay + 网页全屏保留侧栏

**Date**: 2026-06-14
**Task**: P0纵切3：聊天气泡 overlay + 网页全屏保留侧栏
**Branch**: `k-on`

### Summary

补 design §10 P0 聊天弹幕前端（B站直播风）。A: DanmakuOverlay.vue 弹幕姬 lite——读 store.chat 最近~5 条播放器左下角淡气泡，新增浮现~5s 淡出，fade/drop timer 登记 Map、onUnmounted+关闭全清，开关按钮，容器 pointer-events:none 不拦播放器。B: BushitsuView 网页全屏 webZenmen(纯 CSS class、fixed 占满、ChatPanel 仍 docked 右侧、无 JS 监听、退出复原) + 聊天折叠 chatHiraku 箭头，视图态本地 ref 不进 store。用户细化需求：弹幕姬式淡气泡而非飞屏弹幕、网页全屏保留聊天(synctv-web 缺)。决策：P0 不引入 canvas 弹幕引擎，纯 Vue/CSS overlay，weizhenye/Danmaku 推迟到样式化/文件弹幕切片，design §7 回填。trellis-check 3 文件过、修 1 死 class。容器内 typecheck/lint/build 绿、kyoushitsu test 5 pass 不回归。Out:飞屏 canvas 弹幕/样式化 DANMAKU/文件弹幕(P1)/抓取(P2)。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ad14417` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: P0 验证修复：CORS/LAN 使能 + 全屏 letterbox + 气泡层级 + 聊天可读

**Date**: 2026-06-14
**Task**: P0 验证修复：CORS/LAN 使能 + 全屏 letterbox + 气泡层级 + 聊天可读
**Branch**: `k-on`

### Summary

浏览器实跑验证暴露的缺陷与使能缺口集中修复。使能: housou .use(cors()) 跨源调控制面(design §2,dev 放行注释要求上线收紧); lib/housou-url.ts 按 location.hostname:3000 推导 housou 地址,localhost 与 LAN IP 均自动对(替代写死),api/index.ts+BushitsuView 改用之; vite allowedHosts:true 接受 LAN host 头。修复四项: (1)气泡层级 DanmakuOverlay z-index:60 + Teleport 到 ArtPlayer $player,普通/网页/原生全屏均覆盖播放器; (2)全屏 letterbox aspect-ratio 移到 .player-wrap(普通 16:9),player 填满父容器,web-zenmen 取消固定比例填满左列,ArtPlayer 内部 object-fit contain 上下黑边居中,无下方黑占位; (3)聊天可读 ChatPanel 白底深字,全屏黑底下右栏清晰; (4)移除 handler.ts 三处 [DBG] console.error。EnmokuPlayer 用局部窄接口 ArtTemplate 收窄 ArtPlayer 类型禁 any。trellis-check 全绿: 容器内 typecheck/lint/build 通过,housou 16 + kyoushitsu 5 测试不回归,headless dump-dom 自证首页/房间不空白; 视觉正确性由用户最终确认。Out-of-scope: 昵称显示(需协议+store 改动)、原生全屏聊天叠层、canvas 飞屏弹幕。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `815b76d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: LAN/HTTP 下 crypto.randomUUID 崩溃修复（buinId secure-context fallback）

**Date**: 2026-06-14
**Task**: LAN/HTTP 下 crypto.randomUUID 崩溃修复（buinId secure-context fallback）
**Branch**: `k-on`

### Summary

LAN 实跑(9.2 经 http://192.168.9.4:5173 明文 HTTP+非 localhost)整页空白。根因: crypto.randomUUID 受浏览器 secure context 限制,仅 HTTPS/localhost 可用,明文 HTTP+LAN IP 下为 undefined,identity.ts buinId() 抛 TypeError 致 HomeView→pinia store init 链路崩、全站白屏(接 06-14-p0-cors-lan-letterbox LAN 使能链路才暴露;headless 测 localhost 故未抓到)。修法: identity.ts 新增内联 uuidv4()——randomUUID 存在优先用,否则用不受 secure context 限制的 crypto.getRandomValues 拼 RFC-4122 v4(bytes[6]|0x40 置 version=4、bytes[8]|0x80 置 variant=10b,?? 0 处理 noUncheckedIndexedAccess),buinId 改用之,localStorage 持久语义不变。服务端 housou/src/lib/id.ts 跑 Bun 恒安全上下文不动。加 test/identity.test.ts 三例(randomUUID 缺失返回合法 v4/缺失下二次持久一致/存在时不回归),用例间清并恢复全局 crypto 与 localStorage 防污染。trellis-check 0 问题。容器内(./dx 端口被运行中 dev-server 占用,改用等价无端口 docker run)typecheck/lint 全绿、kyoushitsu 8 pass(含新增 3 例)不回归。LAN 白屏消除待用户 9.2 浏览器最终确认。Out: 服务端 id、HTTPS/secure-context 部署方案(自签/反代 TLS,部署期单列)、昵称显示、弹幕引擎。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ddb359a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
