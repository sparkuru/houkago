import { type Page, expect, test } from "@playwright/test"

async function createRoom(page: Page, accountSuffix: string): Promise<void> {
  await page.goto("/")
  const username = `pw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${accountSuffix}`
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

test("portrait room keeps the player first and shell controls within the viewport", async ({
  page,
}, testInfo) => {
  await createRoom(page, `portrait_shell_${testInfo.project.name}`)

  const player = page.locator(".player-wrap, .placeholder").first()
  const launcher = page.getByRole("button", { name: "打开聊天室" })
  const summaries = page.locator(".room-disclosure > summary, .bangumi-disclosure > summary")
  await expect(player).toBeVisible()
  await expect(launcher).toBeVisible()
  await expect(summaries).toHaveCount(2)
  await expect(launcher).toHaveCSS("min-height", "44px")

  const order = await page.evaluate(() => {
    const player = document.querySelector(".player-wrap, .placeholder")?.getBoundingClientRect()
    const launcher = document.querySelector(".mobile-chat-launcher")?.getBoundingClientRect()
    const summaries = Array.from(
      document.querySelectorAll(".room-disclosure > summary, .bangumi-disclosure > summary"),
    ).map((element) => element.getBoundingClientRect())
    return {
      playerBottom: player?.bottom ?? 0,
      launcherTop: launcher?.top ?? 0,
      summaryHeights: summaries.map((summary) => summary.height),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  expect(order.playerBottom).toBeLessThanOrEqual(order.launcherTop)
  expect(order.summaryHeights.every((height) => height >= 44)).toBe(true)
  expect(order.scrollWidth).toBeLessThanOrEqual(order.viewportWidth)

  await page.screenshot({ path: testInfo.outputPath("room-shell-portrait.png"), fullPage: false })
})

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

test("mobile keeps ordinary sources available while explaining desktop-only Baidu", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148",
    })
  })
  await page.route("**/baidu/status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        serverSavedEnabled: true,
        connected: false,
        adaptorOnline: false,
      }),
    }),
  )
  await createRoom(page, "baidu_mobile")
  await page.locator(".bangumi-disclosure > summary").click()

  const connectionManager = page.getByRole("button", { name: "管理百度连接" })
  await expect(connectionManager).toHaveCSS("min-height", "44px")
  const managerBox = await connectionManager.boundingBox()
  const viewportWidth = page.viewportSize()?.width ?? 375
  expect(managerBox).not.toBeNull()
  expect((managerBox?.x ?? 0) + (managerBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth)
  await connectionManager.click()
  const managementDialog = page.getByRole("dialog", { name: "连接百度网盘" })
  await expect(managementDialog).toBeVisible()
  const dialogBox = await managementDialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth)
  await page.keyboard.press("Escape")
  await expect(connectionManager).toBeFocused()

  await page.getByRole("button", { name: "从百度网盘选择" }).click()
  const dialog = page.getByRole("dialog", { name: "连接百度网盘" })
  await expect(dialog).toContainText("百度网盘播放目前仅支持安装 houkago-adapter 的桌面浏览器")
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()

  await page.getByRole("button", { name: "添加链接" }).click()
  await expect(page.getByLabel("视频链接")).toBeVisible()
})
