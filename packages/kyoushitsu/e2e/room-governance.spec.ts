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

async function createMemberContexts(browser: Browser) {
  const ownerContext = await browser.newContext()
  const memberContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  const memberPage = await memberContext.newPage()
  return { ownerContext, memberContext, ownerPage, memberPage }
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
