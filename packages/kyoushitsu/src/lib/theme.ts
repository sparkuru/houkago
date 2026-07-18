export const DEFAULT_THEME = "warm-club" as const

export type ThemeId = typeof DEFAULT_THEME

export function applyTheme(
  root: Pick<HTMLElement, "setAttribute">,
  theme: ThemeId = DEFAULT_THEME,
): void {
  root.setAttribute("data-theme", theme)
}
