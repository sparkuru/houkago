# Real-environment acceptance — configuration A

## Goal

Validate the completed React migration through actual multi-client usage, real
media sources and a connected Android device, beyond local mocked providers and
emulated phone coverage. Produce repeatable evidence and clearly identify any
requirements that could not be exercised.

## Authority and background

- Owner request on 2026-10-04: `可以；建 task 做测试；safari 暂时不考虑`.
- Environment reference: `/home/wkyuu/cargo/try/try.txt`, configuration A only.
  Local workspace, `ssh wkyuu@192.168.9.3` Debian server and devices listed by
  `adb devices -l` are available for task-relevant testing. Remote temporary work
  belongs in `/tmp`; Android temporary artifacts in `/data/local/tmp`.
- M0–M6 are completed; previous evidence covers local fixtures and Chromium
  emulation, with no physical-device/private-provider acceptance claim.
- Task creation and planning are approved. Owner approved execution with
  `开始测试`; task is in progress. The owner subsequently authorized a test
  account and video directory; live-provider access prerequisites are satisfied.
- Owner clarification after the initial report: deleting a host-added item is
  normal for a playlist-enabled guest. Host-only single deletion was an
  assistant/spec assumption, not an owner requirement. Correct the acceptance
  expectations and reports; do not change backend behavior to enforce it.

## Requirements

- R1: Exercise two independent clients against an isolated real backend: room
  creation/admission, permission changes, queue, chat, playback and reconnect.
- R2: Exercise actual media delivery and the Baidu desktop adapter where usable
  task-scoped upstream access is available; distinguish live-provider evidence
  from local controlled-media evidence.
- R3: Exercise entry, room, input and playback on a connected physical Android
  device. Safari is excluded.
- R4: Reuse existing runners and development wrappers. Preserve existing user
  services, device data and provider credentials. Retain redacted results,
  screenshots and reproducible commands in the task evidence.
- R5: Automate all machine-verifiable checks; request human review only for
  concrete residual judgments that automation cannot establish.
- Permission baseline: admitted guests with playlist permission may create,
  select and delete single entries regardless of item author. Without that
  permission, deletion is denied. Queue reorder and bulk pending-clear retain
  their existing host-only boundary.

## Acceptance criteria

- A1 / R1: Independent identities establish a room, follow server-authoritative
  permissions, exchange chat and queue changes, and recover after disconnect
  without duplicated actions or stale identity.
- A2 / R1–R2: Host/guest observe synchronized playback, seek/pause, subtitles and
  danmaku using playable media; record the source and client scope for each case.
  At stable post-command observations, play/pause must agree and media time must
  differ by at most two seconds; record actual drift instead of silently relaxing
  this test tolerance. The tolerance is for this acceptance run, not a new SLA.
- A3 / R2: A real Baidu test-account source completes adapter preparation,
  actual media delivery/progression, seek and revoke/availability checks, with
  sanitized outcomes and artifacts. Missing upstream access is a blocked
  criterion, never a fixture pass.
- A4 / R3: Physical Android entry/admission, chat with virtual keyboard, queue,
  playback and fullscreen have observed final states and device screenshots.
- A5 / R4–R5: Validation maps each requirement to pass/fail/blocked/not-applicable,
  records exact environment limitations, and documents removal of task-owned
  temporary runtime resources without disrupting pre-existing services.

## Out of scope

Safari/iOS acceptance, production deployment, protocol/database redesign,
new mobile-provider functionality, device rooting/flashing/reset, and broad
product fixes. Discovered defects are recorded; remediation scope is decided
after reproduction.

## Confirmed environment and limits

Read-only discovery is recorded in `research/environment.md`. Configuration A
SSH and ADB are reachable with approved execution outside the local sandbox.
The selected Android device is PLR110, Android 16, SDK 36, physical screen
1272×2800. Existing Via/Firefox/vendor browsers can be used without installation;
no Chrome package was returned by the device probe. Local Playwright 1.61.1 and
the existing Docker development image are available.

Baidu application configuration and callback were exercised during preparation.
The owner-authorized account reports a connected server-saved session; a scoped
video directory is approved. Do not reuse personal browser sessions
or copy private account data to the server/device. If login or an account video
requires owner participation, finish other automation first and request only
that missing input. A3 remains open until actual upstream outcomes are recorded.

General entry/room acceptance is `mobile-required`. Real Android results,
Chromium phone emulation and installed-extension fixture results are distinct
claims. This is test planning for existing approved UI, with no visual redesign.
