# Bug Analysis: valid Baidu direct bytes do not guarantee browser playback

## 1. Root Cause Category

- **Category**: E — Implicit Assumption, with an A — Missing Spec contributor.
- **Specific cause**: the investigation initially treated provider video
  classification and valid direct HTTP delivery as sufficient for native
  browser playback. Baidu `category=1` only says that Baidu considers the file
  a video. It does not establish HTMLMediaElement support for the container or
  its internal video/audio codecs.

## 2. Why Earlier Fixes Did Not Complete Playback

1. Response `Cache-Control: no-store` fixed the visible response policy but was
   applied too late to prevent Chrome from reusing an existing partial cache
   entry.
2. Exact-target request `Cache-Control: no-cache` correctly closed that cache
   path. The next HAR proved every retry returned to the network with correct
   UA, Referer removal, Range, and a valid 206, but one source still failed.
3. Repeatedly inspecting OAuth/dlink/DNR could not explain the residual failure
   because it was a second, source-specific media-pipeline problem rather than
   another transport problem.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific action | Status |
| --- | --- | --- | --- |
| P0 | Documentation | Separate provider video eligibility from native browser compatibility in the Baidu adapter contract | DONE |
| P0 | Validation | Use a known-good direct-play source for Chrome/Edge adapter acceptance and compare Range progression | DONE |
| P1 | Runtime diagnostics | Surface a stable, secret-free native media compatibility failure instead of an unexplained retry loop | TODO — separate product slice |
| P1 | UX | Distinguish definitely unsupported containers from codec-unknown browser candidates without claiming extensions prove codec support | TODO — product decision required |
| P2 | Capability | Evaluate optional remux/transcode paths separately; do not silently move media bytes through Housou | TODO — outside this task |

## 4. Systematic Expansion

- **Similar issues**: MKV, AVI, FLV, TS, MOV, and even MP4 can contain codecs or
  layouts that the current browser/OS cannot decode. RMVB is a clear example of
  a provider video that is not a normal native HTML5 direct-play target.
- **Design improvement**: model provider eligibility and browser playability as
  separate states. Extension request rewriting solves access policy, not media
  decoding.
- **Process improvement**: after grant and first 206 succeed, compare Range
  progression and media-pipeline state before changing auth/cache/header code.
- **Knowledge gap**: playback in the Baidu desktop client does not prove browser
  compatibility because the native client can use a different decoder,
  demuxer, or delivery path.

## 5. Knowledge Capture

- [x] Updated `.trellis/spec/frontend/baidu-adapter-contract.md`.
- [x] Recorded the two-HAR comparison in the active task validation evidence.
- [ ] Decide a separate media compatibility diagnostics/UX task.
- [ ] If compatibility expansion is desired, choose between client-side remux,
      optional transcoding, or an explicit unsupported-source boundary.

## Evidence from temporary HAR captures

Only safe aggregate evidence is retained; raw HARs, URLs, names, identifiers,
cookies, and credentials are not copied into the repository.

- One MP4 candidate advances from the initial open-ended Range to a later byte
  offset and sustains playback.
- A second MP4 candidate repeatedly restarts the same initial Range after a
  valid 206 and does not progress.
- Two RMVB candidates behave like the failing MP4. The second HAR independently
  repeats one of those RMVB failures.
- Every compared request reaches the network with provider UA, no Referer,
  request `no-cache`, and preserved Range. Responses advertise byte ranges and
  have internally consistent 206/Content-Length/Content-Range values.
- The retention-mode comparison and independent AList direct-link comparison
  reproduce the same per-file split. This strongly lowers the probability of a
  credential-retention or Houkago transport defect; the remaining MP4 case
  still needs codec/media-pipeline evidence for a precise subtype.
