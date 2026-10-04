# Design decisions

## Direction

Quiet architectural editorial: paper, warm ink and wood, restrained teal focus.
Use the existing Warm Club palette and font tokens. A bespoke vector drawing of
a classroom with a lit projection screen gives the corridor metaphor a concrete
visual anchor; derive all colors from theme tokens. Do not add stock imagery,
decorative looping animation, remote fonts, fake statistics or video autoplay.

## Entry

An aligned masthead, generous two-column editorial introduction and compact entry
desk replace the current top-heavy form layout. Preserve the configured h1,
subtitle, floor marker, hint and privacy note. The drawing supports the left
column on desktop; phone prioritizes the identity/form and places the illustration
after the form. A short closing line grounds the page without marketing clutter.
Signed-in identity is a quiet status strip, followed by clearly ranked join/create
cards. Long names wrap without clipping. Preserve input autofocus and form logic.

## Room

Keep the shipped grid, floating dock, composer, controls and cinema behavior.
Use a small room overline, typographic refinement and an original projection
motif in the empty stage. Use explicit text alongside connection state color.
No changes to runtime/session/player controllers.

## Motion and interaction

One short entry reveal communicates readiness, with immediate interactivity.
Hover/press/focus states use shared durations/easing and do not change layout.
Reduced motion removes translation and decorative reveal. Loading remains a
semantic status; errors remain alerts. Cursor and touch feedback apply to real
controls; no hover-only primary action.

## Research interpretation

The local UI/UX Pro Max search suggested oversized typography and negative space;
those principles suit the brand. Reject its unrelated pink/dark palette,
background-video pattern and external font imports. Its motion/accessibility
guidance supports restrained, non-looping transitions and readable focus states.
The Webby official criteria (https://www.webbyawards.com/judging-criteria/)
support assessing content, navigation, design, functionality and interactivity as
one experience. No raw third-party skill output is retained.
