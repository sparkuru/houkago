# M3 regression analysis

## 1. Root cause category

- **E: Implicit assumption / D: test coverage gap.** The old desktop fixture
  treated URL arrival as room membership. Housou's protected playlist mutation
  correctly rejects callers absent from the room roster. The existing component
  spec already warned about this race; the fixture had not applied that rule.
- **B: cross-layer contract.** The governance test compared raw DOM text with
  accessible business copy. The aria-hidden decoration `!` belongs to presentation,
  so exact DOM text was the wrong contract while role/accessible text is correct.
- **E: environment assumption.** A later browser reload failed with
  `net::ERR_NETWORK_CHANGED` fetching Vite `env.mjs`, before identity restoration
  could run. Docker checks were active during host Chrome work. An isolated
  rerun with Docker idle passed; network-interface churn is the likely cause,
  not a demonstrated cookie regression.

## 2. Why earlier evidence missed it

M0's browser path was environment-blocked and M2 explicitly did not rerun browser
parity. Passing unit/static tests could not prove these fixture preconditions.
The first room matrix exposed the actual authorization race and alert text;
the repaired matrix then exposed a separate Chrome network failure. It would be
incorrect to treat the remaining network failure as the same admission bug or
weaken production authorization to satisfy a fixture.

## 3. Prevention mechanisms

| Priority | Mechanism | Specific action | Status |
| --- | --- | --- | --- |
| P0 | Real admission barrier | Observe `/ws` before creation, wait for server `NYUUSHITSU entered`, retain protected-write status 200 assertion | Implemented |
| P0 | Semantic assertion | Exact alert aria snapshot; retain revoked URL, roster removal and no-reconnect assertions | Implemented |
| P0 | Serial execution | Complete dx/container checks before host Chrome; preserve the stable shared preview while browsers run | Applied to subsequent checks |
| P1 | Executable spec | Add concrete fixture/accessible-text examples to component guidelines | Written |

## 4. Systematic expansion

The React real-cookie smoke observes the same server admission contract before
claiming continuity. New counters distinguish backend `/ws` from development
Vite HMR. The checker also adds a final create-result ownership guard after
synchronous command-clear subscribers, so a completion cannot cross into logout
or disposal before navigation. This is a local runtime/consumption fix, not an
admission/protocol redesign.

The first real React browser mount also exposed an ownership mismatch not seen
by runtime-only tests: a disabled QueryObserver's last unsubscribe cancelled the
consumed-signal restore during StrictMode replay. A focused subscribe/unsubscribe
reproduction confirmed this without any network/backend dependency. UI now
projects stable QueryCache snapshots with `useSyncExternalStore`; the runtime
retains request cancellation ownership. Identity/config GC is infinite within
that bounded runtime and explicit fence/dispose cleanup remains tested, avoiding
a separate passive-subscription five-minute eviction bug. StrictMode is retained.

## 5. Knowledge capture

- Fixture and accessible-text contracts are in
  `.trellis/spec/houkago-kyoushitsu/frontend/component-guidelines.md`.
- Identity epoch/navigation/preview contracts are in
  `.trellis/spec/frontend/react-entry-runtime.md`.
- Raw browser traces and per-run results remain identified in `validation.md`;
  the final matrix result is recorded separately from failed attempts.
- This application has no corresponding spec-template tree to synchronize.
  Spec changes remain in the reviewable M3 commit batch; the project requires
  explicit commit-plan confirmation before staging/committing.
