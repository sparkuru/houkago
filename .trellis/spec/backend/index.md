# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains guidelines for backend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Done |
| [Database Guidelines](./database-guidelines.md) | ORM patterns, queries, migrations | Done |
| [Error Handling](./error-handling.md) | Error types, handling strategies | Done |
| [Public URL Preview Contract](./url-preview-contract.md) | Read-only source preview, error matrix, and queue handoff | Done |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Done |
| [Logging Guidelines](./logging-guidelines.md) | Structured logging, log levels | Done |
| [Seitoshou Authentication](./seitoshou-contract.md) | Account, session, REST, and WebSocket authority boundary | Done |

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

Before backend work is submit-ready, run the repository checks through `./dx`:

- `./dx bun run format`
- `./dx bun run lint`
- `./dx bun run typecheck`
- `./dx bun test`

Use focused package tests while iterating, then the full suite before commit.
Apply the Trellis Submit-Ready Human Review Gate from `.trellis/workflow.md`
when backend behavior depends on real upstream services, credentials,
production-like data, permissions, deletion, migrations, or browser smoke tests
that automated fixtures cannot cover.
