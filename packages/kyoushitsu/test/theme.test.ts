import { expect, test } from "bun:test"
import { DEFAULT_THEME, applyTheme } from "../src/lib/theme"

test("the warm club theme is the selector-free default", () => {
  const attributes = new Map<string, string>()
  const root = { setAttribute: (name: string, value: string) => void attributes.set(name, value) }

  applyTheme(root)

  expect(DEFAULT_THEME).toBe("warm-club")
  expect(attributes.get("data-theme")).toBe("warm-club")
})
