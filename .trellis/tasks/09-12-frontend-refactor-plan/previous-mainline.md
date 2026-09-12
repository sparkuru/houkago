# Trellis Mainline

## Initiative

- title: Houkago visual experience refresh
- parent task: `.trellis/tasks/08-29-visual-experience-refresh`
- objective: Raise the perceived quality, hierarchy, and cohesion of Houkago's
  entry and shared watch-room experience without changing its media-first,
  URL-first, player, room, or credential boundaries.
- owner decisions: 2026-08-07 — queue placement remains owner-only; room guest
  controls persist per room and use chat/playback/playlist presets with optional
  fine-grained switches. 2026-08-07 — subtitle selection is viewer-local,
  HLS-only, and resets to Off for each new Enmoku; audio controls remain
  deferred until named audio metadata is available. 2026-08-07 — Baidu Netdisk
  uses a desktop client adaptor with server-saved and user-held credential
  modes; mobile Baidu playback remains deferred. 2026-08-28 — after the
  provider-neutral danmaku pool, hybrid selection, and Bilibili/local source
  migration slices completed, the user approved Baidu release danmaku matching
  as the next bounded mainline slice. 2026-08-29 — the parent danmaku
  integration completed manual episode correction, bounded Baidu fingerprint
  reuse, and cross-provider/browser evidence while preserving personal and
  audited global trust boundaries. 2026-08-29 — the user paused the mobile
  provider companion and selected project-wide visual polish as the next
  mainline direction. 2026-08-29 — the user approved an evolutionary
  `Warm Club 2.0` direction rather than a broad visual rebrand; implementation
  remains gated on delivery-slice planning. 2026-08-29 — the user chose an
  asset-light, quiet school-floor/classroom-selection metaphor for the entry
  experience, with no unrelated decorative focal point. 2026-08-29 — the user
  approved a single Anime.js signature: one cancellable floor-sign/classroom
  entrance plus short panel replacement, with all other atmosphere static.
  2026-08-30 — the user approved the resulting entry atmosphere and requested
  that its fixed identity become a strict public `config/config.toml` surface,
  defaulting to `社团活动室`; secrets and operational values remain in `.env`.
  Firefly is the contract reference, adapted to Houkago through Housou runtime
  projection rather than Astro build-time embedding. 2026-08-30 — the user
  authorized planning the room-shell/media/workbench hierarchy follow-up while
  keeping dense queue controls and dialog/chat content polish as later slices.

## Continuation

- mode: guided
- serial authorization: none
- next pulse: commit-plan review for `.trellis/tasks/08-30-warm-club-visual-followup`

## Ordered Work

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| 1 | `.trellis/tasks/archive/2026-08/08-05-room-governance-foundation` | complete | Durable membership and owner governance delivered in `de93b07`; full-suite and applicable browser validation recorded by the archived task. |
| 2 | `.trellis/tasks/archive/2026-08/08-06-room-governance-hardening` | complete | Authorization, reconnection, revocation, and desktop/phone governance coverage delivered in `7760e19`; full-suite and Playwright validation passed. |
| 3 | `.trellis/tasks/archive/2026-08/08-07-queue-management` | complete | Owner-only durable queue placement, full-snapshot sync, and responsive browser coverage delivered in `261c30e`; task archival and journal follow the final workflow steps. |
| 4 | `.trellis/tasks/archive/2026-08/08-07-control-policy` | complete | Durable room policy, safe legacy fallback, owner-only control UI, and desktop/phone evidence delivered in `04509ce`; task archival and journal follow the final workflow steps. |
| 5 | `.trellis/tasks/archive/2026-08/08-07-subtitle-audio-ui` | complete | Viewer-local HLS subtitle selection, controlled desktop/phone browser coverage, and player ownership contract delivered in `8d2c9f7`; task archival and journal follow the final workflow steps. |
| 6 | `.trellis/tasks/archive/2026-08/08-07-baidu-netdisk-adaptor` | complete | Direct official OAuth, both retention modes, read-only browsing, token-free grants, Firefox real-account/reference evidence, and shared Firefox/Chromium automated builds are complete and archived. |
| 7 | `.trellis/tasks/archive/2026-08/08-08-chromium-baidu-adaptor` | complete | Chromium MV3 session-registry/DNR hardening delivered in `e211897`; final archived evidence records the 302-test full suite, installed Google Chrome and Microsoft Edge gates, and the controlled Playwright pass. |
| 8 | `.trellis/tasks/archive/2026-08/08-27-universal-danmaku-resolution` | complete | Parent integration completed manual episode search/correction, bounded Baidu fingerprint candidate reuse, Bilibili-plus-Baidu convergence, and responsive browser evidence; child dependencies are archived and the final validation record is ready for finish-work archival. |
| 9 | `.trellis/tasks/archive/2026-08/08-29-warm-club-foundation-entry` | complete | Warm Club entry, strict public TOML identity, automated verification, focused screenshot review, spec sync, work commit `1b4ccd8`, archive commit `237f105`, and journal commit `09ed698` are complete. |
| 10 | `.trellis/tasks/08-30-warm-club-visual-followup` | in progress | Room shell/media/workbench implementation, focused checks, screenshot review, and Kyoushitsu spec sync are complete; the exact Phase 3.4 work commit is awaiting one-shot user confirmation. |
| 11 | Queue and dense-control consistency | proposed | Depends on the shared component/state language and room-shell hierarchy. |
| 12 | Dialog, gate, chat-sheet, and cinema-state polish | proposed | Final surface convergence and parent integration boundary after preceding slices. |
| 13 | Houkago mobile provider companion | paused | Explicitly deferred by the user on 2026-08-29; it is not part of the current visual initiative. |

## Evidence and Decisions

- completed evidence: `de93b07` completed durable membership and owner-governance work; `7760e19` hardened its authorization and browser coverage; `261c30e` added owner queue management with 214 isolated package tests and desktop/phone Playwright coverage; `04509ce` persists room Kengen snapshots, preserves exact owner-only queue placement, and passed 219 isolated package tests plus desktop/phone Playwright coverage; `8d2c9f7` added viewer-local HLS subtitles and passed lint, typecheck, build, 221 isolated package tests, and 2 controlled Playwright cases; the universal danmaku parent integration passed the final full-suite, build, focused cross-provider/fingerprint, and phone/desktop Playwright gates recorded in its validation document.
- completed Baidu evidence: the installed Firefox reference path passed real
  server-saved sustained playback plus user-held owner/guest playback,
  owner-offline/reconnect, viewer eviction, same-room removal sync, and
  revoke/reauthorization isolation. Chromium MV3 hardening was delivered in
  `e211897`; the archived final evidence records 302 tests passed, the
  controlled installed-Chromium Playwright gate passed, and the installed
  Google Chrome 150 and Microsoft Edge 151 gates passed with the shared
  Chromium artifact. Browser-compatible sources pass both retention modes;
  source/container/codec-dependent failures are recorded as the native media
  compatibility boundary.
- current execution state: the entry foundation child is archived and the room
  shell follow-up is implemented under its approved shell/media/workbench
  boundary. Focused unit/browser gates passed, the full-suite baseline failures
  are recorded, the human visual review is approved, and the room-shell
  component contract is synchronized into the Kyoushitsu spec.
- next permitted action: present the exact Phase 3.4 work-commit plan and wait
  for one-shot confirmation before staging/committing. Mobile provider
  playback remains deferred.
