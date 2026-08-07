# UI/UX Pro Max notes — subtitle controls

Applied guidance for this player-local control:

- Place the subtitle selector in the established player control sequence rather
  than adding a separate room panel; expose a text label and an Off choice, not
  color-only state.
- Use a real keyboard-operable selector with visible focus and at least 44px
  target height. The tab order follows existing quality and danmaku controls.
- Reuse the player/theme semantic colors and self-contained SVG/HTML because
  the control must also be legible after ArtPlayer moves into fullscreen.
- Keep it responsive: labels may truncate in the compact player bar but the
  full option label remains available, and phone verification must assert no
  horizontal viewport overflow.
- Do not introduce decorative animation; selection state changes should be
  immediate, readable, and safe when no track can load.
