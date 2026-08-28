# UUPM raw research — Houkago Danmaku Source

Command:

```bash
python3 .codex/skills/ui-ux-pro-max/scripts/search.py "anime video room danmaku source selector mobile desktop accessibility" --design-system -f markdown -p "Houkago Danmaku Source"
```

## Design System: Houkago Danmaku Source

### Pattern
- **Name:** Video-First Hero
- **Conversion Focus:** 86% higher engagement with video. Add captions for accessibility. Compress video for performance.
- **CTA Placement:** Overlay on video (center/bottom) + Bottom section
- **Color Strategy:** Dark overlay 60% on video. Brand accent for CTA. White text on dark.
- **Sections:** 1. Hero with video background, 2. Key features overlay, 3. Benefits section, 4. CTA

### Style
- **Name:** Exaggerated Minimalism
- **Mode Support:** Light ✓ Full | Dark ✓ Full
- **Keywords:** Bold minimalism, oversized typography, high contrast, negative space, loud minimal, statement design, content first
- **Best For:** Existing video-first room UI; use only interaction and accessibility guidance for this feature.
- **Performance:** Excellent | **Accessibility:** WCAG AA

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#EC4899` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#DB2777` | `--color-secondary` |
| Accent/CTA | `#2563EB` | `--color-accent` |
| Background | `#0F172A` | `--color-background` |
| Foreground | `#FFFFFF` | `--color-foreground` |
| Muted | `#201A32` | `--color-muted` |
| Border | `rgba(255,255,255,0.08)` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#EC4899` | `--color-ring` |

### Typography
- **Heading:** Lexend
- **Body:** Source Sans 3
- **Mood:** trustworthy, readable, professional, clean

### Key Effects
- Keep the existing room/video density; use short 150–300ms transitions only where the project already has them.

### Avoid (Anti-patterns)
- Playful redesign, poor security UX, AI purple/pink gradients, emoji icons.

### Pre-Delivery Checklist
- [ ] No emojis as icons (use existing semantic/SVG controls)
- [ ] Clickable controls expose cursor and keyboard interaction
- [ ] Hover states do not replace focus states
- [ ] Text contrast remains at least 4.5:1
- [ ] Focus states are visible
- [ ] `prefers-reduced-motion` is respected
- [ ] Responsive at 375px, 768px, 1024px and 1440px
- [ ] No horizontal overflow

## Application decision

The parent task's existing warm-club tokens and video-first layout remain authoritative. This research informs the source panel's interaction, responsive and accessibility details only; it does not authorize a generic restyle of `BushitsuView`.
