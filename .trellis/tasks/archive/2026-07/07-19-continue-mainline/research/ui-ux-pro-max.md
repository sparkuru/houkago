# UUPM research — identity and room authorization

Generated during planning from the project-local Codex UUPM skill.

## Design-system result

- Pattern: minimal single-column form with one clear primary action.
- Priorities: visible labels, clear in-place error recovery, explicit loading and
  success feedback, keyboard navigation, and 44px-or-larger touch targets.
- Validation viewports: 375px, 768px, 1024px, and 1440px.

The generated blue/purple palette and new font pairing are not adopted: this
project already has an approved warm semantic-token system. The implementation
must reuse those existing tokens and typography instead of introducing a second
visual language.

## Form-specific findings

- Every input needs an associated visible label and errors announced through an
  `aria-live` region or `role="alert"`.
- Errors need an actionable recovery path near the affected field.
- Submit actions need a disabled/loading state and a visible success/failure
  result.
- Password entry should offer an accessible show/hide control and browser
  autofill-compatible attributes.
- Mobile layout is the base layout; desktop can add space without changing the
  form's reading or keyboard order.
