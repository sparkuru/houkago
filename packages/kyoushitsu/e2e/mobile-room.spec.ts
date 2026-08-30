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

async function addRoomSource(page: Page, title: string): Promise<void> {
  const result = await page.evaluate(
    async ({ sourceTitle }) => {
      const roomId = new URL(location.href).pathname.split("/").at(-1)
      const response = await fetch(`http://${location.hostname}:3000/bushitsu/${roomId}/enmoku`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: sourceTitle,
          type: "direct",
          url: "https://media.example.test/portrait-queue.mp4",
        }),
      })
      return { body: await response.json(), status: response.status }
    },
    { sourceTitle: title },
  )
  expect(result.status).toBe(200)
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

test("portrait queue keeps dense actions touch-sized, wrapped, and bounded", async ({
  page,
}, testInfo) => {
  await createRoom(page, `portrait_queue_actions_${testInfo.project.name}`)
  await expect(page.locator(".bangumi-disclosure > summary")).toBeVisible()
  const titles = [
    "第一部 · 很长的公开视频标题用于验证队列边界不会溢出",
    "第二部 · 当前播放项目",
    "第三部 · 最后一个待播项目",
  ]
  for (const title of titles) await addRoomSource(page, title)
  await page.reload()
  await page.locator(".bangumi-disclosure > summary").click()

  const rows = page.locator(".bangumi-row")
  await expect(rows).toHaveCount(3)
  await expect(page.locator(".bangumi-disclosure > summary").locator("span")).toHaveText("3")
  await expect(rows.first().locator(".bangumi-title > span")).toHaveAttribute("title", titles[0])
  await expect(rows.first().getByRole("button", { name: "上移" })).toBeDisabled()
  await expect(rows.last().getByRole("button", { name: "下移" })).toBeDisabled()

  const targetRow = page.locator(".bangumi-row", { hasText: titles[1] })
  await expect(targetRow.getByRole("button", { name: "播放", exact: true })).toHaveClass(/primary/)
  await expect(targetRow.getByRole("button", { name: "删除" })).toHaveClass(/destructive/)
  await targetRow.getByRole("button", { name: "播放", exact: true }).click()
  await expect(targetRow).toHaveAttribute("aria-current", "true")
  await expect(targetRow.getByText("上映中", { exact: true })).toBeVisible()

  const geometry = await page.locator(".bangumi").evaluate((element) => {
    const actions = Array.from(
      element.querySelectorAll<HTMLButtonElement>(".bangumi-actions button"),
    )
    const boxes = actions.map((button) => {
      const box = button.getBoundingClientRect()
      return {
        height: box.height,
        left: box.left,
        minHeight: getComputedStyle(button).minHeight,
        right: box.right,
        top: box.top,
      }
    })
    return {
      boxes,
      actionRows: new Set(boxes.map((box) => Math.round(box.top))).size,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  expect(geometry.boxes.every((box) => box.minHeight === "44px")).toBe(true)
  expect(geometry.boxes.every((box) => box.height >= 43.5)).toBe(true)
  expect(geometry.boxes.every((box) => box.left >= 0 && box.right <= geometry.viewportWidth)).toBe(
    true,
  )
  expect(geometry.actionRows).toBeGreaterThan(1)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)

  await page.screenshot({
    path: testInfo.outputPath("queue-actions-portrait.png"),
    fullPage: false,
  })
})

test("portrait room exposes a responsive URL composer with retained and reset drafts", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await createRoom(page, "portrait_queue")

  await page.locator(".bangumi-disclosure > summary").click()
  const launcher = page.getByRole("button", { name: "添加链接" })
  await expect(launcher).toBeVisible()
  await expect(launcher).toHaveClass(/primary/)
  await expect(page.getByRole("button", { name: "管理百度连接" })).toHaveClass(/quiet/)
  await launcher.click()

  await expect(page.getByRole("heading", { name: "添加到番组表" })).toBeVisible()
  const sourceUrl = page.getByLabel("视频链接")
  await expect(sourceUrl).toBeVisible()
  const resolveButton = page.getByRole("button", { name: "解析链接" })
  await expect(resolveButton).toBeVisible()
  await expect(page.locator(".enmoku-composer form")).toHaveCSS("animation-duration", "0.001s")

  await sourceUrl.fill("https://media.example.test/video.mp4")
  await page.keyboard.press("Escape")
  await expect(launcher).toBeVisible()
  await launcher.click()
  await expect(sourceUrl).toHaveValue("https://media.example.test/video.mp4")

  let releasePreview: (() => void) | undefined
  await page.route("**/enmoku/preview", async (route) => {
    await new Promise<void>((resolve) => {
      releasePreview = resolve
    })
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ state: "ready", title: "解析后的公开视频", type: "direct" }),
    })
  })
  await resolveButton.click()
  await expect.poll(() => Boolean(releasePreview)).toBe(true)
  await expect(page.locator(".enmoku-composer")).toHaveAttribute("aria-busy", "true")
  await expect(page.getByRole("button", { name: "正在解析…" })).toBeDisabled()
  releasePreview?.()

  await expect(page.getByRole("region", { name: "解析结果" })).toContainText("解析后的公开视频")
  const queueButton = page.getByRole("button", { name: "加入队列", exact: true })
  const queueAndSwitchButton = page.getByRole("button", { name: "加入并切换到房间播放" })
  const editButton = page.getByRole("button", { name: "修改链接" })
  await expect(queueButton).toHaveClass(/primary/)
  await expect(queueAndSwitchButton).toHaveClass(/secondary/)
  await expect(editButton).toHaveClass(/quiet/)

  const composerGeometry = await page.locator(".enmoku-composer").evaluate((element) => ({
    controls: Array.from(
      element.querySelectorAll<HTMLElement>(":scope > form input, :scope > form button"),
    )
      .filter((control) => control.getClientRects().length > 0)
      .map((control) => {
        const box = control.getBoundingClientRect()
        return {
          height: box.height,
          left: box.left,
          minHeight: getComputedStyle(control).minHeight,
          right: box.right,
        }
      }),
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
  expect(composerGeometry.controls.every((control) => control.minHeight === "44px")).toBe(true)
  expect(composerGeometry.controls.every((control) => control.height >= 43.5)).toBe(true)
  expect(
    composerGeometry.controls.every(
      (control) => control.left >= 0 && control.right <= composerGeometry.viewportWidth,
    ),
  ).toBe(true)
  expect(composerGeometry.scrollWidth).toBeLessThanOrEqual(composerGeometry.viewportWidth)
  await page.screenshot({
    path: testInfo.outputPath("source-composer-portrait.png"),
    fullPage: false,
  })

  let releaseAdd: (() => void) | undefined
  await page.route("**/bushitsu/*/enmoku", async (route) => {
    await new Promise<void>((resolve) => {
      releaseAdd = resolve
    })
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture failure" }),
    })
  })
  await queueButton.click()
  await expect.poll(() => Boolean(releaseAdd)).toBe(true)
  await expect(page.locator(".enmoku-composer")).toHaveAttribute("aria-busy", "true")
  await expect(page.getByRole("button", { name: "正在加入…" })).toBeDisabled()
  await expect(queueAndSwitchButton).toBeDisabled()
  await expect(editButton).toBeDisabled()
  releaseAdd?.()
  await expect(page.locator(".composer-error[role='alert']")).toHaveText(
    "加入队列失败，请稍后重试。",
  )

  await page.getByLabel("关闭添加链接").click()
  await expect(launcher).toBeVisible()
  await launcher.click()
  await expect(sourceUrl).toHaveValue("")
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
