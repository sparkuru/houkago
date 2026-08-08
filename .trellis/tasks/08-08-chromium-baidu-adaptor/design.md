# Chromium installed Baidu adaptor — technical design

## 1. Scope and architecture

This task hardens the already-delivered Chromium transport; it does not create
a second provider implementation.

```text
kyoushitsu page
  ⇅ typed postMessage / chrome.runtime messages
Chromium MV3 content script ⇄ event-driven service worker
                                  │
                storage.session grant registry
                                  │ reconcile / sweep
                DNR session rules + observational WebRequest
                                  │
                         approved Baidu hosts
```

- Shared pairing, OAuth handoff, local user-held tokens, permits, directory
  access, pending dlink coordination, host policy, and provider schemas remain
  browser-neutral.
- Only DNR, WebRequest observation, alarm scheduling, worker recovery, and
  Chromium diagnostics belong in the Chromium port.
- Firefox remains the reference contract and ordinary media paths never depend
  on the extension.
- Chrome and Edge use one `dist/chromium` artifact. There is no Edge fork.

## 2. MV3 worker and grant lifecycle

Chrome may terminate an idle extension worker after about 30 seconds, while DNR
session rules remain installed. Therefore global maps and `setTimeout` are
caches, not authority.

The Chromium port will use a minimal registry in `chrome.storage.session` for
active media grants. Each row contains only the grant/rule identifiers, exact
tab, exact sentinel/dlink needed for reconciliation, and expiry. It is trusted
extension context only, is never copied to page/content-script state, and is
deleted with its DNR rules.

On worker initialization and every relevant alarm/runtime event:

1. Read the session registry and `getSessionRules()`.
2. Remove expired, malformed, orphaned, wrong-range, or duplicate Houkago rule
   ids and delete their registry rows.
3. Remove registry rows whose rules no longer exist.
4. Rebuild only safe in-memory indexes from validated rows.
5. Continue pending user-held polling before returning readiness.

Installation is transactional: validate the grant and host policy, reserve
collision-safe ids, install both exact rules, persist the matching row, then
report success. Any failure rolls back every rule and row from that attempt.
Revoke/cleanup enumerates the owned rule-id range instead of trusting memory.

An in-process timer may remove a rule promptly while the worker is alive, but a
Chrome alarm and startup reconciliation are the durable fallback. Logical grant
expiry always rejects new installation/resolution. Because browser alarm
delivery may be delayed, the product continues the established limitation that
already delivered dlinks/bytes cannot be recalled; validation records actual
cleanup timing without claiming DRM-strength revocation.

## 3. Private dlink redirect observation

Chromium keeps DNR responsible for adding `User-Agent: pan.baidu.com` to the
private manual-redirect HEAD. Non-blocking WebRequest is observational only.

- Register observers before fetch/rule installation.
- Serialize identical raw URLs and bind the response to the request id captured
  from the exact URL and HEAD method.
- Ignore foreign ids, non-3xx responses, missing/unsafe Location, credential-
  bearing final URLs, and unapproved hosts.
- Remove observers and temporary rule in `finally`, including abort, timeout,
  worker error, DNR quota, and listener-install failure.
- A pending item reaches a secret-free terminal result without stopping later
  items; token/control-plane transport failures remain retryable until the
  server deadline.

## 4. Media request rules

For an admitted grant, DNR installs exactly two session rules:

- exact, case-sensitive sentinel URL → exact validated dlink redirect;
- exact, case-sensitive dlink + exact tab → set provider UA and remove Referer.

Both are limited to media/XMLHttpRequest resource types and the approved rule-id
range. Range is neither removed nor synthesized. Later Range/seek requests must
continue matching the same header rule. Any URL, query, tab, host, expiry, or
source difference fails closed. Ordinary requests must not match either rule.

## 5. Diagnostics and user experience

Reuse the existing Baidu connection/player states and Houkago tokens. Do not
introduce the palette, typography, glow, or landing layout suggested by raw
UUPM output.

If installed testing exposes a diagnostic gap, distinguish these nearby states:

- extension absent or stale after reload;
- page origin not covered or server-origin permission denied;
- pairing/session expired;
- owner adaptor asleep/offline while a user-held request waits;
- DNR installation/quota/cleanup failure;
- provider authorization/upstream failure.

Each state has one actionable recovery step such as reload extension and page,
grant permission, re-pair, reconnect owner, retry, or reauthorize. Async waits
longer than 300 ms retain visible progress. Errors use existing semantic tokens,
text plus color, and `role="alert"`/`aria-live`; controls retain visible focus,
keyboard operation, 44 px targets, and reduced-motion behavior. Ordinary source
controls remain enabled.

## 6. Validation matrix

### Automated controlled target

Use a headed persistent Chromium context with the unpacked extension and a
controlled Houkago/media target where feasible. Assert actual extension
detection, DNR header mutation, Referer removal, Range/seek, direct media
traffic, exact-tab isolation, worker restart reconciliation, expiry/revoke
cleanup, same-URL concurrency, and non-Baidu non-interference. Unit contracts
remain for error branches that a browser harness cannot deterministically force.

### Google Chrome — full real-account gate

- unpacked install, origin permission, detection, pairing, reload/recovery;
- server-saved sustained playback and seeking;
- Chrome user-held owner file selection/dlink resolution plus owner and one
  admitted remote viewer playback;
- worker suspension/restart while pending and while a media grant exists;
- owner offline/reconnect, viewer eviction, source removal, revoke and
  reauthorization isolation;
- safe request inspection proving direct Baidu bytes, UA, no Referer, Range,
  and unrelated-request non-interference.

### Microsoft Edge — compatibility gate

Load the identical Chromium artifact and verify install/detection/pairing,
server-saved sustained playback/seek, Edge user-held owner resolution/playback,
and ordinary-source non-interference. If Edge requires a code or manifest
change, rerun the Chrome automated and installed regression gates.

Evidence stores browser/version, scenario outcome, and redacted request facts
only. OAuth tokens, dlinks, cookies, file ids/paths, pairing material, and HAR
payloads remain outside the repository.

## 7. Compatibility, rollout, and rollback

- Minimum supported engine is Chromium 120 because production 30-second alarms
  are part of the existing pending-request contract.
- Production builds keep exact page/server origins and the existing approved
  Baidu host list. No broader permission is added to solve a smoke failure.
- Store publication, signing, auto-update, and mobile support remain out of
  scope.
- Until both installed gates pass, README and UI continue to describe Firefox
  as the reference and Chromium as unproven.
- If the Chromium security boundary cannot match Firefox, leave Chromium
  unavailable rather than adding a server media proxy or weakening host/tab/
  grant isolation. Rollback removes Chromium-specific recovery changes and
  keeps the proven Firefox path intact.

## 8. Delivery shape

This is one task, not a parent with child tasks. Chrome hardening produces the
only artifact; Edge is a downstream compatibility gate for that artifact and
cannot be independently completed. Any Edge-specific change loops back through
Chrome verification.
