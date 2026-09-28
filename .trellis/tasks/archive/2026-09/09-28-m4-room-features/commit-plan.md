# M4 commit plan

Proposed work commits, in order. Do not push. Archive and journal commits follow
only after the user approves and these work commits succeed.

## 1. `feat(frontend): migrate room features to React`

```text
dev.sh
packages/kyoushitsu-react/e2e/entry.spec.ts
packages/kyoushitsu-react/e2e/real-cookie.spec.ts
packages/kyoushitsu-react/playwright.config.ts
packages/kyoushitsu-react/src/app/router.tsx
packages/kyoushitsu-react/src/features/entry/entry-panel.tsx
packages/kyoushitsu-react/src/features/room/chat-panel.tsx
packages/kyoushitsu-react/src/features/room/governance-panel.tsx
packages/kyoushitsu-react/src/features/room/queue-panel.tsx
packages/kyoushitsu-react/src/features/room/room-contents.tsx
packages/kyoushitsu-react/src/features/room/room-runtime.ts
packages/kyoushitsu-react/src/lib/legacy-room-url.ts (delete)
packages/kyoushitsu-react/src/lib/room-id.ts
packages/kyoushitsu-react/src/routes/room-handoff.tsx (delete)
packages/kyoushitsu-react/src/routes/room.tsx
packages/kyoushitsu-react/src/styles/index.css
packages/kyoushitsu-react/test/legacy-room-url.test.ts (delete)
packages/kyoushitsu-react/test/room-http.test.ts
packages/kyoushitsu-react/test/room-id.test.ts
packages/kyoushitsu-react/test/room-runtime.test.ts
packages/kyoushitsu-react/vite.config.ts
packages/kyoushitsu/package.json
packages/kyoushitsu/src/api/resources/http.ts
packages/kyoushitsu/src/lib/room-session.ts
scripts/dev-react-preview.sh
scripts/test-react-preview.sh
```

## 2. `docs: record M4 room contracts and validation`

```text
.trellis/config.yaml
.trellis/mainline.md
.trellis/spec/frontend/http-contract-resources.md
.trellis/spec/frontend/react-entry-runtime.md
.trellis/spec/houkago-kyoushitsu/frontend/index.md
.trellis/spec/houkago-kyoushitsu-react/frontend/index.md
.trellis/spec/houkago-kyoushitsu-react/frontend/room-runtime.md
.trellis/tasks/09-28-m4-room-features/check.jsonl
.trellis/tasks/09-28-m4-room-features/commit-plan.md
.trellis/tasks/09-28-m4-room-features/design.md
.trellis/tasks/09-28-m4-room-features/implement.jsonl
.trellis/tasks/09-28-m4-room-features/implement.md
.trellis/tasks/09-28-m4-room-features/prd.md
.trellis/tasks/09-28-m4-room-features/research/current-room-boundaries.md
.trellis/tasks/09-28-m4-room-features/task.json
.trellis/tasks/09-28-m4-room-features/validation.md
```

Unrecognized dirty files: none. All listed paths were created or edited for
this M4 task; the retained Vue source is outside the plan.
