# <center>放課後</center>

Refer to [synctv-core](https://github.com/synctv-org/synctv.git) and [synctv-web](https://github.com/synctv-org/synctv-web.git)

It seems they are no longer actively maintaining, so I do it myself.

**Fully vibe repo** with trellis, thanks to claude and codex.

1. 弹幕渲染引擎采用现成 MIT 引擎 [weizhenye/Danmaku](https://github.com/weizhenye/Danmaku)
2. 后端（houkago-housou 放送室）：Bun + [Elysia.js](https://github.com/elysiajs/elysia/issues/781)，结论详见 [`.trellis/tasks/06-13-elysia-js-spike-bun/research/elysia-spike-results.md`](.trellis/tasks/06-13-elysia-js-spike-bun/research/elysia-spike-results.md)。

test flow: 

- `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`
- `https://test-streams.mux.dev/tos_ismc/main.m3u8`
- `https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8`