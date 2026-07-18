import { expect, test } from "@playwright/test"

test("portrait chat opens, expands, and closes as a modal sheet", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("昵称").fill("Playwright")
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)

  const launcher = page.getByRole("button", { name: "打开聊天室" })
  const dialog = page.locator("#mobile-chat-sheet")
  await expect(launcher).toBeVisible()
  await expect(dialog).toBeHidden()

  await launcher.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute("open", "")
  const defaultHeight = await dialog.evaluate((element) => element.getBoundingClientRect().height)

  await page.getByRole("button", { name: "展开聊天" }).click()
  await expect(page.getByRole("button", { name: "缩小聊天" })).toBeVisible()
  await expect
    .poll(() => dialog.evaluate((element) => element.getBoundingClientRect().height))
    .toBeGreaterThan(defaultHeight + 200)

  await page.getByRole("button", { name: "关闭聊天" }).click()
  await expect(dialog).toBeHidden()
  await expect(dialog).not.toHaveAttribute("open", "")

  await launcher.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
})

test("portrait room exposes an inline URL composer from the queue", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("昵称").fill("Queue playwright")
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)

  await page.locator(".bangumi-disclosure > summary").click()
  const launcher = page.getByRole("button", { name: "添加链接" })
  await expect(launcher).toBeVisible()
  await launcher.click()

  await expect(page.getByRole("heading", { name: "添加到番组表" })).toBeVisible()
  const sourceUrl = page.getByLabel("视频链接")
  await expect(sourceUrl).toBeVisible()
  await expect(page.getByRole("button", { name: "解析链接" })).toBeVisible()

  await sourceUrl.fill("https://media.example.test/video.mp4")
  await page.keyboard.press("Escape")
  await expect(launcher).toBeVisible()
  await launcher.click()
  await expect(sourceUrl).toHaveValue("https://media.example.test/video.mp4")

  await page.getByLabel("关闭添加链接").click()
  await expect(launcher).toBeVisible()
})
