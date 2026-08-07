import { type Browser, type Page, expect, test } from "@playwright/test"

async function register(page: Page, suffix: string): Promise<string> {
  const username = `governance_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${suffix}`
    .replaceAll(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 32)
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByRole("textbox", { name: "密码", exact: true }).fill("abcdefgh")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(`已登录为 ${username}`)).toBeVisible()
  return username
}

async function createRoom(page: Page): Promise<string> {
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)
  return page.url()
}

async function joinRoom(page: Page, roomUrl: string): Promise<void> {
  await page.getByLabel("部室 id").fill(roomUrl)
  await page.getByRole("button", { name: "入部", exact: true }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)
}

async function openRoomControls(page: Page): Promise<void> {
  const disclosure = page.locator(".room-disclosure")
  const open = await disclosure.evaluate((element) => element.hasAttribute("open"))
  if (!open) await disclosure.locator("summary").click()
  await expect(page.getByRole("heading", { name: "成员名册" })).toBeVisible()
}

async function openBangumi(page: Page): Promise<void> {
  const disclosure = page.locator(".bangumi-disclosure")
  const open = await disclosure.evaluate((element) => element.hasAttribute("open"))
  if (!open) await disclosure.locator("summary").click()
  await expect(disclosure).toHaveAttribute("open", "")
  await expect(disclosure.locator(".bangumi-content")).toBeVisible()
}

async function addQueueSource(page: Page, title: string): Promise<void> {
  const response = await page.evaluate(
    async ({ roomId, sourceTitle }) => {
      const base = `http://${location.hostname}:3000`
      const result = await fetch(`${base}/bushitsu/${roomId}/enmoku`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: sourceTitle,
          type: "direct",
          url: `https://media.example.test/${sourceTitle}.mp4`,
        }),
      })
      return { status: result.status, body: await result.json() }
    },
    { roomId: new URL(page.url()).pathname.split("/").at(-1), sourceTitle: title },
  )
  expect(response.status).toBe(200)
}

async function createMemberContexts(browser: Browser) {
  const ownerContext = await browser.newContext()
  const memberContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const memberPage = await memberContext.newPage()
  const ownerFrames: string[] = []
  const memberFrames: string[] = []
  const ownerErrors: string[] = []
  const memberErrors: string[] = []
  ownerPage.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => ownerFrames.push(frame.payload)),
  )
  memberPage.on("websocket", (socket) =>
    socket.on("framereceived", (frame) => memberFrames.push(frame.payload)),
  )
  ownerPage.on("pageerror", (error) => ownerErrors.push(error.message))
  memberPage.on("pageerror", (error) => memberErrors.push(error.message))
  return {
    ownerContext,
    memberContext,
    ownerPage,
    memberPage,
    ownerFrames,
    memberFrames,
    ownerErrors,
    memberErrors,
  }
}

function latestBangumiTitles(frames: readonly string[]): string[] | null {
  for (const frame of [...frames].reverse()) {
    const message = JSON.parse(frame) as {
      type?: string
      payload?: { enmoku?: Array<{ title: string }> }
    }
    if (message.type === "BANGUMI")
      return message.payload?.enmoku?.map((enmoku) => enmoku.title) ?? []
  }
  return null
}

test("owner can cancel, retry, and confirm a member removal without reconnecting the revoked browser", async ({
  browser,
}, testInfo) => {
  const { ownerContext, memberContext, ownerPage, memberPage } = await createMemberContexts(browser)
  try {
    await register(ownerPage, `${testInfo.project.name}_owner`)
    const roomUrl = await createRoom(ownerPage)
    const memberName = await register(memberPage, `${testInfo.project.name}_member`)
    await joinRoom(memberPage, roomUrl)
    await openRoomControls(ownerPage)

    const roster = ownerPage.locator(".member-list-block", {
      has: ownerPage.getByRole("heading", { name: "成员名册" }),
    })
    await expect(roster).toContainText(memberName)
    const remove = ownerPage.getByRole("button", { name: `移除成员 ${memberName}` })
    await remove.click()
    const dialog = ownerPage.getByRole("dialog", { name: "移除成员？" })
    await expect(dialog).toBeVisible()
    await ownerPage.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(roster).toContainText(memberName)

    await ownerPage.route("**/bushitsu/*/meibo/*", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL", message: "test failure" } }),
      }),
    )
    await remove.click()
    await dialog.getByRole("button", { name: "确认移除" }).click()
    await expect(dialog.getByRole("alert")).toHaveText("移除失败，请稍后重试。")
    await expect(dialog).toBeVisible()
    await ownerPage.unroute("**/bushitsu/*/meibo/*")

    let continueRequest: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      continueRequest = resolve
    })
    let forwardedRequest: (() => void) | undefined
    const forwarded = new Promise<void>((resolve) => {
      forwardedRequest = resolve
    })
    await ownerPage.route("**/bushitsu/*/meibo/*", async (route) => {
      await pending
      await route.continue()
      forwardedRequest?.()
    })
    const confirm = dialog.getByRole("button", { name: "确认移除" })
    await confirm.click()
    await expect(confirm).toBeDisabled()
    continueRequest?.()
    await forwarded
    await ownerPage.unroute("**/bushitsu/*/meibo/*")

    await expect(memberPage).toHaveURL(/\?revoked=1/)
    await expect(memberPage.getByRole("alert")).toHaveText("你已被移出该部室。")
    await expect(roster).not.toContainText(memberName)
    await expect
      .poll(() =>
        ownerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true)
    await memberPage.waitForTimeout(750)
    await expect(memberPage).toHaveURL(/\?revoked=1/)
  } finally {
    await ownerContext.close()
    await memberContext.close()
  }
})

test("owner reorders and clears pending sources while members never receive queue-management controls", async ({
  browser,
}, testInfo) => {
  const {
    ownerContext,
    memberContext,
    ownerPage,
    memberPage,
    ownerFrames,
    memberFrames,
    ownerErrors,
    memberErrors,
  } = await createMemberContexts(browser)
  try {
    await register(ownerPage, `${testInfo.project.name}_queue_owner`)
    const roomUrl = await createRoom(ownerPage)
    await register(memberPage, `${testInfo.project.name}_queue_member`)
    await joinRoom(memberPage, roomUrl)

    await addQueueSource(ownerPage, "第一部")
    await addQueueSource(ownerPage, "第二部")
    await addQueueSource(ownerPage, "第三部")
    await openBangumi(ownerPage)
    await openBangumi(memberPage)

    const ownerRows = ownerPage.locator(".bangumi-row")
    await expect(ownerRows).toHaveCount(3)
    await expect(ownerRows.nth(0)).toContainText("第一部")
    await expect(ownerRows.nth(1)).toContainText("第二部")
    await expect(ownerRows.nth(0).getByRole("button", { name: "上移" })).toBeDisabled()
    await expect(ownerRows.nth(2).getByRole("button", { name: "下移" })).toBeDisabled()

    await ownerRows.nth(1).getByRole("button", { name: "播放", exact: true }).click()
    await expect(ownerRows.nth(1)).toContainText("上映中")
    const moveResponse = ownerPage.waitForResponse(
      (response) => response.url().includes("/bangumi/") && response.url().endsWith("/move"),
    )
    await ownerRows.nth(1).getByRole("button", { name: "上移" }).click()
    expect((await moveResponse).status()).toBe(200)
    const serverOrder = await ownerPage.evaluate(async (roomId) => {
      const response = await fetch(`http://${location.hostname}:3000/bushitsu/${roomId}/bangumi`, {
        credentials: "include",
      })
      return (await response.json()).map((enmoku: { title: string }) => enmoku.title)
    }, new URL(ownerPage.url()).pathname.split("/").at(-1))
    expect(serverOrder).toEqual(["第二部", "第一部", "第三部"])
    await expect
      .poll(() => latestBangumiTitles(ownerFrames))
      .toEqual(["第二部", "第一部", "第三部"])
    await expect
      .poll(() => latestBangumiTitles(memberFrames))
      .toEqual(["第二部", "第一部", "第三部"])
    await ownerPage.waitForTimeout(1_000)
    expect(latestBangumiTitles(ownerFrames)).toEqual(["第二部", "第一部", "第三部"])
    expect(latestBangumiTitles(memberFrames)).toEqual(["第二部", "第一部", "第三部"])
    expect(ownerErrors).toEqual([])
    expect(memberErrors).toEqual([])
    await expect(memberPage.locator(".bangumi-row").nth(0)).toContainText("第二部")
    await expect(ownerRows.nth(0)).toContainText("第二部")

    await expect(memberPage.getByRole("button", { name: "清空待播" })).toHaveCount(0)
    await expect(memberPage.getByRole("button", { name: "上移" })).toHaveCount(0)
    await expect(memberPage.getByRole("button", { name: "下移" })).toHaveCount(0)

    await ownerPage.getByRole("button", { name: "清空待播" }).click()
    const dialog = ownerPage.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "清空待播节目？" })).toBeVisible()
    await ownerPage.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(ownerRows).toHaveCount(3)

    await ownerPage.getByRole("button", { name: "清空待播" }).click()
    await dialog.getByRole("button", { name: "确认清空" }).click()
    await expect(dialog).toBeHidden()
    await expect(ownerRows).toHaveCount(1)
    await expect(ownerRows.nth(0)).toContainText("第二部")
    await expect(ownerRows.nth(0)).toContainText("上映中")
    await expect(memberPage.locator(".bangumi-row")).toHaveCount(1)
    await expect(memberPage.locator(".bangumi-row").nth(0)).toContainText("第二部")
  } finally {
    await ownerContext.close()
    await memberContext.close()
  }
})
