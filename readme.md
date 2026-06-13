# 放課後

refer to [synctv-core](https://github.com/synctv-org/synctv.git) and [synctv-web](https://github.com/synctv-org/synctv-web.git)

It seems they are no longer actively maintaining, so I do it myself.

fully vibe repo with trellis, thanks to claude and codex.

## 技术决策

- 弹幕渲染引擎：采用现成 MIT 引擎 [`weizhenye/Danmaku`](https://github.com/weizhenye/Danmaku)（canvas），不自研。
- 后端（houkago-housou 放送室）：**Bun + Elysia.js**。spike 实测 6/6 能力探针全过，硬指标 [Elysia #781](https://github.com/elysiajs/elysia/issues/781)（非 WS 上下文全局 `publish` 到房间 topic）PASS，故未退 Fastify-on-Bun。结论详见 [`.trellis/tasks/06-13-elysia-js-spike-bun/research/elysia-spike-results.md`](.trellis/tasks/06-13-elysia-js-spike-bun/research/elysia-spike-results.md)。

