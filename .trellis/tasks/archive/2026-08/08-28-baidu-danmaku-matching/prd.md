# Baidu release danmaku matching

## Goal

Identify a Baidu media release using privacy-safe evidence, present explainable
episode candidates, and reuse the confirmed episode's common danmaku tracks.

## Requirements

- Accept filename, optional size and duration, provider-safe references, and an
  optional client-computed bounded fingerprint as independently typed evidence.
- Label every digest by algorithm and byte scope; support a Dandanplay-compatible
  first-16-MiB MD5 only as a release fingerprint, never as episode identity.
- Compute any media-byte fingerprint in an authorized client/adaptor Range
  request; `housou` must not fetch media bytes to hash them.
- Auto-adopt only a still-valid `Komon`-approved exact mapping.
- Weighted filename/size/duration evidence produces explainable candidates and
  always requires user confirmation for an unseen release.
- Keep personal confirmation, owner room default, and `Komon` global
  promotion distinct and auditable.
- Allow an explicit sanitized proposal from a confirmed Baidu match without
  retaining private paths, tokens, dlinks, raw fsid, or media bytes.
- Reuse the selected episode track without exposing Baidu paths, fsid, tokens,
  dlinks, or unnecessary private metadata.

## Acceptance Criteria

- [ ] A known exact release mapping resolves automatically to the expected
  episode candidate.
- [ ] A new release with a high filename score still requires confirmation and
  creates no global mapping by itself.
- [ ] Two differently encoded releases can map to one episode and use one track
  with distinct optional alignment.
- [ ] Fingerprint failure or matching failure leaves Baidu playback usable with
  no timeline track.
- [ ] `Komon` promotion is audited and later exact reuse is deterministic.
- [ ] Baidu proposal submission is opt-in, omits private provider material, and
  does not change global matching until `Komon` approval.

## Dependencies and Boundaries

- Depends on identity/storage and the reusable episode/track path delivered by
  source migration; consumes the hybrid-selection contract when present.
- No Dandanplay API integration, third-party connector, or whole-file server
  hashing is included.
