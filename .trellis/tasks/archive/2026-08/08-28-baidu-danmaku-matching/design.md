# Design: Baidu release danmaku matching

## Safe release evidence

The matcher starts from an authenticated, room-bound Baidu source and derives
its current server-safe `sourceId`, filename, and optional size. It accepts
duration only when observed through an authorized playback/adaptor boundary.
An optional fingerprint is a typed digest:

```text
algorithm = md5
scope = prefix
bytes = 16777216 (or the full file when smaller)
value = lowercase hex
```

The authorized client/adaptor performs a bounded Range read and sends only the
digest record. `housou` never downloads media to hash it. No request or stored
evidence contains path, fsid, token, dlink, grant, or media bytes.

## Matching pipeline

1. Reuse an active `Komon`-approved exact provider/fingerprint mapping when its
   typed evidence matches exactly.
2. Otherwise normalize the filename in `kokuban`, extract explainable work,
   season, episode, subtitle-group, and release hints, and combine them with
   optional size/duration evidence.
3. Rank existing canonical episode candidates deterministically and return each
   evidence contribution plus mismatch warnings.
4. Require explicit confirmation for every unseen release regardless of score.
5. If no candidate is correct, allow manual episode search and a sanitized
   correction/new-episode proposal.

A personal confirmation creates only account-scoped knowledge. `Buchou` may
select the resulting track as room default. Only a separate `Komon` review may
promote an exact global release mapping.

## Alignment and reuse

Different Baidu and Bilibili encodes may map to one episode and logical track
while retaining distinct release identities. Optional release-specific offset
or cut calibration applies at resolution time and never rewrites canonical cue
timestamps. Matching/fingerprint/alignment failure yields another candidate or
no timeline track and leaves Baidu playback unchanged.

## Adapter compatibility

Extend the existing versioned page/adaptor protocol only for the bounded hash
capability. Capability discovery gates the action; mobile/no-adaptor users may
still match by safe weak evidence and confirm manually. Exact-origin, nonce,
device, source/room binding, Range preservation, grant expiry, and Baidu secret
boundaries remain unchanged.

No Dandanplay API, credential, identifier, runtime dependency, or whole-file
server hash is introduced.

