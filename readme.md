# <center>放課後</center>

Refer to [synctv-core](https://github.com/synctv-org/synctv.git) and [synctv-web](https://github.com/synctv-org/synctv-web.git)

It seems they are no longer actively maintaining, so I do it myself.

**Fully vibe repo** with trellis, thanks to claude and codex.

1. 弹幕渲染引擎采用现成 MIT 引擎 [weizhenye/Danmaku](https://github.com/weizhenye/Danmaku)；
2. 后端（houkago-housou 放送室）：Bun + [Elysia.js](https://github.com/elysiajs/elysia/issues/781)；
3. 弹幕匹配逻辑，参考 [弹弹play开放弹幕网络文档](https://doc.dandanplay.com/open/)；感谢 [@kaedei](https://github.com/kaedei) 的思路分享；

## 公开站点配置

活动室名称、浏览器标题、楼层标识、入口说明和默认部室名统一配置在
`config/config.toml`。这些值会由 Housou 的公开接口返回给浏览器，因此不要在该文件中
保存密钥、OAuth 凭据或其他敏感信息；敏感与运行参数继续由 `.env` 及其现有模块管理。

修改 `config/config.toml` 后需要重启 Housou，并刷新浏览器。配置会在 Housou 启动时
严格校验；未知字段、缺少必填字段或不安全文本会阻止服务启动。
