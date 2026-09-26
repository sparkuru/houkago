# M3 entry and migration boundary evidence

## Existing behavior

| Concern | Evidence | M3 implication |
| --- | --- | --- |
| Routes | `packages/kyoushitsu/src/router.ts:4` declares `/` and `/bushitsu/:id` | Preserve paths in the parallel app; the room implementation remains M4/M5 work. |
| Room entry | `packages/kyoushitsu/src/views/HomeView.vue:42` sets room ID and navigates immediately; create/join at lines 71/93 call that entry path | A functional React home needs an approved interim room destination; a placeholder changes the create/join experience. |
| Auth restore | `HomeView.vue:121` restores once on mount; `stores/seito.ts:11` currently maps Eden data to identity/null | React shares restoration through Query and distinguishes real backend 401 from network/domain/protocol failure. Do not copy null-success mocks as the actual contract. |
| Auth commands | `HomeView.vue:48` and `stores/seito.ts:23` select register/sign-in; `HomeView.vue:65` signs out and clears room drafts | Commands use generated resource adapters, no replay; logout aborts/purges private state and clears local drafts. |
| Room defaults/input | `HomeView.vue:78` uses public configured empty-name default; line 96 uses `normalizeRoomId` | Preserve configured default and accepted room ID/invite normalization. |
| Revocation notice | `HomeView.vue:122` recognizes `?revoked=1` | Keep the home notice and route search contract. |
| Public config | `packages/kyoushitsu/src/main.ts:10` loads before Vue mount; `src/lib/site-config.ts:14` memoizes and normalizes | New app needs one config bootstrap, shared canonical normalization/title, and explicit transport fallback vs invalid-success behavior. |
| Theme | `src/lib/theme.ts:1` has only fixed `warm-club`; `src/assets/theme.css:1` owns primitive/semantic/component variables | Preserve actual token identity. There is currently no theme-selection storage key to migrate; do not invent a dark-mode feature. |
| Copy | `src/i18n/index.ts:1` and `src/i18n/messages.ts` own typed translated strings | Reuse the catalog through a framework-free boundary; do not scatter new labels in JSX. |
| API reuse | `src/api/index.ts:1` combines Eden/App linkage with resource exports; `src/api/http-client.ts:1` imports a Vue workspace alias | React must consume framework-independent M2 modules through an explicit portable boundary, not the Eden barrel or Vue injection module. |

## Authentication and origins

`packages/housou/src/routes/seitoshou.ts:19` sets the HttpOnly
`houkago_seitoshou` cookie with SameSite Lax and path `/`; production uses Secure.
Register/sign-in/sign-out require a trusted Origin. `src/lib/origin.ts:3` uses
one configured origin except the existing development-mode/no-explicit-origin
behavior. `src/lib/housou-url.ts:6` uses an explicit `VITE_HOUSOU_URL` or the
current hostname at port 3000. Parallel development must use a consistent
hostname and the existing allowed development-origin policy; do not weaken
production CORS or transfer session secrets in a navigation URL.

For the approved transition to Vue, the new route performs a
full-document navigation to an explicitly configured legacy frontend origin
plus `/bushitsu/<encoded-id>`. That origin must be distinct from the React
origin to prevent a loop. No room HTTP/WS/player bootstrap is performed in React
before handoff; the existing room owns admission and playback. The user approved
this option with `可以` on 2026-09-26; the approval was explicit, not inferred
from source. Final origin validation and routing ownership are in `../design.md`.

## Existing browser fixtures

`packages/kyoushitsu/e2e/entry-home.spec.ts:1` covers config identity/title,
session restore, auth labels/tab order/pending/error states, signed-in entry,
configured room defaults, reduced motion and 375px overflow/touch size.
Its signed-out and failed-command fixtures return JSON `null`; M3 must instead
use the completed M2/backend HTTP error contract (e.g. 401 with domain body) and
keep null/primitive success as protocol-error tests.

## Confirmed scope decision

Approved: preserve functional create/join in React home and automatically hand
off in the same window to existing Vue rooms for M3. The considered preview-only
alternative would postpone end-to-end entry and was not selected. Moving room
features into M3 would change the accepted stage boundary and is not proposed.

PRD/design/plan and context manifests now specify module ownership, identity
lifecycle, tokens and browser gate. Exact dependency patches remain the first
bounded authorized compatibility spike. Product code and dependency changes await
subsequent approval of the completed planning summary.
