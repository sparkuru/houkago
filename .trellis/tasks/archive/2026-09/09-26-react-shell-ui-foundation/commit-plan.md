# M3 proposed commit batch

Prepared 2026-09-26 after implementation, independent checking and real preview
teardown. The owner approved this presented batch with `提交` on 2026-09-26, including
the scoped residual-review gate under workflow Phase 3.4. Execution is authorized. See [validation.md](validation.md).

## Proposed work commits, in order

### 1. `feat(frontend): add parallel React entry and Vue room handoff`

Files (directory entry means all non-ignored source/config/tests therein):

- `packages/kyoushitsu-react/`
- `package.json`
- `bun.lock`
- `dx`
- `scripts/dev-react-preview.sh`
- `scripts/test-react-preview.sh`
- `packages/kyoushitsu/package.json`
- `packages/kyoushitsu/vite.config.ts`
- `packages/kyoushitsu/src/api/public.ts`
- `packages/kyoushitsu/src/api/http-client.ts`
- `packages/kyoushitsu/src/api/resources/http.ts`
- `packages/kyoushitsu/src/lib/site-config-core.ts`
- `packages/kyoushitsu/src/lib/site-config.ts`
- `packages/kyoushitsu/src/i18n/index.ts`
- `packages/kyoushitsu/src/i18n/messages.ts`
- `packages/kyoushitsu/e2e/desktop-room.spec.ts`
- `packages/kyoushitsu/e2e/room-governance.spec.ts`

Exact message:

```text
feat(frontend): add parallel React entry and Vue room handoff

Add an opt-in React Router/Query entry with Warm Club controls and
cookie identity, authentication, create/join and safe same-window Vue
room handoff. Keep Vue default and reuse the generated M2 HTTP boundary.

Fence private state by epoch, retain root-owned queries across StrictMode
subscriptions and reconcile uncertain auth outcomes without command replay.
Add an isolated memory-backed preview and stabilize Vue admission fixtures.

Verified 465 tests, 56 browser cases and 124 shell checks, workspace
typechecks/lint/drift and both builds. React graph excludes legacy runtimes;
generated contracts and backend production code remain unchanged.
Room/media migration and cutover remain later stages.

Co-authored-by: OpenAI Codex <codex@openai.com>
```

Attribution: Codex authored the runtime/features/primitives, portability and
preview work, and regression fixes/tests; this is substantial authorship.

### 2. `docs: record M3 runtime contracts and validation`

Files:

- `.trellis/mainline.md`
- `.trellis/spec/frontend/react-entry-runtime.md`
- `.trellis/spec/frontend/http-contract-resources.md`
- `.trellis/spec/frontend/site-configuration.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/spec/houkago-kyoushitsu/frontend/index.md`
- `.trellis/spec/houkago-kyoushitsu/frontend/component-guidelines.md`
- `.trellis/tasks/09-12-frontend-refactor-plan/prd.md`
- `.trellis/tasks/09-12-frontend-refactor-plan/roadmap.md`
- `.trellis/tasks/09-12-frontend-refactor-plan/task.json`
- `.trellis/tasks/09-26-react-shell-ui-foundation/` (PRD/design/plan/manifests,
  dependency/UI/reuse research, regression analysis, check/validation evidence,
  task metadata and this commit plan)

Exact message:

```text
docs: record M3 runtime contracts and validation

Document React query ownership, epoch fences, auth reconciliation,
safe Vue handoff and isolated preview lifecycle using verified code paths.
Record M3 authorization, compatibility decisions, per-acceptance evidence
and resolved failure traces; preserve M4-M6 stage boundaries.

Capture 465-test, 56-browser-case and 124-shell-check validation with
build/type/lint/drift and actual preview teardown. Synchronize the active
child and mainline without completing the planning parent.

Co-authored-by: OpenAI Codex <codex@openai.com>
```

Attribution: Codex authored the contracts, research and executable evidence
records; this is substantial documentation authorship.

## Unrecognized / excluded dirty files

- `dev.sh`: pre-existing displayed URL substitutions; preserve it and exclude
  from every batch. No other unrecognized dirty file is currently present.
- Build outputs, node_modules, browser traces and `/tmp` screenshots are not
  staged. Generated API/OpenAPI/backend production paths have no changes.

Recheck dirty state immediately before staging; any newly unrecognized path stays
outside the batch. Do not amend or push.

## Authorized finish after confirmation

Record human acceptance and Phase 3.4 approval in task evidence, then execute the
two work commits in order. Only after they succeed, use Trellis tooling to archive
M3, synchronize its parent/mainline pointers and record the developer journal.
Archive/journal bookkeeping commits carry no Codex co-author trailer. The parent
stays planning; M4–M6 do not start. `dev.sh` remains dirty and preserved.

One-shot review: accept the Warm Club desktop/phone forms and cards, auth feedback
and approved same-window handoff, and execute this batch plus M3 archive/journal;
or give specific screen/state changes, or choose `manual` / `我自己来`.
