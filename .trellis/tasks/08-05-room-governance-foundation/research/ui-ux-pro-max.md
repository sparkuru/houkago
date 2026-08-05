# UI/UX Pro Max — Room governance research

Command:

```sh
python3 .codex/skills/ui-ux-pro-max/scripts/search.py \
  "social video watch room governance warm club accessible member management" \
  --design-system --motion 2 --density 5 \
  -p "Houkago Room Governance" -f markdown
```

## Design System: Houkago Room Governance

### Design Dials

- **Motion:** 2/10 — Subtle
- **Density:** 5/10 — Standard

### Pattern

- **Name:** Community/Forum Landing
- **Conversion Focus:** Show active community (member count, posts today).
  Highlight benefits. Preview content. Easy onboarding.
- **CTA Placement:** Join button prominent + after member showcase.
- **Color Strategy:** Warm, welcoming. Member photos add humanity. Topic badges
  in brand colors. Activity indicators green.
- **Sections:** Hero, popular topics/categories, active members, join CTA.

### Style

- **Name:** Vibrant & Block-based
- **Mode Support:** Light ✓ Full | Dark ✓ Full
- **Keywords:** Bold, energetic, playful, block layout, geometric shapes, high
  color contrast, duotone, modern, energetic.
- **Best For:** Startups, creative agencies, gaming, social media,
  youth-focused, entertainment, consumer.
- **Performance:** Good. **Accessibility:** Ensure WCAG.

### Colors

| Role | Hex | CSS Variable |
| --- | --- | --- |
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

Notes: video pink on dark + timeline blue.

### Typography

- **Heading:** Fredoka
- **Body:** Nunito
- **Mood:** playful, friendly, fun, creative, warm, approachable.
- **Best For:** children's apps, educational, gaming, creative tools,
  entertainment.
- **Google Fonts:**
  `https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@300;400;500;600;700&display=swap`

### Key Effects

Large sections (48px+ gaps), animated patterns, bold hover (color shift),
scroll-snap, large type (32px+), 200–300ms.

### Motion

**Page Transition** (Subtle) — Trigger: route change | Duration: 200–300ms |
Easing: `power1.inOut`.

```js
gsap.to(main, {
  opacity: 0,
  duration: 0.2,
  onComplete: () => {
    navigate()
    gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.2 })
  },
})
```

- Preload the destination route's critical assets before the exit tween finishes.
- Do not block navigation on animation; cap exit duration at about 250ms.

### Avoid

- Flat design without depth.
- Text-heavy pages.

### Pre-delivery checklist

- No emojis as icons; use SVG icons.
- Clickable controls have pointer/pressed state and 150–300ms hover transition.
- Light-mode text contrast is at least 4.5:1; keyboard focus is visible; reduced
  motion is respected.
- Verify 375px, 768px, 1024px, and 1440px layouts.
