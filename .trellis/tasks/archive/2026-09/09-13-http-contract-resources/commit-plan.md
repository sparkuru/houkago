# M2 commit plan

The final quality gate passed and the user approved this batch with `ok` on
2026-09-26. Existing M2 work was inspected and completed as part of this task.

## 1. `feat(http): add checked OpenAPI and resource boundaries`

- `biome.json`
- `bun.lock`
- `package.json`
- `packages/eisha/src/routes.ts`
- `packages/housou/package.json`
- `packages/housou/src/index.ts`
- `packages/housou/src/routes/baidu.ts`
- `packages/housou/src/routes/bushitsu.ts`
- `packages/housou/src/routes/danmaku.ts`
- `packages/housou/src/routes/seitoshou.ts`
- `packages/housou/src/routes/site-config.ts`
- `packages/housou/src/ws/handler.ts`
- `packages/kousoku/src/index.ts`
- `packages/kyoushitsu/package.json`
- `packages/kyoushitsu/src/api/index.ts`
- `openapi-ts.config.ts`
- `packages/housou/openapi.json`
- `packages/housou/src/export-openapi.ts`
- `packages/housou/src/lib/http-contract.ts`
- `packages/housou/test/http-contract.test.ts`
- `packages/kousoku/src/http.ts`
- `packages/kyoushitsu/openapi.json`
- `packages/kyoushitsu/src/api/generated/client.gen.ts`
- `packages/kyoushitsu/src/api/generated/client/client.gen.ts`
- `packages/kyoushitsu/src/api/generated/client/index.ts`
- `packages/kyoushitsu/src/api/generated/client/types.gen.ts`
- `packages/kyoushitsu/src/api/generated/client/utils.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/auth.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/bodySerializer.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/params.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/pathSerializer.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/queryKeySerializer.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/serverSentEvents.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/types.gen.ts`
- `packages/kyoushitsu/src/api/generated/core/utils.gen.ts`
- `packages/kyoushitsu/src/api/generated/index.ts`
- `packages/kyoushitsu/src/api/generated/sdk.gen.ts`
- `packages/kyoushitsu/src/api/generated/types.gen.ts`
- `packages/kyoushitsu/src/api/http-client.ts`
- `packages/kyoushitsu/src/api/resources/http.ts`
- `packages/kyoushitsu/src/api/resources/keys.ts`
- `packages/kyoushitsu/src/api/resources/policy.ts`
- `packages/kyoushitsu/test/http-contract-types.test.ts`
- `packages/kyoushitsu/test/http-contract.test.ts`
- `packages/kyoushitsu/test/resources.test.ts`
- `packages/kyoushitsu/tsconfig.contract.json`
- `scripts/check-contract-drift.ts`
- `scripts/prepare-page-openapi.ts`
- `scripts/verify-http-contract.ts`

## 2. `docs: record M2 contracts and validation`

- `.trellis/mainline.md`
- `.trellis/spec/frontend/quality-guidelines.md`
- `.trellis/spec/houkago-eisha/backend/index.md`
- `.trellis/spec/houkago-housou/backend/index.md`
- `.trellis/spec/houkago-kousoku/backend/index.md`
- `.trellis/spec/houkago-kyoushitsu/frontend/index.md`
- `.trellis/tasks/09-12-frontend-refactor-plan/roadmap.md`
- `.trellis/tasks/09-12-frontend-refactor-plan/task.json`
- `.trellis/spec/frontend/http-contract-resources.md`
- `.trellis/tasks/09-13-http-contract-resources/check.jsonl`
- `.trellis/tasks/09-13-http-contract-resources/design.md`
- `.trellis/tasks/09-13-http-contract-resources/implement.jsonl`
- `.trellis/tasks/09-13-http-contract-resources/implement.md`
- `.trellis/tasks/09-13-http-contract-resources/prd.md`
- `.trellis/tasks/09-13-http-contract-resources/research/contract-inventory.md`
- `.trellis/tasks/09-13-http-contract-resources/research/implementation-evidence.md`
- `.trellis/tasks/09-13-http-contract-resources/task.json`
- `.trellis/tasks/09-13-http-contract-resources/commit-plan.md`
- `.trellis/tasks/09-13-http-contract-resources/validation.md`
- `.trellis/tasks/09-13-http-contract-resources/research/check-evidence.md`

## Excluded existing change

- `dev.sh`: pre-existing frontend/backend URL edits; preserve and do not stage.

## Finish after approval

Archive M2, synchronize the archived mainline pointer, and record the session
journal after the work commits. Do not push or start M3.
