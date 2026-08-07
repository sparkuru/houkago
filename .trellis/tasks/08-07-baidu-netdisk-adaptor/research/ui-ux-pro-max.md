# UI/UX Pro Max research

Command:

```text
python3 .codex/skills/ui-ux-pro-max/scripts/search.py \
  "watch party secure cloud file browser desktop modal progressive disclosure" \
  --design-system -p "Houkago Baidu Adaptor"
```

Raw recommendation:

- Pattern: three-step funnel with progressive disclosure and one clear action
  per step.
- Style: high-contrast minimal presentation with generous whitespace; avoid
  decoration, complex shadows, and 3D effects.
- Palette suggestion: primary `#2563EB`, on-primary `#FFFFFF`, foreground
  `#0F172A`, background `#F8FAFC`, muted `#F1F5FD`, border `#E4ECFC`, danger
  `#DC2626`, visible primary focus ring. These are research suggestions only;
  implementation must reuse Houkago semantic theme tokens rather than create a
  competing palette.
- Typography suggestion: Inter with a clean hierarchy. Houkago keeps its
  existing typography rather than importing a new font for one modal.
- Checklist: visible focus, keyboard navigation, 4.5:1 text contrast,
  150-300ms state transitions, reduced-motion support, and stable layout.

Supplemental UX search:

```text
python3 .codex/skills/ui-ux-pro-max/scripts/search.py \
  "credential retention consent file browser modal extension missing disabled state keyboard accessibility" \
  --domain ux -n 12
```

Relevant raw results:

- Tab order must match visual order; no modal keyboard traps.
- Disabled actions need semantic `disabled`, reduced emphasis, and an adjacent
  explanation rather than color alone.
- Every interactive item needs a visible focus ring and accessible name.
- Form controls require visible labels; errors need `role=alert`/live feedback.
- Motion must respect `prefers-reduced-motion`.

Approved task decisions derived from the research:

- Connection is a three-step modal: adaptor check, retention choice with risk
  copy, then Baidu authorization/result. Server-saved is recommended but not
  preselected without explanation.
- File browsing is a separate native dialog with breadcrumb/back navigation,
  loading, empty, error/retry, selected, and connector-disconnected states.
- Directory rows and all footer/close actions are keyboard-operable with
  visible focus and at least 44px targets.
- A missing desktop adaptor disables only Baidu actions and includes a setup
  explanation; room entry and ordinary playback stay available.
- Mobile Baidu playback is explicitly unsupported in this task. Mobile UI
  shows a concise desktop-required state without horizontal overflow.
