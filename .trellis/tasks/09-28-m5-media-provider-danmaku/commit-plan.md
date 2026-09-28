# Proposed M5 work commits

The workspace was clean when M5 planning began. Every dirty path below was
created or edited for this M5 task by this session and its assigned agents.
No unrecognized dirty files were present. The owner confirmed the plan with
`可以提交；`. The first work commit is `e6c9535`; the documentation commit is
the second batch below. Nothing has been pushed.

1. `feat(frontend): migrate React room media and danmaku`
   - `bun.lock`
   - `packages/kyoushitsu-react/package.json`
   - `packages/kyoushitsu-react/playwright.config.ts`
   - `packages/kyoushitsu-react/vite.config.ts`
   - `packages/kyoushitsu-react/src/features/room/room-contents.tsx`
   - `packages/kyoushitsu-react/src/features/room/room-runtime.ts`
   - `packages/kyoushitsu-react/src/features/player/` (three files)
   - `packages/kyoushitsu-react/src/features/baidu/` (three files)
   - `packages/kyoushitsu-react/src/features/danmaku/` (three files)
   - `packages/kyoushitsu-react/src/styles/index.css`
   - `packages/kyoushitsu-react/test/room-runtime.test.ts`
   - `packages/kyoushitsu-react/test/baidu-playback.test.ts`
   - `packages/kyoushitsu-react/test/danmaku-feature.test.tsx`
   - `packages/kyoushitsu-react/e2e/real-cookie.spec.ts`
   - `packages/kyoushitsu-react/e2e/media-room.spec.ts`
   - `packages/kyoushitsu-react/e2e/baidu-room.spec.ts`
   - `packages/kyoushitsu-react/e2e/danmaku-room.spec.ts`
   - `packages/kyoushitsu-react/e2e/fixtures/media/`
   - `packages/kyoushitsu/package.json`
   - `packages/kyoushitsu/src/api/resources/http.ts`
   - `packages/kyoushitsu/src/lib/baidu-adapter-detection.ts`
   - `packages/kyoushitsu/src/lib/shinkou-controller.ts`
   - `packages/kyoushitsu/test/http-media-adapters.test.ts`
   - `packages/kyoushitsu/test/shinkou-controller.test.ts`
2. `docs: record M5 media contracts and validation`
   - `.trellis/mainline.md`
   - `.trellis/spec/frontend/quality-guidelines.md`
   - `.trellis/spec/frontend/react-entry-runtime.md`
   - `.trellis/spec/frontend/state-management.md`
   - `.trellis/spec/houkago-kyoushitsu-react/frontend/index.md`
   - `.trellis/spec/houkago-kyoushitsu-react/frontend/room-runtime.md`
   - `.trellis/spec/houkago-kyoushitsu-react/frontend/media-provider-danmaku.md`
   - `.trellis/tasks/09-28-m5-media-provider-danmaku/` (planning, research, manifests, validation and this plan)

After both work commits, Trellis archive and journal bookkeeping remain a
separate finish-work step. The plan contains no push or deployment.
