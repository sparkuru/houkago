import { type Page, expect, test } from "@playwright/test"

async function createRoom(page: Page, accountSuffix: string): Promise<void> {
  await page.goto("/")
  const username = `pw_${Date.now()}_${accountSuffix}`
    .replaceAll(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 32)
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByRole("textbox", { name: "密码", exact: true }).fill("abcdefgh")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(`已登录为 ${username}`)).toBeVisible()
  await page.reload()
  await expect(page.getByText(`已登录为 ${username}`)).toBeVisible()
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)
}

test("portrait chat opens, expands, and closes as a modal sheet", async ({ page }) => {
  await createRoom(page, "portrait_chat")

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
  await createRoom(page, "portrait_queue")

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
