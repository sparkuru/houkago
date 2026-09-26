# M3 dependency and UI decisions

Inspected 2026-09-26. Planning evidence is not an installed compatibility proof
or a claim that a particular package is the latest release.

## Official technical sources

- [React: build an app from scratch](https://react.dev/learn/build-a-react-app-from-scratch)
  documents Vite React/TypeScript SPA setup and routing/data-fetching choices.
  The existing parent initiative already chose this client architecture.
- [TanStack Router manual setup](https://tanstack.com/router/latest/docs/installation/manual)
  supports file-generated and code-defined routes. M3 chooses typed code-defined
  routes split into modules, with a lazy room boundary. Two routes do not justify
  a second generation pipeline or Router plugin.
- [TanStack Query installation](https://tanstack.com/query/latest/docs/framework/react/installation)
  documents Query v5 and React 18+ support. Select matching React/ReactDOM 19,
  Query 5 and Router 1, subject to real peer/build evidence, not inferred patches.
- [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
  requires consuming query-function AbortSignal for transport cancellation.
  Suspense query hooks have cancellation limitations; use ordinary Query APIs
  for identity/private work and Suspense only for lazy route code.
- [Tailwind Vite installation](https://tailwindcss.com/docs/installation/using-vite)
  specifies `tailwindcss` + `@tailwindcss/vite`, plugin and CSS import.
- [shadcn Vite installation](https://ui.shadcn.com/docs/installation/vite)
  documents React/TypeScript, Tailwind integration, matching TS/Vite aliases and
  owned component sources. Scope initialization to the new workspace and review
  generated dependencies/styles; preserve the existing theme.

Old Router framework-path installation URLs returned 404; current official
manual above was inspected. No third-party tutorial is used as authority.

## Compatibility spike after planning approval

Reuse existing Vite 8 and root TypeScript/Bun toolchain. Verify compatible React
Vite plugin, matching React/ReactDOM 19 patches/types, Router 1, Query 5,
Tailwind/plugin matching 4 patches and pinned shadcn CLI/component source.
Record exact resolved versions, engine/peer constraints, CLI choice, lockfile
diff and minimal dev/typecheck/build before feature work. Do not upgrade Vue,
Elysia, Hey API, Playwright or the old Vite toolchain to force the spike to pass.
A material incompatibility returns to planning.

Minimal UI sources: Button, Input, Label, Card and Alert/status presentation.
Add only actual helper/primitive dependencies after inspecting selected registry
source. No blanket component set, form framework, schema validator, icon pack,
animation library, devtools or theme switcher is needed by simple entry forms.
Native controls remain appropriate where components already provide semantics.

## UUPM application and override record

Raw searches: `uupm-design-system.md` and `uupm-ux.md`. The installed database
suggested generic entertainment marketing hero/testimonials, blue/green palette
and remote Fredoka/Nunito fonts. These conflict with approved Warm Club and are
not adopted. React Native-specific skill sections do not govern this web SPA.

Adopt relevant UX guidance: visible labels/focus, honest loading/disabled states,
status/alerts, recoverable errors, touch targets, responsive reflow and reduced
motion. Existing tokens/system fonts, corridor/floor identity and join-primary/
create-secondary hierarchy are authoritative. No invented testimonials, remote
fonts, raster assets or global design-system MASTER file.

## Token bridge

Import shared CSS once in the new document; keep primitive values in
`packages/kyoushitsu/src/assets/theme.css`. Map shadcn semantic variables through
Tailwind `@theme inline` instead of copying palettes:

| React role | Warm Club source |
| --- | --- |
| background / foreground | `--color-canvas` / `--color-text` |
| card / card-foreground | `--color-surface` / `--color-text` |
| primary / primary-foreground | `--color-accent` / `--color-on-accent` |
| muted / muted-foreground | `--color-surface-muted` / `--color-text-muted` |
| border / input | `--color-border` / `--color-border-strong` |
| destructive / error surface | `--color-danger` / `--color-danger-surface` |
| ring | `--color-focus-ring` |
| spacing / typography | `--space-*`, `--font-display`, `--font-body`, existing size tokens |
| radius / motion | `--radius-sm/md/lg`, `--duration-fast/normal/slow`, existing easing |

Inspect Preflight/layer ordering against computed styles: button/border/font/
focus defaults must preserve Warm Club recipes. Adjust only React's document;
keep shared Vue CSS unchanged. Measure contrast of actual text/control state
pairs. Diagnostic screenshots at 1280x900/375x812, landscape/reflow and reduced
motion support review; no automatic pixel baselines or accessibility certification.
