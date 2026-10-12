import { type Locator, type Page, expect } from "@playwright/test"

export async function revealPlayerControl(page: Page, control: Locator): Promise<void> {
  if (!(await control.isVisible())) {
    await page.getByTestId("player-settings-toggle").click()
    await expect(page.getByRole("region", { name: "播放器设置", exact: true })).toBeVisible()
  }
  await expect(control).toBeVisible()
}

export async function clickPlayerControl(page: Page, control: Locator): Promise<void> {
  await revealPlayerControl(page, control)
  await control.click()
}

export async function closePlayerSettings(page: Page): Promise<void> {
  const panel = page.getByRole("region", { name: "播放器设置", exact: true })
  if (await panel.isVisible()) {
    await panel.getByRole("button", { name: "关闭", exact: true }).click()
    await expect(panel).toBeHidden()
  }
}
