# Implementation plan: Baidu release danmaku matching

## Ordered work

1. [x] Add pure filename normalization/extraction, weighted evidence,
   explanation, ambiguity, and mismatch tests in kokuban.
2. [x] Add safe Baidu-release derivation and candidate/match/confirmation/proposal
   routes on top of the common pool.
3. [x] Add a versioned optional adapter partial-fingerprint capability with strict
   source/room/device/origin/nonce binding and secret scans.
4. [x] Add candidate confirmation UI through the common source panel; keep
   selection and proposal submission separate.
5. [x] Test exact approved reuse, unseen high-score confirmation, different
   encodes sharing an episode/track with distinct alignment, no-adaptor/unsafe
   fallback, and failure without playback interruption.

## Completion evidence

- `kokuban` owns the provider-neutral filename parser, weighted score
  explanation, deterministic ranking, bounded evidence, and conservative
  warnings. It never receives or emits a source path.
- `housou` derives a room-bound Baidu release, persists only safe evidence,
  returns typed confirmation candidates, and delegates confirmation scope to
  the existing personal/room/Komon match authority. An invalid matcher input
  leaves the original Baidu playback URL untouched.
- `houkago-adapter` exposes the optional `baidu.media.fingerprint` capability;
  only the paired desktop adaptor claims the sentinel grant and the content
  script reads the bounded prefix. The page response contains typed MD5
  metadata, never the dlink or bytes.
- `kyoushitsu` presents explainable candidates with a 44px keyboard target,
  explicit confirmation, and an `aria-live` result/error message. A failed
  confirmation is caught and does not interrupt playback.

## Validation

```sh
./dx bun run --filter houkago-kokuban test
./dx bun run --filter houkago-kousoku test
./dx bun run --filter houkago-housou test
./dx bun run --filter houkago-adapter test
./dx bun run --filter houkago-kyoushitsu test
./dx bun run typecheck
```

Use controlled byte fixtures for Range/hash tests. Real Baidu credentials and
private URLs must not enter test output or task artifacts.

Focused validation evidence from this slice:

```text
./dx bun run --filter houkago-kokuban test       11 pass
./dx bun run --filter houkago-kousoku test        6 pass
./dx bun test packages/housou/test/baidu-danmaku-matching.test.ts
                                                    3 pass
./dx bun run --filter houkago-adapter test       42 pass
./dx bun run --filter houkago-kyoushitsu test   139 pass
./dx bun run typecheck                            pass
```

The root `./dx bun test` invocation also loads legacy REST and Playwright
files concurrently; that existing aggregate runner reported unrelated fixed
username/database and Playwright-suite registration failures. The affected
Kokuban, Housou danmaku foundation/source, adapter, Kousoku, and Kyoushitsu
focused suites pass in isolated runs.

## Rollback points

- Fingerprint capability is optional; absence falls back to explainable weak
  evidence/manual confirmation.
- Never persist or auto-adopt a weighted match as global knowledge.
- Disable the Baidu matcher independently while retaining Baidu source playback
  and the common resolver for other providers.
