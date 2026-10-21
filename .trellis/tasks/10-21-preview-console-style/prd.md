# 预览控制台样式规整

## Goal

按用户指定的 Trellis Plus 预览控制台样式，整理 `./preview.sh` 的帮助、运行日志和就绪摘要，使操作说明易扫读、日志级别明确、访问地址便于复制。

## Background

- 用户请求：`应用 $trellis-plus 的样式需求，规整一下 preview.sh`；随后以 `建 task` 批准创建任务。
- `preview.sh:5` 转发至 `dx preview`；帮助和日志来自 `dx:23` 起，摘要来自 `scripts/preview-config.py:389` 起，不能仅调整薄入口便完成要求。
- 当前帮助为连续段落；日志使用普通 `dx:` 前缀。Python `CLIStyle.color` 判断 stderr 的 TTY 状态，却也用于 stdout 摘要，且对 URL 加色，缺少语义分层及 `TERM=dumb` 处理。
- 项目已有 Docker 生命周期、地址发现、就绪探测和隔离回归用例。本任务是呈现调整。

## Requirements

- R1：帮助按用途、命令、选项、首次使用、配置、示例清晰分节，保留现有 `--origin`、`--verbose` 和全部命令说明；帮助不读取配置或操作 Docker。
- R2：采用参考规范的语义颜色：标题粗体青色、分节粗体绿色、就绪提示绿色；日志使用 `[log]` 青色、`[warn]` 黄色、`[error]` 红色，帮助和日志输出至 stderr。
- R3：stdout 摘要保留 `System is ready.` 及固定分节顺序、服务分组、URL 去重和空节省略。每个完整 URL 独占一行并保持无 ANSI 的纯文本；不编造路由或入口。
- R4：样式只在实际输出目标为 TTY 时启用；非空 `NO_COLOR` 或 `TERM=dumb` 禁用颜色。stdout 与 stderr 分别判断，重定向不得串色。
- R5：错误继续可操作，保留敏感信息遮蔽、失败退出码及清理前诊断；不因统一前缀把失败变成成功。
- R6：复用原有实现，保留首用准备、实例归属、配置优先级、地址枚举、就绪检查、重复启动与数据保留行为；不引入对 skill 安装目录的运行依赖。

## Acceptance Criteria

- A1（R1、R2）：从仓库外运行 `preview.sh --help` 成功；帮助位于 stderr，包含清晰分节、全部现有命令/选项、实际宿主依赖、首次准备及配置/重启说明；不调用 Docker 或读取 `.env`。
- A2（R2、R4）：终端中的帮助、进度、警告和错误呈现对应语义色；重定向、stdout/stderr 混合 TTY、`NO_COLOR` 和 `TERM=dumb` 情况均符合目标 fd 的颜色规则。
- A3（R3、R6）：成功 start、健康实例复用和 ready status 使用一致摘要；章节顺序、完整 URL、分组和去重符合契约，URL 始终无 ANSI，空节省略。
- A4（R5、R6）：既有预览回归与相关 Shell 检查通过；失败仍非零且无成功摘要，诊断与数据保护断言不削弱。fixture 与真实 Docker 执行结果分开记录。
- A5（R6）：未改变本地 `.env`、数据库、端口/网络配置或用户已有 UI 改动；未修改受保护 Trellis 运行时或新增第三方实现副本。

## Out of Scope

- 浏览器页面、Warm Club UI、UUPM 初始化、Playwright 产品验收。
- Docker 生命周期重构、配置键增删、依赖升级、数据库恢复、README 修改。
- 推送和部署；提交与归档仅按用户后续授权执行。

## Approval State

轻量呈现调整，采用 PRD-only 计划。用户评审计划后以 `开始` 批准实施；验证完成后以 `归档、提交` 批准本任务的提交、归档及正常收尾。推送和部署未授权。
