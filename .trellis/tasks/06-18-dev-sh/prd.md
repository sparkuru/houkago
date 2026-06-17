# dev.sh 启动开发服务

## Goal

在仓库根目录新增 `dev.sh`，让复测时可以一条命令启动后端 `housou` 和前端 `kyoushitsu` 开发服务。

## What I already know

- 项目根 `package.json` 已有 `dev:housou` 和 `dev:kyoushitsu`。
- 宿主机不要求安装 Bun，项目通过 `./dx` 在 `oven/bun:1` 容器中运行命令。
- `./dx` 会暴露后端 3000 和前端 5173；如果端口已占用会跳过发布并打印提示。
- 复测需要同时启动后端和前端。

## Requirements

- 新增根目录 `dev.sh`。
- `./dev.sh` 同时启动 `bun run dev:housou` 和 `bun run dev:kyoushitsu`。
- 通过既有 `./dx` 包装器运行，不要求宿主机安装 Bun。
- 脚本应能响应 Ctrl-C，并尽量清理同容器内启动的两个开发进程。
- 提供 `--help`。
- 脚本使用 Bash strict mode，检查 `docker` 和 `./dx` 是否可用。

## Acceptance Criteria

- [ ] `bash -n dev.sh` 通过。
- [ ] `./dev.sh --help` 输出用法。
- [ ] `./dev.sh` 能启动后端和前端开发服务。
- [ ] 访问前端地址 `http://localhost:5173` 可用于复测。

## Definition of Done

- Shell 语法检查通过。
- 如环境允许，启动脚本实际运行到服务监听。
- 工作区变更清晰，任务可提交归档。

## Out of Scope

- 自动安装依赖。
- 生产构建或 preview。
- 自动打开浏览器。
- 后台守护/日志轮转/进程管理器。

## Technical Approach

使用 Bash 脚本调用：

```bash
./dx bash -lc '<start housou in background; start kyoushitsu in background; wait -n; cleanup>'
```

选择单个 `./dx` 容器运行两个 dev 命令，避免两个容器同时抢占/跳过 3000 和 5173 端口导致前端端口不暴露。

## Technical Notes

- Inspected files: `package.json`, `dx`, `readme.md`, package-level `package.json` files.
- Shell conventions from `code-shellscript` skill apply.
