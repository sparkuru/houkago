# <center>放課後</center>

Refer to [synctv-core](https://github.com/synctv-org/synctv.git) and [synctv-web](https://github.com/synctv-org/synctv-web.git)

It seems they are no longer actively maintaining, so I do it myself.

**Fully vibe repo** with trellis, thanks to claude and codex.

1. 弹幕渲染引擎采用现成 MIT 引擎 [weizhenye/Danmaku](https://github.com/weizhenye/Danmaku)；
2. 后端（houkago-housou 放送室）：Bun + [Elysia.js](https://github.com/elysiajs/elysia/issues/781)；
3. 弹幕匹配逻辑，参考 [弹弹play开放弹幕网络文档](https://doc.dandanplay.com/open/)；感谢 [@kaedei](https://github.com/kaedei) 的思路分享；

