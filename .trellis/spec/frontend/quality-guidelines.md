# Frontend Quality Guidelines

The active stack is React/Vite, TanStack Router/Query, Tailwind and typed core
resources. Protocol/domain types come from Kousoku; REST DTOs are generated
from the browser OpenAPI subset. Eden server-app imports and framework-specific
fallbacks are forbidden in the browser boundary.

Run Bun commands through `./dx`: lint, all workspace types, root tests, contract
drift and React production build. Use host project-local Playwright as described
in [validation](../trellis-plus/validation.md). The preview's configurable Docker
lifecycle is in [development](../trellis-plus/development.md); do not add another
wrapper or use host Bun. The fake Docker/Bun shell harness runs on the host and
requires Python; it does not start product services.

Inspect the real emitted module graph, not just manifests. Core imports no UI
framework/server app. React graph excludes the retired application and
Vue/Pinia/Eden/server dependencies. Generated DTO fidelity gets its own
TypeScript contract check; SDK regeneration must be deterministic.

Keep server authority, current permissions and admission in every command path.
Dispose players/engines/timers/listeners/requests with their scopes. Verify stale
completions, explicit gesture versus automatic echo, and browser final state.
Use semantic labels, focus restoration, touch targets, safe insets, reduced
motion and no horizontal overflow at supported desktop/mobile/cinema sizes.

No `any` or casts to evade contracts, no raw component fetches, no REST polling
for WS data, no duplicated sync logic or imperative engine calls scattered
across UI. Use the project dictionary and avoid noisy comments/copied reference
code. The detailed executable contracts are in the React/core package indexes.
