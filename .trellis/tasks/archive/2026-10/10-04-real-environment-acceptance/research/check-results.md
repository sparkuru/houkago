# Independent desktop acceptance review — 2026-10-04

## Scope and result

Reviewed `packages/kyoushitsu-react/e2e/real-environment.spec.ts` and
`packages/kyoushitsu-react/playwright.real-environment.config.ts`, task context,
desktop evidence and actual application paths. The initial review followed an
incorrect frontend spec premise and missed the already clear backend rule.
The reviewer withdraws the earlier backend-defect verdict.

The owner clarified that an admitted playlist-enabled guest may delete a
host-added entry. Backend `seitoshou-contract.md` already requires host or
playlist authority for single creation/deletion; `quality-guidelines.md`
explicitly gives guest deletion with matching host/guest BANGUMI as a good
case. Reorder and bulk pending-clear remain exact-owner operations.

Three historical runs accurately observed DELETE200 and removal but failed an
incorrect expected403 assertion. These were harness expectation failures, not
backend authorization defects. The corrected focused case now checks denied
deletion before playlist permission and permitted deletion after the grant,
including actual host/guest authoritative queue updates. Its final rerun
evidence is independently reviewed below and passes. No product change is required by
this corrected rule; observed guest delete-control absence is not declared
normal product behavior or justification to forbid backend deletion.

## Historical independent execution (expectation superseded)

Both browser commands used these explicit endpoints:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:15943
PLAYWRIGHT_HOUSOU_URL=http://127.0.0.1:13943
PLAYWRIGHT_MEDIA_URL=http://192.168.9.3:18943
PLAYWRIGHT_PUBLIC_MEDIA_URL=https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4
```

With the above variables exported and task-owned output selected:

```sh
PLAYWRIGHT_REAL_OUTPUT=/tmp/houkago-acceptance.nJ2AJ79D/artifacts/check-queue-authority \
node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.real-environment.config.ts \
  --grep 'permitted guest cannot delete'

PLAYWRIGHT_REAL_OUTPUT=/tmp/houkago-acceptance.nJ2AJ79D/artifacts/check-hls \
node_modules/.bin/playwright test \
  --config packages/kyoushitsu-react/playwright.real-environment.config.ts \
  --grep 'real HTTP hls'
```

- Original queue expectation: **1 harness failure**, 2.8 seconds total.
  Move/clear return 403;
  item DELETE returns 200. The owner queue changes from
  `Owner managed pending` to empty. The run failed at its expected403
  assertion, subsequently withdrawn; before/after facts were retained before
  that assertion. The unchanged historical JSON is now
  `research/evidence/desktop/queue-authority-historical.json`; its expected403
  field records the old test premise, not the current product rule.
- HLS: **1 passed**, 9.4 seconds total. Both clients decode real Debian HTTP
  bytes, progress, pause/seek, apply permitted guest controls and observe
  server-echoed danmaku. English subtitle active cue is observed, guest's local
  subtitles remain off, and web fullscreen restores room controls on exit.
  Eighteen settled samples have maximum drift **0.005315 seconds**.
- Scoped Biome: **pass**, two files, no changes.
- Independent strict TypeScript check of both files: **pass**. This explicitly
  includes the new config outside the package tsconfig's existing include.
- `git diff --check`: **pass**.

Static commands:

```sh
./dx node_modules/.bin/biome check \
  packages/kyoushitsu-react/e2e/real-environment.spec.ts \
  packages/kyoushitsu-react/playwright.real-environment.config.ts

./dx node_modules/.bin/tsc --noEmit --strict --skipLibCheck \
  --target ESNext --module ESNext --moduleResolution bundler --types bun \
  --lib ESNext,DOM,DOM.Iterable \
  packages/kyoushitsu-react/e2e/real-environment.spec.ts \
  packages/kyoushitsu-react/playwright.real-environment.config.ts
```

Browser and dx execution used approved network/Docker execution outside the
sandbox. No dependency installation or runtime reconfiguration was performed.
Root aggregate checks belong to main-session evidence and were not rerun.

## Corrected interpretation of the actual authority path

`packages/housou/src/routes/bushitsu.ts:133` invokes
`authorizePlaylistMutation` for item DELETE. It checks trusted origin, identity,
presence and playlist permission, allowing a present playlist-enabled guest.
Move and pending-clear invoke `authorizeBuchouMutation`, which additionally
requires the room owner. `src/domain/bushitsu.ts:102` removes the item without
an actor/owner check.

This split matches the owner-confirmed single-delete versus placement rules.
The domain's lack of an owner check is not a defect: transport authorization
already supplies the required admission/playlist gate.

At this task checkpoint, `queue-panel.tsx` renders deletion only for host
pending items and `room-runtime.ts:428` dispatches through a host-only command
gate. These frontend observations do not change the authorized backend policy.
The prior reviewer incorrectly treated them as proof that the backend needed
an owner-only single-delete gate. That inference is withdrawn; frontend
presentation/runtime differences require their own scope decision if changed.

## Harness and evidence assessment

- No request routing, WS replacement, injected authority frames, media mocks,
  personal profiles or stored credentials are present in the new runner.
  DOM evaluation only reads video time/state/tracks; it does not set playback
  or application authority.
- Independent cookie contexts and fresh generated registrations exercise real
  identity, admission, HTTP and server WS broadcasts. Waiting admission checks
  protected GET absence; reconnect checks real socket closure, fresh admission,
  preserved account, current queue/item and one occurrence of submitted chats.
- Synchronization requires both pause states, media error absence and <=2-second
  drift across three repeated samples after each action; real advancement is
  asserted separately. Samples from the original six-case run corroborate the
  reported maximum drifts: MP4 0.008355s, HLS 0.091208s, DASH 0.008761s.
- HTTP Content-Length observations describe response headers. The independent
  decoded progression checks supply the evidence that media was usable; these
  headers are not reported as aggregate transferred-byte counters.
- All four endpoints are mandatory in the opt-in config. Missing inputs fail
  configuration rather than passing as a skip. Ordinary project testMatch
  expressions exclude this new real-environment file.
- Trace/video/automatic screenshots are off. Retained JSON for the six original
  positive cases and independent HLS/authority runs contains task states,
  timings, queue titles and HTTP facts, with no credentials or storage dumps.
  Screenshots are explicitly captured after entering task room UI.

The measured desktop clients share one machine. Reconnect here is a document
reload, not a network-outage recovery claim. Web fullscreen is not native
Android fullscreen. No Baidu, Android, Safari, WAN or production readiness
claim is made by this review; those applicable task outcomes remain main-owned.
All reviewer browser contexts are closed by the runner. Shared preview/media
teardown remains main-owned; reviewer needs no further runtime access.

## Earlier checkpoint consistency follow-up (permission verdict superseded)

Read only `validation.md`, `research/android-results.md` and
`research/provider-results.md`, and visually inspected twelve named task UI
screenshots: keyboard/send and desktop receipt, native fullscreen/restoration,
web fullscreen/cinema, subtitle menu, HLS subtitle/danmaku, settled pause/seek,
reload and final restored frame. No auth page, private browser profile or
credentials were inspected. No further browser/device tests were run.

At that checkpoint the reviewer found no new screenshot-boundary problem.
The permission interpretation in the checkpoint was later corrected by the
owner, as recorded above. The remaining observed coverage was:

- The keyboard screenshot shows the actual software keyboard and accessible
  composer/send action; subsequent phone/desktop screenshots show the same
  submitted message and emptied composer.
- Fullscreen screenshots show decoded landscape media; restoration/cinema
  screenshots show portrait browser chrome, room content and controls again.
  These are observational device evidence, without a claim that Android DOM
  fullscreen state was measured through a debug socket.
- The HLS screenshots show the selected English option, a visible rendered
  subtitle cue at the settled pause and the moving `danmaku 1004` suffix.
  Reload shows the same HLS item/identity roster, decoded 3.000-second frame,
  paused 3s/12s controls and subtitle selection off.
- The earlier matrix recorded the incorrect DELETE failure verdict, now
  withdrawn. It correctly restricts precise
  <=2-second sampling to two desktop contexts. Android dynamic drift,
  phone-origin queue edits, DASH, WAN loss and Safari remain explicitly outside
  the observed device results.
- Provider preparation claims no completed login, playable private media or
  live-provider pass. Application-key presence is distinguished from valid
  OAuth credentials. Owner authorization/video selection and owned cleanup
  remain pending; neither acceptance nor archival is claimed.

Main was advised to make the A4/A5 matrix outcome labels explicit and to retain
the latest sanitized owner-access troubleshooting fact in provider evidence.
Those are reporting refinements, not discovered product/harness failures.
Existing lint/type-check outcomes above remain the relevant static verification;
this follow-up changed only this review record.

## Live Baidu final evidence review

Reviewed the scratch runner `run-provider-acceptance.cjs`, final sanitized
`provider-acceptance-results.json` under the known task temporary root, the
rewritten `research/provider-results.md`, and relevant source grant/revoke/
optional-fingerprint paths. No credential file, private provider response,
private profile or auth/file-list/video screenshot was inspected. No new
account, provider, playback or revoke action was performed.

**A3 playback and local-revoke lifecycle are supported for the recorded
single Chromium-adapter video.** Independent offline assertions on the
sanitized facts passed:

- Intended real account, actual backend WS admission, installed adapter
  header capability/pairing and one scoped video source addition were recorded.
- Three real Baidu HTTP206 media responses accompanied decoded readyState4,
  null media error and progression 1.770556→3.267858s: delta1.497302s.
- Pause held3.280877s for the one-second sample, drift0. Seek reached15s;
  the final read-only decoder observation is readyState4, error null,
  seeking false, currentTime15.
- Local revoke returned200; subsequent availability returned200 with
  playable false/connection-revoked, and a fresh grant request returned409.
- A separately unclaimed pre-revoke grant was ready/200; installed adapter
  preparation after revoke returned false/ADAPTER_ERROR. Extension media
  rules changed4→0.

Early review found the original PASS predicate omitted explicit fresh-grant
denial and allowed the old-unclaimed-grant probe to be absent. The worker
strengthened the final recorded predicates using existing observations and a
read-only media check. The final evidence requires both facts, plus bounded
pause/seek observations. No second revoke or positive playback rerun was
performed. All eleven final assertion fields are true; the report's initial
"twelve" count was flagged to the worker for correction.

The JSON includes no password, cookie, token, authorization, dlink, private
file name/ID/path, upstream handle or grant URL field. The retained room URL
is the task room; media details contain numeric/status facts only. Public
API source creation returns `Enmoku`, agreeing with the runner's
`entry.provider.sourceId` extraction. Actual revoke source paths remove the
connection, revoke adapter sessions and cancel owned/viewer grants; fresh
requests and claims check current source connection authority.

The final report correctly preserves these limits:

- Response Content-Length/Content-Range are advertised header facts, not
  downloaded-byte totals. Cross-origin resource timing sizes are zero.
  Actual decoded progression supplies the usable-delivery evidence.
- Frontend15944 WS is development HMR; backend3000 WS supplies room admission.
- Initial adapter ERROR→RESULT has no request correlation. No successful
  fingerprint result or conclusively attributed fingerprint failure is claimed.
- Native A3 input delivery was unavailable; explicitly authorized DOM button
  activation ran actual UI handlers and real HTTP/WS/extension/media paths.
  This does not prove native input usability in this A3 run. Room creation used
  the real authenticated API as setup, separate from UI creation coverage.
- Owner-reported authorization, Firefox packaging, private account lifecycle
  and this Chromium provider run have separate coverage. The reviewer observed
  no OAuth token exchange; resulting connection/access are verified facts.
  No installed Firefox playback or automated OAuth exchange claim is made.

No additional material misleading A3 claim or product fix was identified.
A3's successful lifecycle is independently supported. The subsequent owner
correction withdraws the earlier A1 backend-defect interpretation; corrected
permission regression and final matrix/lifecycle reporting are separate
verification steps owned by the main session.

## Corrected single-delete acceptance — final review

Loaded both newly registered backend contexts directly, including the complete
748-line `backend/quality-guidelines.md` in chunks because native injection's
per-file cap excludes its full contents. Reviewed the owner-corrected PRD,
execution plan, validation, frontend spec update, final corrected test and
worker's desktop report. The backend rule explicitly allows a playlist-enabled
guest to delete another member's source and requires matching BANGUMI updates;
this was already documented before the owner correction.

The worker's focused test passed **1 case in3.0s (body2.3s)**. Independently
checked the persisted `research/desktop-queue-permissions.json` against the
actual final test assertions, with offline checks on every recorded phase:

- Actual guest admission precedes requests. With playlist permission false,
  DELETE403 leaves both owner-added pending items unchanged in backend and
  both rendered queues.
- After the actual permission preset/echo enables playlist authority, guest
  move403 and pending-clear403 preserve both entries.
- Guest DELETE200 removes only `Owner managed pending`, retaining
  `Owner retained pending`. Host and guest receive and render the identical
  authoritative BANGUMI result; no client authority frame was injected.
- Media request count is0. No current item was selected, no media origin or
  provider account was needed and no Android/media/provider rerun occurred.
  Guest delete-button count0 is retained as an observation only.

Independent scoped Biome on the corrected test/config: **pass**. Independent
strict TypeScript check explicitly including both files: **pass**.
`git diff --check`: **pass**. Static commands are the two dx commands recorded
above. No further live test was needed after reviewing the focused evidence.

All seven current desktop cases have passing evidence **across two batches**:
the earlier six positive cases and this corrected focused case. No final
seven-case whole-suite rerun is claimed. A1 desktop admission, permissions,
queue, chat and document-reload evidence is supported under the owner-confirmed
rule. The earlier expected403 failures remain historical harness failures;
`queue-authority-historical.json` is unchanged and is not current acceptance
failure evidence.

The reviewer retracts the backend permission-defect verdict and takes
responsibility for following the wrong frontend premise without reconciling
the existing backend contracts. Neither an owner-only backend patch nor a
declaration that hidden guest deletion controls are correct follows from this
test. No product file was edited. Worker reports exact-owned core preview
stop/status verification; final lifecycle/commit/archive remain main-owned.

### Final broad-lifecycle assertion correction

Independently inspected the implementer's final tiny source edit: the broad
room lifecycle case now asserts absence only of guest reorder/clear controls
(`上移`, `下移`, `清空待播`). It records the single-delete button count as an
observation with `deleteButtonVisibilityIsObservationOnly: true`, without an
absence assertion. The focused permission case is unchanged.

This removes the remaining incorrect host-only single-delete premise from the
runner. It changes no product path and does not alter the historical six
positive cases' observed behavior or their retained JSON. No new six-case or
whole-suite execution is claimed for this edit. Implementer reports final
scoped Biome and React typecheck passes; reviewer source inspection and
`git diff --check` pass. Existing independent strict types, corrected focused
execution and neutral observation checks above remain applicable.
