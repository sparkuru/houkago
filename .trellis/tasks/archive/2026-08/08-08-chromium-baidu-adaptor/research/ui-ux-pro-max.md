# UI/UX Pro Max research — Chromium adaptor diagnostics

Generated 2026-08-08 for an entertainment watch-party browser-extension
diagnostic flow. This is raw research, not an approved replacement design.

## Design-system result

- Pattern: Minimal Single Column; one clear recovery action, short description,
  no navigation clutter.
- Suggested style: OLED dark mode with high contrast and visible focus.
- Suggested visual palette: cyan/purple/magenta on a near-black background.
- Suggested typography: Righteous/Poppins.
- Suggested effects: minimal glow, dark-to-light transitions, visible focus.
- Checklist: vector icons rather than emoji, visible hover/focus states,
  150–300 ms transitions, reduced-motion support, responsive checks.

## UX diagnostic search result

The focused query for browser-extension permissions and recovery returned:

1. Every error must provide a clear next step rather than a dead end.
2. Errors must be announced with `aria-live` or `role="alert"`, not only color.
3. Place the error beside the affected action or field.
4. Do not silently fail extension detection or permission work.
5. Show a loading indicator for asynchronous waits longer than 300 ms.
6. A waiting or loading state must never resemble a frozen interface.

## Planning decision

Houkago keeps its existing theme, fonts, tokens, components, and responsive
layout. The generated palette, fonts, glow, and landing-page structure are
rejected because this task is diagnostics hardening, not a redesign. Only the
state clarity, accessible announcement, nearby recovery action, existing 44 px
target, visible focus, and reduced-motion requirements carry into `design.md`.
