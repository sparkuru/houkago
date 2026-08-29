# UI/UX Pro Max research — visual experience refresh

## Scope

This is task-local research input, not an approved design system. It records
the 2026-08-29 planning query for an anime watch-party, social video room,
warm, nostalgic, content-first web application and reconciles the output with
repository evidence.

## Useful guidance

- Keep accessibility, touch behavior, responsive layout, and performance ahead
  of decoration.
- Use semantic tokens for typography, color, controls, state, spacing,
  elevation, and motion.
- Preserve visible focus, 44px targets, non-color state cues, clear disabled and
  loading feedback, and reduced-motion behavior.
- Use a consistent icon, radius, shadow, and interaction-state language.
- Keep motion purposeful, interruptible, and generally within 150–300ms using
  opacity and transform rather than layout-affecting properties.

## Reconciliation with project evidence

The raw search recommended a vibrant block-based rose/blue presentation and a
newsletter/content-first page pattern. Those suggestions conflict with the
approved warm club-room identity, media-first room structure, and asset-light
application boundary. They are not adopted.

The repository already has the stronger product-specific baseline:

- `packages/kyoushitsu/src/assets/theme.css` defines the `warm-club` semantic
  palette, spacing, radii, and elevation.
- The archived `07-18-trellis-plus-frontend-refactor` design approves calm
  paper-like surfaces, restrained wood/amber accents, comfortable spacing, and
  a player-first room.
- Desktop persistent chat, mobile chat sheet, cinema mode, accessibility, and
  reduced-motion behavior are established product contracts.

## Planning implication

The lowest-risk, highest-coherence recommendation is `warm-club 2.0`: retain
the existing identity while improving typography, hierarchy, control recipes,
status treatment, density, and cross-component consistency. A broader rebrand
remains a user-owned decision and must not be inferred from raw search output.

## Approved direction — 2026-08-29

The user approved `Warm Club 2.0`.

A refined search used Japanese after-school music club, watch party, warm cream
paper, wood/amber, cozy editorial, and media-first terms with moderate variance,
subtle motion, and standard density. Its useful matches were warm ink on cream,
amber accent, Japanese serif/sans hierarchy, 150–200ms interaction transitions,
and a video-first priority. The generated flat/no-shadow and marketing hero
recommendations are not adopted because they conflict with the existing soft
elevation and application-shell contracts.

Font recommendations remain research only. A bundled/system Japanese serif for
display roles and rounded/system sans stack for interface roles avoids adding a
network font dependency in the first slice; any font package or hosted font
requires an explicit implementation-time performance and licensing decision.
