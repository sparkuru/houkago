# Implementation plan: danmaku identity and storage pool

## Ordered work

1. Add shared schemas and pure canonical cue serialization/hash input helpers.
2. Add additive tables, indexes, typed row mapping, and atomic query functions.
3. Add `Komon` bootstrap, active-role lookup, authorization helper, and audit.
4. Add identity/search, proposal/decision, policy, track/revision, alignment,
   and collection services plus narrow REST routes.
5. Add focused schema/domain/API tests, secret-field rejection tests, and
   legacy database/Enmoku regression coverage.

## Validation

```sh
./dx bun run --filter houkago-kousoku test
./dx bun run --filter houkago-kokuban test
./dx bun run --filter houkago-housou test
./dx bun run lint
./dx bun run typecheck
```

## Rollback points

- Add tables before routing reads to them; legacy paths remain default until the
  child passes.
- Bootstrap must fail closed for unknown configured usernames and never infer a
  role from registration order.
- Do not enable GC by default; keep it behind explicit configuration until
  active/pin/audit tests pass.

