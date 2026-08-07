import { expect, test } from "@playwright/test"
import { registerAndCreateRoom, startSubtitleFixture } from "./subtitle-fixture"

test("subtitle selector remains visible without horizontal overflow", async ({ page }) => {
  await registerAndCreateRoom(page, "phone")
  await startSubtitleFixture(page)

  await expect(page.locator(".art-control-houkagoSubtitle")).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})
