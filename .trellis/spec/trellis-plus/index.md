# Trellis Plus Project Policy

This directory is project-owned durable guidance. It records Houkago decisions
that connect Trellis to the repository; it is not a replacement for Trellis's
workflow, scripts, agents, task schema, or platform integrations.

## Ownership and recovery boundary

- `.trellis/workflow.md`, `.trellis/config.yaml`, `.trellis/.gitignore`,
  `.trellis/.version`, `.trellis/.template-hashes.json`,
  `.trellis/scripts/**`, `.trellis/agents/**`, and Trellis-managed files under
  `.codex/`, `.claude/`, and `.agents/` are init-owned. Keep the current init
  output for these paths; never restore an older Trellis Plus copy over them.
- Tasks, task evidence, workspace journals, `mainline.md`, `.developer`, the
  active-task pointer, and project-authored specs are durable project state.
  Restore or merge them selectively; never replace the whole `.trellis/`
  directory.
- `design.md` is user-authored project work. Trellis Plus reconciliation must
  not edit it, stage it, or reinterpret its uncommitted changes.
- Do not copy third-party workflow, script, skill, template, or license text
  into this policy. If a recovered file has unclear provenance, keep it outside
  the project in the recovery backup and report either
  `license-notice-needed` or `provenance-review-needed` before restoring it.
- Reconciliation does not install packages, fetch external resources, change
  project license files, or create commits. Broad staging commands are not part
  of the workflow.

## Mainline Continuity

For a project-relevant status, continuation, or next-step request, read
`.trellis/mainline.md`, active and archived task evidence, the Git state, and
available validation results. Report the initiative/evidence, exact dirty or
blocked conditions, one candidate only when it is uniquely ready, and the next
permitted action.

The control record defaults to guided operation with no serial authorization.
Do not infer priority, create or start work, or edit product files until the
user has chosen the relevant scope and the normal Trellis planning gates have
been satisfied. Treat `.trellis/mainline.md` as the current initiative record
and active or archived task artifacts as the requirements and evidence source;
do not duplicate transient task status in this durable policy.

Trellis parent/child tasks remain the source of requirements, plans, checks,
commits, and archive history. Mainline is a small continuity record, not a
second task system. A serial initiative may be followed only when the control
record contains explicit bounded authorization, an ordered child, readiness
evidence, and stop conditions.

## Docker dev-command bootstrap

The repository already has one project wrapper, `./dx`; do not create a
competing `hako` wrapper. Evidence is the root `dx` script, `package.json`,
`bun.lock`, `.devhome/`, and the package scripts. `./dx` runs Bun commands in
`oven/bun:1`, maps the current uid, uses the repo-local `.devhome`, and can
publish the known housou/API port `3000` and kyoushitsu/Vite port `5173`.

Use the existing commands for development and checks, including:

- `./dx bun install`
- `./dx bun run format`
- `./dx bun run lint`
- `./dx bun run typecheck`
- `./dx bun run test`
- `./dev.sh` to start the documented housou and kyoushitsu services, stopped
  with Ctrl-C

The existing `dev.sh` accepts `--origin`; it does not provide a `down`
subcommand. Do not describe or add one as part of this reconciliation. Do not
add broad raw `docker`, `bash`, or package-manager allow rules. The current
Codex personal rules already contain the narrow `./dx` approval rule. Claude
local permissions are optional and must remain untracked and user-directed.

## UI/UX Pro Max integration

Houkago is a frontend/UI project: `packages/kyoushitsu` is a Vue/Vite client
with user-facing room, player, danmaku, subtitle, and responsive interactions.
The active Codex platform has a complete project-local UUPM entry point at
`.codex/skills/ui-ux-pro-max/SKILL.md`; its read-only `search.py --help` check
passed during this reconciliation. Do not reinstall it or run a broad
`uipro init` while it is complete.

For a UI task, read UUPM and the relevant frontend/package specs during
planning. Keep raw design research and task-specific decisions in that task's
research and `design.md`; promote only stable, project-approved rules here.
Do not persist unreviewed generated design output or create a competing
`design-system/MASTER.md` merely to integrate UUPM. Check responsive states,
accessible names/focus, touch targets, loading/error/permission states, reduced
motion, and semantic interaction behavior before delivery.

## Trellis Plus: Playwright Validation Profile

- execution mode: project-local; use the repository Playwright dependency and
  the host Chrome executable when required
- setup/install: `./dx bun install`; the current host command uses
  `/usr/bin/google-chrome` through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`
- app readiness: run `./dev.sh`; frontend/base URL is
  `http://127.0.0.1:5173` and the housou backend is
  `http://127.0.0.1:3000`; stop the foreground services with Ctrl-C
- focused test command:
  `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts --project=phone-375 --grep "portrait chat opens, expands, and closes as a modal sheet"`
- full/CI browser command:
  `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts`
- test location and config: tests are under
  `packages/kyoushitsu/e2e/`; config is
  `packages/kyoushitsu/playwright.config.ts`
- browser projects and supported viewports: `phone-375` 375x812,
  `ipad-mini` 768x1024, `desktop-short` 1280x640, `desktop-tall` 1280x1200,
  `subtitle-phone` 375x812, `subtitle-desktop` 1280x900,
  `governance-phone` 375x812, `governance-desktop` 1280x900,
  `danmaku-phone` 375x812, and `danmaku-desktop` 1280x900
- fixtures and test-data boundary: existing tests use controlled
  `page.route` mocks, fixture media/origins, and test accounts; never use
  production credentials or production data
- accessibility policy: use semantic roles, labels, visible text, focus, and
  state assertions; no global axe scan is configured
- visual baseline policy: no approved screenshot baseline is part of the
  repository; screenshots are diagnostic evidence only and are never updated
  automatically
- failure artifacts: Playwright retains traces on failure; preserve its
  reporter output and attachments under `packages/kyoushitsu/test-results`
  when a check fails; do not claim network capture is globally configured

For a browser-accessible change, classify the task before asking for human
review. Prefer a focused reproducible test with semantic locators and the
affected narrow/desktop projects. Record the exact command, coverage, fixture
boundary, result, and any residual human-only risk in task check evidence.

## Trellis Plus: Submit-Ready Human Review Gate

Before proposing a work commit or marking a task complete, compare the diff,
task requirements, and validation results. Choose `human-required`,
`human-optional`, or `human-not-needed`.

- Require human input for skipped material checks, unavailable browser
  automation, subjective product/visual decisions, real-device or assistive
  technology checks, private/credentialed upstream behavior, auth,
  permissions, migration, deletion, deployment, or other irreversible risk.
- After a passing focused Playwright check, do not ask for a generic browser
  smoke test; ask only about the residual subjective, real-device,
  assistive-technology, private-environment, or security-sensitive risk.
- A required review request names the changed path, checks already run, the
  exact manual scenarios, useful evidence format, and only decisions that
  affect commit readiness.
- If no meaningful human judgment remains, state the concrete reason and do not
  create a ceremonial review request.

Project checks before submit-ready are the repository commands above. Use
focused package tests while iterating and the full suite before commit; keep
browser evidence separate from ordinary Bun test evidence.

## ChatGPT/Codex commit attribution

For a proposed Phase 3.4 work commit, decide whether ChatGPT/Codex made a
substantial author-level contribution. When the answer is yes, use the exact
trailer `Co-authored-by: OpenAI Codex <codex@openai.com>` and a concise task
completion body covering the request/root cause when relevant, implementation
boundaries, validation, and meaningful follow-up. Show the body, trailer, and
attribution reason in the commit plan before requesting confirmation.

Do not add the trailer merely because Codex touched a file. Omit it for small
mechanical changes, user-authored or unrecognized files, task archive commits,
journal commits, and commits the user will make manually. Never automatically
stage or commit as part of this policy.
