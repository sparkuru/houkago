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
- `./dx bun test`

Browser-visible changes require the Trellis Submit-Ready Human Review Gate from
`.trellis/workflow.md`. Ask for manual feedback for player controls, room
layout, fullscreen modes, chat ergonomics, danmaku rendering, Bilibili provider
metadata, and any visual/copy change that automated tests cannot judge.
