import { type Page, expect, test } from "@playwright/test"

async function createRoom(page: Page, accountSuffix: string): Promise<void> {
  await page.goto("/")
  const username = `pw_${Date.now()}_${accountSuffix}`
    .replaceAll(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 32)
  const register = page.getByRole("button", { name: "没有账号？注册" })
  await expect(register).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await register.hover()
  await expect(register).toHaveCSS("background-color", "rgb(238, 228, 211)")
  await register.click()
  await page.getByLabel("用户名").fill(username)
  await page.getByRole("textbox", { name: "密码", exact: true }).fill("abcdefgh")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(`已登录为 ${username}`)).toBeVisible()
  await page.reload()
  await expect(page.getByText(`已登录为 ${username}`)).toBeVisible()
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)
}

test("a short desktop viewport scrolls the left room stage to its expanded queue composer", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-short", "short viewport coverage")
  await createRoom(page, "Short desktop")
  await page.getByRole("button", { name: "添加链接" }).click()

  const stage = page.locator(".stage")
  await expect(stage).toHaveCSS("overflow-y", "auto")
  await expect(
    stage.evaluate((element) => element.scrollHeight > element.clientHeight),
  ).resolves.toBe(true)

  const sourceUrl = page.getByLabel("视频链接")
  await sourceUrl.scrollIntoViewIfNeeded()
  await expect(sourceUrl).toBeVisible()
})

test("a tall desktop viewport keeps the room workbench content-sized", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-tall", "tall viewport coverage")
  await createRoom(page, "Tall desktop")
  await page.getByRole("button", { name: "添加链接" }).click()
  await expect(page.getByRole("heading", { name: "添加到番组表" })).toBeVisible()

  const workbench = page.locator(".room-workbench")
  await expect(workbench).toHaveCSS("flex-grow", "0")
  await expect(workbench).toHaveCSS("flex-shrink", "0")
})
