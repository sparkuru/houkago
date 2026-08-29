import { type Page, expect, test } from "@playwright/test"

const signedInSeito = {
  id: "fixture-seito",
  username: "Mika",
  createdAt: 1_800_000_000_000,
}

const defaultSiteConfig = {
  site: { name: "社团活动室", subtitle: null, browserTitle: "社团活动室" },
  entry: {
    floorCode: "2F",
    floorLabel: "社团活动楼层",
    hint: "沿着安静的走廊，前往你已经约好的教室。",
    privacyNote: "这里不会展示其他教室。请使用收到的教室号码或邀请链接。",
    defaultBushitsuName: "新部室",
  },
}

test.beforeEach(async ({ page }) => {
  await page.route("**/site-config", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(defaultSiteConfig) }),
  )
})

async function fulfillSession(page: Page, seito: typeof signedInSeito | null): Promise<void> {
  await page.route("**/seitoshou/me", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(seito) }),
  )
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true)
}

async function expectTouchHeight(
  page: Page,
  selector: ReturnType<Page["getByRole"]>,
): Promise<void> {
  const box = await selector.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
}

async function expectSingleLine(selector: ReturnType<Page["locator"]>): Promise<void> {
  const metrics = await selector.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(style.lineHeight),
    }
  })
  expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight + 1)
}

test("session restoration settles into the quiet signed-out floor", async ({ page }) => {
  let finishRestore = () => {}
  const restoreGate = new Promise<void>((resolve) => {
    finishRestore = resolve
  })
  await page.route("**/seitoshou/me", async (route) => {
    await restoreGate
    await route.fulfill({ contentType: "application/json", body: "null" })
  })

  await page.goto("/")
  await expect(page.getByRole("status")).toContainText("正在确认入校记录")
  await expect(page.getByRole("heading", { name: "社团活动室" })).toBeVisible()
  await expectSingleLine(page.locator(".floor-sign h1"))
  await expect(page.locator(".brand-romanized")).toHaveCount(0)
  await expect(page).toHaveTitle("社团活动室")

  finishRestore()
  await expect(page.getByRole("heading", { name: "回到活动室楼层" })).toBeVisible()
  await expect(page.getByText("这里不会展示其他教室")).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test("authentication exposes stable labels, keyboard order, pending, and recovery feedback", async ({
  page,
}) => {
  await fulfillSession(page, null)
  let finishSignIn = () => {}
  const signInGate = new Promise<void>((resolve) => {
    finishSignIn = resolve
  })
  await page.route("**/seitoshou/sign-in", async (route) => {
    await signInGate
    await route.fulfill({ contentType: "application/json", body: "null" })
  })

  await page.goto("/")
  const username = page.getByLabel("用户名")
  const password = page.getByRole("textbox", { name: "密码", exact: true })
  await username.fill("mika")
  await username.focus()
  await page.keyboard.press("Tab")
  await expect(password).toBeFocused()
  await password.fill("abcdefgh")

  const submit = page.getByRole("button", { name: "登录并继续" })
  await expectTouchHeight(page, submit)
  await submit.click()
  const pending = page.getByRole("button", { name: "处理中…" })
  await expect(pending).toBeDisabled()

  finishSignIn()
  await expect(page.getByRole("alert")).toContainText("用户名或密码不正确")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await expect(page.getByRole("heading", { name: "登记一个新账号" })).toBeVisible()
  await expect(page.getByRole("button", { name: "注册并继续" })).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test("authenticated entry keeps the known classroom primary and the new classroom quiet", async ({
  page,
}) => {
  await fulfillSession(page, signedInSeito)
  await page.goto("/")

  await expect(page.getByText("已登录为 Mika")).toBeVisible()
  await expect(page.getByRole("heading", { name: "前往约好的教室" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "启用一间新教室" })).toBeVisible()

  const join = page.getByRole("button", { name: "入部", exact: true })
  const create = page.getByRole("button", { name: "创建并入部" })
  await expect(join).toBeDisabled()
  await expect(create).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expectTouchHeight(page, page.getByLabel("部室 id"))
  await expectTouchHeight(page, join)
  await expectTouchHeight(page, create)

  await page.getByLabel("部室 id").fill("fixture-room")
  await expect(join).toBeEnabled()
  await expect
    .poll(() =>
      page
        .locator("[data-entry-motion]")
        .evaluateAll((elements) =>
          elements.every((element) => getComputedStyle(element).opacity === "1"),
        ),
    )
    .toBe(true)
  await expectNoHorizontalOverflow(page)
})

test("new classroom creation exposes pending and recovery feedback", async ({ page }) => {
  await fulfillSession(page, signedInSeito)
  let finishCreate = () => {}
  let createBody: unknown
  const createGate = new Promise<void>((resolve) => {
    finishCreate = resolve
  })
  await page.route("**/bushitsu", async (route) => {
    createBody = route.request().postDataJSON()
    await createGate
    await route.fulfill({ contentType: "application/json", body: "null" })
  })

  await page.goto("/")
  const create = page.getByRole("button", { name: "创建并入部" })
  await create.click()
  const pending = page.getByRole("button", { name: "正在启用教室…" })
  await expect(pending).toBeDisabled()

  finishCreate()
  await expect(page.getByRole("alert")).toContainText("部室创建失败")
  await expect(page.getByRole("button", { name: "创建并入部" })).toBeEnabled()
  expect(createBody).toEqual({ name: "新部室" })
})

test("custom public config controls the floor identity, copy, title, and empty room name", async ({
  page,
}) => {
  const customConfig = {
    site: {
      name: "第三教学楼动画文化研究社团活动室",
      subtitle: "Quiet Screening Club",
      browserTitle: "今晚的社团放映室",
    },
    entry: {
      floorCode: "3F",
      floorLabel: "文化社团活动楼层",
      hint: "穿过三楼西侧走廊，前往约好的活动教室。",
      privacyNote: "系统只展示你主动输入的教室，不公开其他活动安排。",
      defaultBushitsuName: "周末动画研究会",
    },
  }
  let configRequests = 0
  let createBody: unknown
  await page.unroute("**/site-config")
  await page.route("**/site-config", (route) => {
    configRequests += 1
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(customConfig) })
  })
  await fulfillSession(page, signedInSeito)
  await page.route("**/bushitsu", (route) => {
    createBody = route.request().postDataJSON()
    return route.fulfill({ contentType: "application/json", body: "null" })
  })

  await page.goto("/")
  await expect(page.getByRole("heading", { name: customConfig.site.name })).toBeVisible()
  await expect(page.locator(".brand-romanized")).toHaveText(customConfig.site.subtitle)
  await expect(page.getByText(customConfig.entry.floorLabel)).toBeVisible()
  await expect(page.getByText(customConfig.entry.hint)).toBeVisible()
  await expect(page.getByText(customConfig.entry.privacyNote)).toBeVisible()
  await expect(page).toHaveTitle(customConfig.site.browserTitle)
  await expect(page.locator(".floor-sign h1", { hasText: "放学后" })).toHaveCount(0)
  await expect(page.locator(".floor-sign", { hasText: "HOUKAGO" })).toHaveCount(0)
  expect(configRequests).toBe(1)
  await expectNoHorizontalOverflow(page)

  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page.getByRole("alert")).toContainText("部室创建失败")
  expect(createBody).toEqual({ name: customConfig.entry.defaultBushitsuName })
})

test("reduced motion leaves entry surfaces immediately stable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await fulfillSession(page, signedInSeito)
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "前往约好的教室" })).toBeVisible()
  await expect(
    page
      .locator("[data-entry-motion]")
      .evaluateAll((elements) => elements.every((element) => element.getAnimations().length === 0)),
  ).resolves.toBe(true)
  await page.getByLabel("部室 id").fill("room-without-motion")
  await expect(page.getByRole("button", { name: "入部", exact: true })).toBeEnabled()
})
