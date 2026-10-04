import { type Page, expect, test } from "@playwright/test"
import { DEFAULT_SITE_CONFIG } from "houkago-kousoku"
const frontendUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173"
const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? "http://127.0.0.1:3000"
const housouPort = new URL(housouUrl).port
const account = { id: "fixture", username: "Mika", createdAt: 1 }
const anonymous = { error: { code: "UNAUTHORIZED", message: "Unauthorized" } }
async function identity(page: Page, signedIn = false) {
  await page.route("**/seitoshou/me", (route) =>
    route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? account : anonymous }),
  )
}
function protectedActivity(page: Page) {
  const activity: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (
      url.port === housouPort &&
      (url.pathname.startsWith("/bushitsu/") ||
        /^\/(?:ws|bangumi|enmoku|baidu|danmaku)(?:\/|$)/.test(url.pathname))
    )
      activity.push(request.url())
  })
  return activity
}
async function checkLayout(page: Page) {
  await page.locator(".entry-station").evaluate(async (station) => {
    await Promise.all(
      station.getAnimations({ subtree: true }).map((animation) => animation.finished),
    )
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
  for (const button of await page.getByRole("button").all()) {
    const box = await button.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
  expect(
    await page.locator('[data-slot="card"]').evaluateAll((cards) => {
      const reference = document.createElement("span")
      reference.style.color = "var(--color-border)"
      document.body.append(reference)
      const expected = getComputedStyle(reference).color
      reference.remove()
      return (
        cards.length > 0 &&
        cards.every((card) => getComputedStyle(card).borderTopColor === expected)
      )
    }),
  ).toBe(true)
}
test.beforeEach(async ({ page }) => {
  await page.route("**/site-config", (route) => route.fulfill({ json: DEFAULT_SITE_CONFIG }))
})

test("one delayed restore, anonymous form, keyboard and reduced-motion layout", async ({
  page,
}, info) => {
  let release = () => {}
  const gate = new Promise<void>((r) => {
    release = r
  })
  let reads = 0
  await page.route("**/seitoshou/me", async (route) => {
    reads++
    await gate
    await route.fulfill({ status: 401, json: anonymous })
  })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.getByRole("status")).toContainText("正在确认入校记录")
  release()
  await expect(page.getByLabel("用户名")).toBeVisible()
  expect(reads).toBe(1)
  await expect(page).toHaveTitle(DEFAULT_SITE_CONFIG.site.browserTitle)
  await page.getByLabel("用户名").focus()
  await page.keyboard.press("Tab")
  await expect(page.getByLabel("密码", { exact: true })).toBeFocused()
  await page.getByRole("button", { name: "显示密码" }).click()
  await expect(page.getByLabel("密码", { exact: true })).toHaveAttribute("type", "text")
  await expect(page.getByRole("button", { name: "隐藏密码" })).toHaveCSS("white-space", "nowrap")
  const passwordBox = await page.getByLabel("密码", { exact: true }).boundingBox()
  const revealBox = await page.getByRole("button", { name: "隐藏密码" }).boundingBox()
  expect(revealBox?.height).toBe(passwordBox?.height)
  await checkLayout(page)
  expect(errors).toEqual([])
  const motion = await page
    .getByRole("button", { name: "登录并继续" })
    .evaluate((el) => getComputedStyle(el).transitionDuration)
  expect(motion).toBe("0.001s")
  await page.screenshot({ path: info.outputPath("signed-out.png"), fullPage: true })
  const colors = await page.getByRole("button", { name: "登录并继续" }).evaluate((element) => {
    const style = getComputedStyle(element)
    return { text: style.color, background: style.backgroundColor }
  })
  function luminance(value: string) {
    const channels = value.match(/\d+/g)?.slice(0, 3).map(Number) ?? []
    const linear = channels.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722
  }
  const text = luminance(colors.text)
  const background = luminance(colors.background)
  const contrast = (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
  expect(contrast).toBeGreaterThanOrEqual(4.5)
  await info.attach("layout-measurements", {
    body: JSON.stringify({ colors, contrast, motion, reads, viewport: page.viewportSize() }),
    contentType: "application/json",
  })
  await page.setViewportSize({ width: 812, height: 375 })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await checkLayout(page)
})

test("authentication locks duplicates, clears credentials, handles typed failure and recovers", async ({
  page,
}) => {
  await identity(page)
  let release = () => {}
  const gate = new Promise<void>((r) => {
    release = r
  })
  let calls = 0
  await page.route("**/seitoshou/sign-in", async (route) => {
    calls++
    await gate
    await route.fulfill({
      status: 401,
      json: { error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } },
    })
  })
  await page.goto("/")
  await page.getByLabel("用户名").fill("mika")
  await page.getByLabel("密码", { exact: true }).fill("password-test")
  await page.getByRole("button", { name: "登录并继续" }).click()
  await expect(page.getByRole("button", { name: "处理中…" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "没有账号？注册" })).toBeDisabled()
  release()
  await expect(page.getByRole("alert")).toContainText("用户名或密码不正确")
  expect(calls).toBe(1)
  await expect(page.getByLabel("密码", { exact: true })).toHaveValue("")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await expect(page.getByRole("heading", { name: "登记一个新账号" })).toBeVisible()
  await checkLayout(page)
})

test("non-auth restore failure blocks forms until manual recovery", async ({ page }) => {
  let reads = 0
  await page.route("**/seitoshou/me", (route) => {
    reads++
    return route.fulfill({
      status: reads <= 2 ? 503 : 401,
      json: reads <= 2 ? { error: { code: "FAILED", message: "temporary" } } : anonymous,
    })
  })
  await page.goto("/")
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible()
  await expect(page.getByLabel("用户名")).toHaveCount(0)
  expect(reads).toBe(2)
  await page.getByRole("button", { name: "重试" }).click()
  await expect(page.getByLabel("用户名")).toBeVisible()
  expect(reads).toBe(3)
})

test("registration preserves mode through pending, failure and explicit retry", async ({
  page,
}) => {
  await identity(page)
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  await page.route("**/seitoshou/register", async (route) => {
    calls++
    if (calls === 1) {
      await gate
      await route.fulfill({
        status: 409,
        json: { error: { code: "USERNAME_TAKEN", message: "Username taken" } },
      })
    } else await route.fulfill({ json: account })
  })
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill("mika")
  await page.getByLabel("密码", { exact: true }).fill("password-test")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByRole("heading", { name: "登记一个新账号" })).toBeVisible()
  await expect(page.getByRole("button", { name: "处理中…" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "已有账号？登录" })).toBeDisabled()
  await expect(page.getByLabel("密码", { exact: true })).toHaveValue("")
  release()
  await expect(page.getByRole("alert")).toContainText("注册失败")
  await expect(page.getByRole("heading", { name: "登记一个新账号" })).toBeVisible()
  await expect(page.getByLabel("用户名")).toBeFocused()
  expect(calls).toBe(1)
  await page.getByLabel("密码", { exact: true }).fill("password-retry")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText("Mika", { exact: true })).toBeVisible()
  expect(calls).toBe(2)
})

test("create locks pending controls, reports failure and retries only on submit", async ({
  page,
}) => {
  await identity(page, true)
  const forbidden = protectedActivity(page)
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let calls = 0
  await page.route("**/bushitsu", async (route) => {
    calls++
    expect(route.request().postDataJSON()).toEqual({ name: "retry-room" })
    if (calls === 1) {
      await gate
      await route.fulfill({
        status: 503,
        json: { error: { code: "FAILED", message: "Unavailable" } },
      })
    } else
      await route.fulfill({
        json: { id: "retry-room", name: "retry-room", buchouId: "fixture", createdAt: 1 },
      })
  })
  await page.goto("/")
  await page.getByLabel("部室名").fill("retry-room")
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page.getByRole("button", { name: "正在启用教室…" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "退出登录" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "入部", exact: true })).toBeDisabled()
  release()
  await expect(page.getByRole("alert")).toContainText("部室创建失败")
  await expect(page.getByRole("button", { name: "创建并入部" })).toBeEnabled()
  await expect(page).toHaveURL(`${frontendUrl}/`)
  expect(calls).toBe(1)
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(`${frontendUrl}/bushitsu/retry-room`)
  expect(calls).toBe(2)
  expect(forbidden).toEqual([])
})

test("persisted pageshow reloads a disposed entry and restores current cookie identity", async ({
  page,
}) => {
  let reads = 0
  let signedIn = false
  await page.route("**/seitoshou/me", (route) => {
    reads++
    return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? account : anonymous })
  })
  await page.goto("/")
  await expect(page.getByLabel("用户名")).toBeVisible()
  expect(reads).toBe(1)
  signedIn = true
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))
  })
  await expect.poll(() => reads).toBe(2)
  await expect(page.getByText("Mika", { exact: true })).toBeVisible()
})

test("configured name/title create body enters the direct React room", async ({ page }, info) => {
  await identity(page, true)
  await page.route("**/site-config", (route) =>
    route.fulfill({
      json: {
        ...DEFAULT_SITE_CONFIG,
        site: { name: "周末社团活动室", subtitle: "Houkago", browserTitle: "周末放映" },
        entry: { ...DEFAULT_SITE_CONFIG.entry, defaultBushitsuName: "周末新教室" },
      },
    }),
  )
  let creates = 0
  const forbidden = protectedActivity(page)
  await page.route("**/bushitsu", async (route) => {
    creates++
    expect(route.request().postDataJSON()).toEqual({ name: "周末新教室" })
    await route.fulfill({
      json: { id: "created-room", name: "周末新教室", buchouId: "fixture", createdAt: 1 },
    })
  })
  await page.goto("/")
  await expect(page).toHaveTitle("周末放映")
  await expect(page.getByLabel("部室名")).toHaveAttribute("placeholder", "周末新教室")
  await checkLayout(page)
  await page.screenshot({ path: info.outputPath("signed-in.png"), fullPage: true })
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(`${frontendUrl}/bushitsu/created-room`)
  await expect(page.getByRole("main")).toContainText("正在入室")
  expect(creates).toBe(1)
  expect(forbidden).toEqual([])
})

test("join invite opens encoded React room ID without search/hash", async ({ page }) => {
  await identity(page, true)
  await page.goto("/")
  await expect(page.getByRole("button", { name: "入部", exact: true })).toBeDisabled()
  await page
    .getByLabel("部室 id")
    .fill("https://invite.test/bushitsu/%E6%95%99%E5%AE%A4?secret=x#hash")
  await expect(page.getByRole("button", { name: "入部", exact: true })).toBeEnabled()
  await expect(page).toHaveURL(`${frontendUrl}/`)
  await page.getByRole("button", { name: "入部", exact: true }).click()
  await expect(page).toHaveURL(`${frontendUrl}/bushitsu/%E6%95%99%E5%AE%A4`)
})

test("direct anonymous room restores identity before protected HTTP", async ({ page }) => {
  await identity(page)
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.url().startsWith(housouUrl)) requests.push(request.url())
  })
  const forbidden = protectedActivity(page)
  await page.goto("/bushitsu/direct-room?secret=x#hash")
  await expect(page).toHaveURL(`${frontendUrl}/`)
  expect(requests.some((url) => url.includes("/seitoshou/me"))).toBe(true)
  expect(forbidden).toEqual([])
})

test("logout failure reconciles account; successful logout clears entry drafts", async ({
  page,
}) => {
  let signedIn = true
  let signouts = 0
  await page.route("**/seitoshou/me", (route) =>
    route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? account : anonymous }),
  )
  await page.route("**/seitoshou/sign-out", (route) => {
    if (++signouts === 1)
      return route.fulfill({
        status: 503,
        json: { error: { code: "FAILED", message: "uncertain" } },
      })
    signedIn = false
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto("/")
  await page.getByLabel("部室 id").fill("old-draft")
  await page.getByRole("button", { name: "退出登录" }).click()
  await expect(page.getByRole("alert")).toContainText("退出登录未能确认")
  await expect(page.getByText("Mika", { exact: true })).toBeVisible()
  await expect(page.getByLabel("部室 id")).toHaveValue("")
  await page.getByRole("button", { name: "退出登录" }).click()
  await expect(page.getByLabel("用户名")).toBeVisible()
  expect(signouts).toBe(2)
})

test("invalid path/room input and revoked notice are accessible", async ({ page }) => {
  await identity(page, true)
  await page.goto("/?revoked=1")
  await expect(page.getByRole("alert")).toContainText("你已被移出该部室")
  await page.getByLabel("部室 id").fill("%2F")
  await page.getByRole("button", { name: "入部", exact: true }).click()
  await expect(page.getByRole("alert").last()).toContainText("无法打开教室")
  await page.goto("/unknown")
  await expect(page.getByRole("alert")).toContainText("没有找到这个入口")
})

test("invalid successful config blocks bootstrap rather than silently defaulting", async ({
  page,
}) => {
  await identity(page)
  await page.route("**/site-config", (route) => route.fulfill({ json: {} }))
  await page.goto("/")
  await expect(page.getByRole("alert")).toContainText("楼层信息暂时无法读取")
  await expect(page.getByLabel("用户名")).toHaveCount(0)
})

test("editorial entry keeps configured identity and usable forms at narrow, tablet and wide sizes", async ({
  page,
}, info) => {
  await identity(page)
  const name = "周末的电影与音乐交流活动室"
  await page.route("**/site-config", (route) =>
    route.fulfill({
      json: {
        ...DEFAULT_SITE_CONFIG,
        site: { name, subtitle: "After school, together", browserTitle: name },
        entry: {
          ...DEFAULT_SITE_CONFIG.entry,
          floorLabel: "电影与音乐交流社团的活动楼层",
        },
      },
    }),
  )
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name)
  await expect(page.getByText("After school, together", { exact: true })).toBeVisible()
  const floorCodeHeight = await page.locator(".floor-code").evaluate((code) => {
    const style = getComputedStyle(code)
    return {
      height: code.getBoundingClientRect().height,
      singleLine:
        Number.parseFloat(style.lineHeight) +
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom) +
        Number.parseFloat(style.borderTopWidth) +
        Number.parseFloat(style.borderBottomWidth),
    }
  })
  expect(floorCodeHeight.height).toBeCloseTo(floorCodeHeight.singleLine, 0)
  const widths = info.project.name === "entry-phone" ? [320, 375] : [768, 812, 1280, 1440]
  for (const width of widths) {
    await page.setViewportSize({ width, height: width === 812 ? 375 : 900 })
    await checkLayout(page)
    const positions = await page.locator(".home-shell").evaluate((shell) => {
      const rect = (selector: string) => {
        const element = shell.querySelector(selector)
        if (!element) throw new Error(`Missing entry element: ${selector}`)
        const { left, right, top, bottom } = element.getBoundingClientRect()
        return { left, right, top, bottom }
      }
      return {
        intro: rect(".floor-sign"),
        desk: rect(".entry-station"),
        scene: rect(".home-scene"),
        controls: Array.from(shell.querySelectorAll("input, button, .floor-marker")).map(
          (element) => {
            const { left, right } = element.getBoundingClientRect()
            return { left, right }
          },
        ),
      }
    })
    for (const control of positions.controls) {
      expect(control.left).toBeGreaterThanOrEqual(0)
      expect(control.right).toBeLessThanOrEqual(width)
    }
    if (width <= 800) {
      expect(positions.desk.top).toBeGreaterThanOrEqual(positions.intro.bottom)
      expect(positions.scene.top).toBeGreaterThanOrEqual(positions.desk.bottom)
    } else {
      expect(positions.desk.left).toBeGreaterThan(positions.intro.right)
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%"
  })
  await checkLayout(page)
  await page.getByLabel("用户名").fill("visual-user")
  await page.getByLabel("密码", { exact: true }).fill("visual-password")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await expect(page.getByRole("heading", { name: "登记一个新账号" })).toBeVisible()
  await expect(page.getByLabel("用户名")).toBeFocused()
  await expect(page.getByLabel("密码", { exact: true })).toHaveValue("")
  await expect(page.locator(".entry-station > [data-slot=card]")).toHaveCSS(
    "animation-name",
    "none",
  )
  await page.screenshot({ path: info.outputPath("long-identity.png"), fullPage: true })
})
