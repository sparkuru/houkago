import { type Page, expect, test } from "@playwright/test"

type Source = { id: string; title: string }
type ResolutionMode = "ready" | "empty" | "error"

async function createRoom(page: Page): Promise<void> {
  await page.goto("/")
  const username = `danmaku_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    .replaceAll(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 32)
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByRole("textbox", { name: "密码", exact: true }).fill("abcdefgh")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(`已登录为 ${username}`)).toBeVisible()
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(/\/bushitsu\//)
}

async function addSource(page: Page, title: string, danmaku = false): Promise<Source> {
  const result = await page.evaluate(
    async ({ title: sourceTitle, withDanmaku }) => {
      const roomId = new URL(location.href).pathname.split("/").at(-1)
      const response = await fetch(`http://${location.hostname}:3000/bushitsu/${roomId}/enmoku`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: sourceTitle,
          type: "direct",
          url: "https://media.example.test/danmaku-source.mp4",
          ...(withDanmaku ? { danmaku: { type: "fetch", ref: "fixture:shared-release" } } : {}),
        }),
      })
      return { body: await response.json(), status: response.status }
    },
    { title, withDanmaku: danmaku },
  )
  expect(result.status).toBe(200)
  return { id: result.body.id as string, title: result.body.title as string }
}

async function openBangumi(page: Page): Promise<void> {
  const disclosure = page.locator(".bangumi-disclosure")
  if (!(await disclosure.evaluate((element) => element.hasAttribute("open")))) {
    await disclosure.locator(":scope > summary").click()
  }
  await expect(disclosure).toHaveAttribute("open", "")
}

async function playSource(page: Page, source: Source): Promise<void> {
  await openBangumi(page)
  const row = page.locator(".bangumi-row", { hasText: source.title })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "播放", exact: true }).click()
  await expect(page.locator(".timeline-danmaku-source")).toBeVisible()
}

test("danmaku source selection exposes provenance, fallback states, and responsive controls", async ({
  page,
}) => {
  const modes = new Map<string, ResolutionMode>()
  await page.route("**/danmaku/bushitsu/*/enmoku/*", async (route) => {
    const path = new URL(route.request().url()).pathname
    const enmokuId = decodeURIComponent(path.split("/").at(-1) ?? "")
    const mode = modes.get(enmokuId) ?? "ready"
    if (mode === "error") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL", message: "fixture failure" } }),
      })
      return
    }
    if (mode === "empty") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          bushitsuId: "fixture-room",
          enmokuId,
          policy: {
            allowedClasses: ["server-stored", "provider-official", "local", "third-party"],
            order: ["server-stored", "provider-official", "local", "third-party"],
            updatedAt: 0,
          },
          candidates: [],
          roomDefault: null,
        }),
      })
      return
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        bushitsuId: "fixture-room",
        enmokuId,
        policy: {
          allowedClasses: ["server-stored", "provider-official", "local", "third-party"],
          order: ["server-stored", "provider-official", "local", "third-party"],
          updatedAt: 0,
        },
        candidates: [
          {
            id: "fixture-stored",
            sourceClass: "server-stored",
            name: "存储弹幕",
            provenance: { provider: "fixture", label: "测试存储" },
            evidence: [{ kind: "filename", work: "fixture", episode: 1 }],
            confidence: "confirmed",
            releaseId: "fixture-release",
            episodeId: "fixture-episode",
            trackId: "fixture-stored",
            revisionId: "fixture-revision",
            availability: "available",
            cues: [{ time: 1, text: "stored cue", mode: "scroll" }],
          },
          {
            id: "fixture-official",
            sourceClass: "provider-official",
            name: "官方弹幕",
            provenance: { provider: "fixture", label: "测试官方" },
            evidence: [{ kind: "filename", work: "fixture", episode: 1 }],
            confidence: "confirmed",
            releaseId: "fixture-release",
            episodeId: "fixture-episode",
            trackId: "fixture-official",
            revisionId: "fixture-revision-2",
            availability: "available",
            cues: [{ time: 1, text: "official cue", mode: "scroll" }],
          },
          {
            id: "fixture-disabled",
            sourceClass: "third-party",
            name: "停用弹幕",
            availability: "disabled",
            reason: "fixture policy",
          },
        ],
        roomDefault: null,
      }),
    })
  })
  await page.route("**/eisha/danmaku/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([{ time: 1, text: "fallback cue", mode: "scroll" }]),
    }),
  )

  await createRoom(page)
  const ready = await addSource(page, "danmaku-ready", true)
  modes.set(ready.id, "ready")
  await playSource(page, ready)

  const panel = page.locator(".timeline-danmaku-source")
  await expect(panel.getByRole("button", { name: /存储弹幕/ })).toHaveClass(/selected/)
  await expect(panel.getByRole("button", { name: /停用弹幕/ })).toBeDisabled()
  await expect(panel.getByRole("button", { name: "设为部室默认" })).toBeVisible()
  await expect(panel.getByRole("button", { name: "提交公共建议" })).toBeVisible()
  const playerWrap = page.locator(".player-wrap").first()
  await playerWrap.evaluate((element) => element.setAttribute("data-danmaku-player", "stable"))

  await panel.getByRole("button", { name: /官方弹幕/ }).click()
  await expect(panel).toContainText("个人弹幕来源已保存")
  await expect(panel.getByRole("button", { name: /官方弹幕/ })).toHaveClass(/selected/)
  await expect(playerWrap).toHaveAttribute("data-danmaku-player", "stable")
  const selectedButton = panel.getByRole("button", { name: /官方弹幕/ })
  expect(
    await selectedButton.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44)

  const fallback = await addSource(page, "danmaku-fallback", true)
  modes.set(fallback.id, "error")
  await playSource(page, fallback)
  await expect(panel).toContainText("首选来源不可用，正在使用可用回退来源")

  const empty = await addSource(page, "danmaku-empty")
  modes.set(empty.id, "empty")
  await playSource(page, empty)
  await expect(panel).toContainText("当前演目没有可用的时间轴弹幕")

  const failed = await addSource(page, "danmaku-failed")
  modes.set(failed.id, "error")
  await playSource(page, failed)
  await expect(panel).toContainText("弹幕来源加载失败")
  await expect(panel.getByRole("button", { name: "重试弹幕来源" })).toBeVisible()

  const viewportWidth = page.viewportSize()?.width ?? 1280
  const panelBox = await panel.boundingBox()
  expect(panelBox).not.toBeNull()
  expect((panelBox?.x ?? 0) + (panelBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})
