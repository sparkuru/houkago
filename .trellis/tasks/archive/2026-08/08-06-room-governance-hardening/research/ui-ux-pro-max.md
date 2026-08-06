## Raw UUPM design-system output

Query: `entertainment social room governance accessible responsive`

### Pattern

- Hero + Testimonials + CTA; vibrant block-based entertainment visual language.

### Color and typography suggestion

- Vibrant rose/blue palette; Righteous/Poppins typography; 200–300ms hover and
  interaction transitions.

### Accessibility and responsive checklist

- Keep focus states visible and text contrast at least 4.5:1.
- Cover 375, 768, 1024, and 1440 pixel viewports; respect reduced motion.
- Use vector controls, semantic buttons, 44px touch targets, keyboard access,
  and accessible errors.

## Raw UUPM UX search output

Query: `destructive confirmation dialog pending error keyboard responsive`

- Confirm destructive actions before deleting.
- Keep keyboard tab order logical and avoid focus traps.
- Announce errors with `role="alert"`; display recovery feedback beside the
  action rather than only visually or at the top of the screen.
- Keep focus indicators visible and provide a retry path for failed requests.

## Approved task decisions

- This hardening task does not introduce a new page, palette, typography, or
  decorative motion. Retain the existing warm-club tokens and native dialog.
- Browser tests must prove native Escape/cancel behavior, visible destructive
  confirmation, disabled pending state, inline `role="alert"` failure feedback,
  44px touch target, and phone/desktop layout without horizontal overflow.
- The owner roster is private server truth; successful removal is acknowledged
  by the authoritative `MEIBO` update. The revoked member receives the existing
  home-route notice and must not auto-reconnect.
