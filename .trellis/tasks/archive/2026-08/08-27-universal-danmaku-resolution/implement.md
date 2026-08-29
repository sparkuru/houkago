# Implementation plan: universal danmaku source resolution

## Parent execution model

The parent owns requirements, shared design, dependency ordering, and final
integration review. It does not directly edit product code. Each child must
finish its own design, implementation plan, manifests, focused checks, and
archive evidence before the next dependent slice is considered ready.

## Ordered delivery

1. `08-28-danmaku-identity-pool`
   - Add `Komon` bootstrap/authorization and the provider-neutral identity,
     evidence, proposal, audit, content-addressed pool, revision, alignment,
     policy, and retention foundations.
   - Prove additive SQLite bootstrap and legacy `Enmoku.danmaku` compatibility.
2. `08-28-danmaku-hybrid-selection`
   - Add candidate/default contracts, owner-persisted room truth,
     viewer-local override, policy management, and `useTimelineDanmaku`.
   - Validate all source-panel states on desktop and phone without changing
     playback or realtime `DANMAKU`.
3. `08-28-danmaku-source-migration`
   - Lazily ingest/refresh Bilibili official tracks through the pool and move
     current local Bilibili-XML files behind the common personal-candidate path.
   - Remove the page-level provider guard and hard-coded local/fetched winner
     only after common-path regression coverage passes.
4. `08-28-baidu-danmaku-matching`
   - Add safe Baidu release evidence, optional authorized first-16-MiB MD5,
     explainable candidate ranking, confirmation/proposal, and exact approved
     reuse through the common resolver.
5. Parent integration review
   - Exercise two source classes mapping to one episode/track, full precedence,
     proposal/promotion, refresh/rollback, safe failure, and legacy regression.
   - Update durable specs only after checked behavior exists.
6. Parent integration completion
   - Add a user-facing manual episode search/correction path that confirms only
     the current viewer's release-to-episode association.
   - Wire the bounded Baidu client/adaptor fingerprint into the candidate
     resolution request while preserving the playback and credential boundary.
   - Add one Bilibili-plus-Baidu cross-provider fixture and browser evidence for
     the match/correction controls, including responsive behavior.

## Shared validation matrix

| Boundary | Required evidence |
| --- | --- |
| kousoku | strict schemas reject mixed digest scopes, invalid source classes, and malformed authority states |
| kokuban | canonicalization is stable; equal cues hash equally; filename scoring is deterministic and explainable |
| housou DB | additive bootstrap, round-trip identity/provenance, transactional promotion/rollback, GC protection |
| housou auth/API | Seitoshou/Origin checks, Buchou vs Komon separation, proposal idempotence, no private Baidu material |
| eisha | bounded provider fetch, parser/error mapping, unchanged/changed/failure refresh cases |
| kyoushitsu | precedence, localStorage isolation, authoritative room default, loading/empty/error/disabled states |
| browser | 375px and desktop selection, keyboard/focus/touch targets, source failure without playback interruption |
| regression | Bilibili/Baidu/direct/HLS/DASH/local playback, realtime DANMAKU, sync, fullscreen, and room queue |

## Repository quality gate

```sh
./dx bun run format
./dx bun run lint
./dx bun run typecheck
./dx bun run test
./dx bun run --filter houkago-kyoushitsu build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome node_modules/.bin/playwright test --config packages/kyoushitsu/playwright.config.ts
```

Each child starts with focused package tests, then runs the relevant subset of
the quality gate. The parent closes only after the full gate and integration
browser evidence are recorded. Real provider credentials are not required for
automated acceptance; controlled fixtures prove the contracts, while any
real-provider residual risk is called out for human review.

## Rollback points

- After schema/bootstrap: legacy databases open without destructive migration.
- After resolver introduction: disabling it restores legacy
  `Enmoku.danmaku` behavior.
- After selection: invalid preferences fall through without rewriting either
  room or viewer choice.
- After source migration: Bilibili failure still yields no timeline track and
  does not affect video.
- After Baidu matching: no weak evidence can create or auto-adopt a global
  association, and no media/private provider material reaches `housou`.
- Before parent completion: GC remains disabled unless its protection and audit
  tests pass.
