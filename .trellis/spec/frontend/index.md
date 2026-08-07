# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains guidelines for frontend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Done |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Done |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Done |
| [State Management](./state-management.md) | Local state, global state, server state | Done |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Done |
| [Type Safety](./type-safety.md) | Type patterns, validation | Done |
| [Baidu Adapter Contract](./baidu-adapter-contract.md) | Page/extension protocol, exact origins, UI gating, and browser transport | Done |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.

---

## Quality Check

Before frontend work is submit-ready, run the repository checks through `./dx`:

- `./dx bun run format`
- `./dx bun run lint`
- `./dx bun run typecheck`
- `./dx bun run test` (all Bun suites; Playwright remains a separate runner)

Browser-visible changes require the Trellis Submit-Ready Human Review Gate from
`.trellis/workflow.md`. Ask for manual feedback for player controls, room
layout, fullscreen modes, chat ergonomics, danmaku rendering, Bilibili provider
metadata, and any visual/copy change that automated tests cannot judge.

## Playwright Browser Validation

The existing browser-test convention is Playwright Test. Keep its configuration
in `packages/kyoushitsu/playwright.config.ts` and tests in
`packages/kyoushitsu/e2e/`; do not create a competing browser-test setup.

The configured projects are `phone-375` and `ipad-mini` for
`mobile-room.spec.ts`, plus `desktop-short` and `desktop-tall` for
`desktop-room.spec.ts`. Reuse the applicable project and add focused coverage
next to the existing tests. Prefer roles, labels, and visible user-facing text
over CSS or DOM-structure selectors unless no stable semantic surface exists.

The local frontend/control-plane stack must be running and reachable at the
configured base URL before the browser test starts. In the current host setup,
run the suite with the host Chrome executable:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

For a focused path, retain the same configuration and add an explicit selector,
for example `--grep "<test title>"`. The configuration retains traces on
failure; keep trace, screenshot, reporter, console, and network artifacts when
a check fails. Do not regenerate screenshot baselines automatically.

Before submit-ready, classify a browser-accessible change according to the
Playwright rule in `.trellis/workflow.md` and record:

```markdown
Browser validation: Playwright passed | unavailable | not effective
- command: <exact command>
- coverage: <routes, states, interactions, viewports>
- fixtures: <none or controlled fixture/mock summary>
- residual human review: <none or specific remaining risk>
```

A passing focused browser check replaces a generic browser smoke-test request,
not targeted review of residual visual, real-device, private-environment,
assistive-technology, security-sensitive, or subjective product risk.

## UI/UX Pro Max Workflow

For a user-visible frontend task, use the project-local Codex UUPM skill at
`.codex/skills/ui-ux-pro-max/SKILL.md` during planning. Keep raw design-system
research inside the active task, make approved decisions in `design.md`, and
promote only stable rules back into this frontend specification after validation.
