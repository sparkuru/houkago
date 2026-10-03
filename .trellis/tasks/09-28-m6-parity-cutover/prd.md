# M6 React parity and cutover

## Goal

Migrate the complete active frontend from the legacy Vue workspace to React,
deliver the absorbed room-control speed dial, prove behavior and layout parity,
then remove the old frontend workspace after acceptance. Move shared
frontend-independent assets into a new framework-neutral workspace; do not
retain Vue as a fallback or migration reference.

## Background

- The project mainline is the frontend architecture and stack migration. M4
  moved room admission, realtime queue, chat and governance to React; M5 moved
  playback, provider and danmaku flows. Both tasks are complete and archived.
- The owner authorized M6 planning on 2026-09-28. This task is in planning;
  implementation, cutover, and production deployment require separate review
  and approval.
- On 2026-09-28, the owner selected full migration: create a framework-neutral
  shared package, relocate every required shared asset into it, then remove
  the old frontend workspace rather than retaining Vue as a fallback/reference.
- The ordered roadmap defines M6 as full behavior/layout regression, human
  residual review, rollout/rollback planning, and retirement of the old
  frontend only after acceptance. Existing mainline constraints preserve room
  URLs, authentication, playback authority, provider/danmaku behavior, Warm
  Club visual identity, and desktop, portrait, and cinema layouts.
- M4 made React the normal local frontend and explicitly excluded a Vue
  compatibility gate. M5 kept old-frontend retirement and final whole-app
  parity outside its scope.
- At the owner's request on 2026-09-28, `09-28-room-control-speed-dial` is absorbed as an
  independently verifiable M6 child. Its React-only feature criteria are part
  of M6's deliverable set; the UI remains in the React application and does not
  move into the framework-neutral core.
- The current working tree replaces `dev.sh` with `preview.sh` backed by
  `./dx preview`; this preview work is uncommitted and must be preserved rather
  than attributed to M6. The root workspace still exposes
  `dev:kyoushitsu` for the Vue app. React depends on the `houkago-kyoushitsu`
  workspace and directly imports its shared HTTP, identity/configuration,
  localization, room-session, synchronization, player, provider, and danmaku
  exports. The M5 bundle check confirms the React bundle excludes Vue, Pinia,
  Eden, and backend modules; the workspace package is therefore also a shared
  library boundary.
- Both applications have separate browser suites. Legacy Vue coverage includes
  desktop/portrait room layouts, entry, governance, subtitles, danmaku, and an
  installed-Chromium adapter check. React coverage includes entry, real-cookie
  room flows, media, Baidu, and danmaku; archived M5 validation records 41
  passed and 3 intentional skips. The verified source/import inventory is in
  [legacy workspace research](research/legacy-workspace-inventory.md): 141
  tracked old-workspace files, 38 unit-test files, and 26 old-package export
  subpaths imported from 25 React files.
- On 2026-10-03, `10-01-room-layout-refinement` passed owner visual acceptance
  and was committed and archived. Its validation records 485 root tests and
  six room-control plus six media desktop/phone browser tests. Use this accepted
  layout as the current comparison baseline. The separate speed-dial child
  remains `in_progress`; map its acceptance criteria to the newer evidence
  before treating it as accepted for M6.
- Planning was refreshed on 2026-10-04 at committed HEAD `68d8b39` on `k-on`.
  The working tree contains separate preview, origin/configuration, and policy
  changes. Preserve those changes, including shared helpers that will move to
  core; archived test results do not verify the current dirty working tree.

## Requirements

- R1. Inventory all active files, imports, scripts, generated artifacts,
  dependencies, tests, and documentation that belong to or depend on the
  legacy Vue workspace; classify each as migrate, replace, or remove.
- R2. Create a framework-neutral shared package for every capability React
  still consumes from the old workspace; move those assets there and update all
  consumers and generators. Remove the old Vue workspace and its
  obsolete application source, dependencies, scripts, tests, and configuration
  after parity gates pass; keep no active legacy implementation as fallback or
  migration reference.
- R3. Build an evidence-backed matrix of supported legacy behavior and layouts,
  map each item to current React coverage, and identify untested or differing
  behavior before declaring parity. Define observable regression acceptance
  across entry/session restoration, room admission and URLs, queue/chat/
  governance, media/synchronization, Baidu/provider permissions, danmaku
  sourcing and display, and supported desktop, portrait, and cinema views.
  Reuse existing tests and fixtures where they prove the required behavior.
- R4. Require a recorded human review of remaining visual and interaction
  differences, including explicit disposition of each residual finding.
- R5. Specify staged cutover order and rollback using the last known-good Git
  revision. The approved M6 plan gates removal on parity and human review
  acceptance.
- R6. Limit rollout planning to the local application/runtime boundary unless
  production deployment is separately authorized.
- R7. Deliver the room-control speed dial from the linked child task in React:
  move existing room actions out of the in-flow control surface, expand the
  anime playlist into the freed layout space, and preserve all room information,
  commands, permissions, keyboard/touch access, safe-area behavior, and reduced
  motion support.

## Acceptance Criteria

- [ ] A1. A parity matrix maps the supported entry, room, media/provider,
      danmaku, and responsive-layout behaviors from archived M4/M5 evidence and
      old browser cases to React evidence, with gaps and unsupported cases
      called out.
- [ ] A2. Every React-required shared asset is in the new framework-neutral
      package and all imports, generators, scripts, tests, and workspace
      references point to it; the old frontend package and active
      implementation/configuration are removed after acceptance.
- [ ] A3. Automated checks and fixtures provide reproducible evidence for all
      required parity behaviors; any unautomated checks have an explicit reason.
- [ ] A4. A human review record covers visual, responsive, keyboard, and
      interaction residuals, with each item accepted, fixed, or blocking.
- [ ] A5. A staged local cutover procedure names dependencies and stop
      conditions; rollback to the last known-good Git revision is documented
      and verified before the old implementation is removed.
- [ ] A6. Legacy frontend removal occurs only after the approved M6 plan's
      parity and human-review gates pass; production deployment is not included.
- [ ] A7. Existing backend, HTTP/WS protocol, database, and external provider
      contracts remain unchanged.
- [ ] A8. The React room exposes its controls through the floating speed dial;
      the anime playlist uses the freed layout space without clipping or
      horizontal overflow at supported room sizes.
- [ ] A9. Existing room information, actions, command behavior, and permission
      checks remain available through the new control surface.
- [ ] A10. Opening/closing, Escape, outside/backdrop click, focus restoration,
      accessible state/names, hidden-action inertness, touch targets, safe areas,
      and reduced-motion behavior meet the linked child acceptance.
- [ ] A11. Desktop, portrait, and cinema layouts remain usable; the floating
      control does not obstruct the player, queue, or chat.

## Out of Scope

- Production deployment or rollout to hosted environments.
- Backend, protocol, database, or external provider changes.
- New product features outside the absorbed room-control speed dial, visual
  rebrand, or expanded mobile-provider support.
- Deleting archived Trellis evidence; it remains historical audit material.
