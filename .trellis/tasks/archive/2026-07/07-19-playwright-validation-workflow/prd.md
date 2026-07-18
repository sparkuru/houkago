# Add Playwright validation workflow

## Goal

Make focused, reproducible Playwright validation the default evidence for browser-accessible frontend changes before Trellis requests human review.

## Confirmed Facts

- The browser client is `packages/kyoushitsu`, a Vue 3 + Vite application.
- Playwright Test is already installed at the repository root. Its existing configuration at `packages/kyoushitsu/playwright.config.ts` targets local Vite at `http://127.0.0.1:5173`, retains traces on failure, and supports host Chromium through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
- Maintained desktop and mobile room Playwright tests live under `packages/kyoushitsu/e2e/`, with desktop and mobile viewport projects.
- Bun and project checks run through `./dx`; no test-runner migration or new browser dependency is needed for this enhancement.

## Requirements

1. Add a durable Trellis workflow rule that classifies each browser-accessible UI task as Playwright-required, existing-equivalent, not-effective, or unavailable before human review is requested.
2. Require focused, reproducible browser coverage for Playwright-required changes, reusing the existing `kyoushitsu` configuration, projects, fixtures, and semantic-locator conventions.
3. Define evidence that records the exact command, covered route/state/interaction/viewport, fixture strategy, result, and residual human risk.
4. Preserve traces, screenshots, logs, and reporter output for failed checks; do not count unavailable automation as passing validation.
5. Extend the frontend quality-check convention with this project's command and existing viewport/test-location evidence, without replacing the current manual-review gate for subjective, real-device, private-environment, or otherwise unautomatable risk.

## Acceptance Criteria

- [ ] `.trellis/workflow.md` requires the automate-first Playwright decision and focused test execution for eligible browser-facing changes before the submit-ready handoff.
- [ ] `.trellis/spec/frontend/index.md` documents the existing Playwright command, configuration location, current browser projects, and required evidence format.
- [ ] The injected rules distinguish a passing browser check from unavailable or ineffective automation and request manual review only for named residual risk.
- [ ] Existing Playwright setup and tests are unchanged.
- [ ] Trellis documentation remains coherent and the diff is limited to the workflow, frontend validation specification, and this task's artifacts.

## Out of Scope

- Installing Playwright, downloading browsers, or changing browser binaries.
- Creating, rewriting, or running a new broad E2E suite.
- Changing application code, existing test files, snapshots, or CI.
- Replacing the current human review gate or UUPM workflow.

## Notes

- This is a lightweight workflow/specification enhancement; PRD-only planning is sufficient.
