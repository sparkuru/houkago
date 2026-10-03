import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? "http://127.0.0.1:3000"
const mediaUrl = "https://media.example.test/room-controls/clip.mp4"
const clip = readFile(fileURLToPath(new URL("./fixtures/media/clip.mp4", import.meta.url)))

async function createRoom(page: import("@playwright/test").Page): Promise<string> {
  const username = `rc_${randomUUID().replaceAll("-", "").slice(0, 20)}`
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill("Room-controls-fixture-password")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await page.getByLabel("部室名").fill(`Room controls ${username}`)
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page.getByLabel("视频链接")).toBeVisible()
  const roomId = new URL(page.url()).pathname.split("/").at(-1)
  if (!roomId) throw new Error("Room ID is missing")
  return roomId
}

async function registerViewer(page: import("@playwright/test").Page): Promise<void> {
  const username = `rcg_${randomUUID().replaceAll("-", "").slice(0, 20)}`
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill("Room-controls-fixture-password")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(username, { exact: true })).toBeVisible()
}

async function addCurrentItem(page: import("@playwright/test").Page, roomId: string) {
  await page.route(mediaUrl, async (route) => {
    const bytes = await clip
    const range = route
      .request()
      .headers()
      .range?.match(/^bytes=(\d+)-(\d*)$/)
    const start = range ? Number(range[1]) : 0
    const end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1
    const partial = Boolean(range) && start < bytes.length && end >= start
    await route.fulfill({
      status: partial ? 206 : 200,
      contentType: "video/mp4",
      headers: {
        "access-control-allow-origin": "*",
        "accept-ranges": "bytes",
        ...(partial ? { "content-range": `bytes ${start}-${end}/${bytes.length}` } : {}),
      },
      body: partial ? bytes.subarray(start, end + 1) : bytes,
    })
  })

  const title = "Room controls fixture"
  const response = await page.context().request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
    headers: { origin: new URL(page.url()).origin },
    data: { title, type: "direct", url: mediaUrl },
  })
  expect(response.status()).toBe(200)
  const item = page.getByRole("listitem").filter({ hasText: title })
  await expect(item).toBeVisible()
  await item.getByRole("button", { name: "设为当前" }).click()
  await expect(page.locator(".player-stage")).toBeVisible()
}

async function expectNoSpeedDialOverlap(
  page: import("@playwright/test").Page,
  selector: string,
  target = ".room-chat-form",
) {
  const targetElements = page.locator(target)
  await expect(targetElements.first()).toBeVisible()
  const overlaps = await page.locator(selector).evaluateAll((elements, targetSelector) => {
    const targetElements = Array.from(document.querySelectorAll(targetSelector))
    return elements.flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return targetElements.flatMap((targetElement) => {
        const targetRect = targetElement.getBoundingClientRect()
        if (
          rect.left >= targetRect.right ||
          rect.right <= targetRect.left ||
          rect.top >= targetRect.bottom ||
          rect.bottom <= targetRect.top
        ) {
          return []
        }
        return [
          {
            action: element.textContent?.trim(),
            actionRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            target: `${targetElement.tagName.toLowerCase()}.${String(targetElement.className)}`,
            targetRect: {
              x: targetRect.x,
              y: targetRect.y,
              width: targetRect.width,
              height: targetRect.height,
            },
          },
        ]
      })
    })
  }, target)
  expect(overlaps).toEqual([])
}

async function expectActionsWithinViewport(page: import("@playwright/test").Page) {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  const boxes = await page.locator(".room-speed-dial-action").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    }),
  )
  expect(boxes.length).toBeGreaterThan(0)
  for (const box of boxes) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport?.width ?? 0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport?.height ?? 0)
  }
}

async function waitForSpeedDialState(
  page: import("@playwright/test").Page,
  open: boolean,
): Promise<void> {
  const actions = page.locator(".room-speed-dial-actions")
  if (open) {
    const actionButtons = actions.getByRole("button")
    await expect
      .poll(() =>
        actionButtons.evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).opacity),
        ),
      )
      .toEqual(Array.from({ length: await actionButtons.count() }, () => "1"))
    return
  }
  await expect(actions).toHaveCSS("visibility", "hidden")
}

async function resizeViewport(
  page: import("@playwright/test").Page,
  viewport: { width: number; height: number },
): Promise<void> {
  await page.setViewportSize(viewport)
  await page.waitForTimeout(100)
}

async function expectRoomColumnLayout(
  page: import("@playwright/test").Page,
  phone: boolean,
): Promise<void> {
  const layout = await page.locator(".room-grid").evaluate((grid) => {
    function measure(element: Element) {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect()
      return { x, y, width, height, right, bottom }
    }

    function measureChild(selector: string) {
      const element = grid.querySelector(selector)
      if (!element) throw new Error(`Missing room layout element: ${selector}`)
      return measure(element)
    }

    const side = grid.querySelector(".room-side")
    const rail = grid.querySelector(".room-chat-rail")
    if (!side || !rail) throw new Error("Missing room dock layout element")

    return {
      grid: measure(grid),
      main: measureChild(".room-main"),
      side: measureChild(".room-side"),
      queue: measureChild(".room-queue"),
      rowGap: Number.parseFloat(getComputedStyle(grid).rowGap),
      columnGap: Number.parseFloat(getComputedStyle(grid).columnGap),
      sideDisplay: getComputedStyle(side).display,
      dockPosition: getComputedStyle(rail).position,
    }
  })

  expect(Math.abs(layout.queue.x - layout.grid.x)).toBeLessThanOrEqual(1)
  if (phone) {
    expect(Math.abs(layout.queue.width - layout.grid.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.side.y - (layout.main.bottom + layout.rowGap))).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.queue.y - (layout.side.bottom + layout.rowGap))).toBeLessThanOrEqual(1)
  } else if (layout.dockPosition === "fixed") {
    expect(layout.sideDisplay).toBe("contents")
    expect(Math.abs(layout.queue.width - layout.main.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.queue.y - (layout.main.bottom + layout.rowGap))).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.main.right - layout.grid.right)).toBeLessThanOrEqual(1)
  } else {
    expect(Math.abs(layout.queue.width - layout.main.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.queue.y - (layout.main.bottom + layout.rowGap))).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.side.x - (layout.main.right + layout.columnGap))).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.side.y - layout.main.y)).toBeLessThanOrEqual(1)
    expect(layout.side.bottom).toBeGreaterThanOrEqual(layout.queue.bottom - 1)
    expect(layout.side.right).toBeLessThanOrEqual(layout.grid.right + 1)
  }
}

async function expectRoomHeaderGeometry(
  page: import("@playwright/test").Page,
  expectedFontSize?: number,
) {
  const geometry = await page.locator(".room-topbar").evaluate((header) => {
    const intro = header.firstElementChild
    const heading = intro?.querySelector("h1")
    if (!intro || !heading) throw new Error("Missing room header layout element")
    const headingRect = heading.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    const style = getComputedStyle(heading)
    return {
      headingHeight: headingRect.height,
      fontSize: Number.parseFloat(style.fontSize),
      headingLeft: headingRect.left,
      headerLeft: headerRect.left,
    }
  })
  await expect(page.locator(".room-topbar").getByRole("link", { name: "返回楼层" })).toHaveCount(0)
  expect(Math.abs(geometry.headingLeft - geometry.headerLeft)).toBeLessThanOrEqual(1)
  expect(geometry.headingHeight).toBeLessThanOrEqual(geometry.fontSize * 1.5)
  if (expectedFontSize !== undefined) {
    expect(geometry.fontSize).toBeCloseTo(expectedFontSize, 1)
  }
}

async function expectRoomWorkspaceGeometry(
  page: import("@playwright/test").Page,
  expectedMaxWidth?: number,
) {
  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".room-topbar")
    const grid = document.querySelector(".room-grid")
    const launcher = document.querySelector(".room-speed-dial-launcher")
    const rail = document.querySelector(".room-chat-rail")
    const roomPage = document.querySelector(".room-page")
    if (!header || !grid || !launcher || !rail || !roomPage) {
      throw new Error("Missing room workspace layout element")
    }
    const headerRect = header.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    const launcherRect = launcher.getBoundingClientRect()
    const railRect = rail.getBoundingClientRect()
    return {
      viewportWidth: innerWidth,
      header: { x: headerRect.x, right: headerRect.right, width: headerRect.width },
      grid: { x: gridRect.x, right: gridRect.right, width: gridRect.width },
      launcherRight: launcherRect.right,
      dockGap: railRect.left - gridRect.right,
      pageContentWidth:
        roomPage.clientWidth -
        Number.parseFloat(getComputedStyle(roomPage).paddingLeft) -
        Number.parseFloat(getComputedStyle(roomPage).paddingRight),
    }
  })
  expect(Math.abs(geometry.header.x - geometry.grid.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.header.right - geometry.grid.right)).toBeLessThanOrEqual(1)
  expect(geometry.grid.width).toBeLessThanOrEqual(geometry.pageContentWidth + 1)
  expect(geometry.dockGap).toBeGreaterThanOrEqual(12)
  expect(geometry.dockGap).toBeLessThanOrEqual(20)
  if (geometry.viewportWidth >= 1600) {
    expect(Math.abs(geometry.launcherRight - (geometry.grid.right - 16))).toBeLessThanOrEqual(1)
  } else {
    expect(geometry.viewportWidth - geometry.launcherRight).toBeGreaterThanOrEqual(15)
  }
  if (expectedMaxWidth !== undefined) {
    expect(geometry.grid.width).toBeGreaterThan(expectedMaxWidth)
  }
}

async function expectChatDockGeometry(page: import("@playwright/test").Page, cinema = false) {
  const geometry = await page.evaluate(() => {
    function measure(element: Element) {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect()
      return { x, y, width, height, right, bottom }
    }
    const rail = document.querySelector(".room-chat-rail")
    const grid = document.querySelector(".room-grid")
    const form = document.querySelector(".room-chat-form")
    const player = document.querySelector(".room-current .player-stage")
    const queue = document.querySelector(".room-queue")
    const launcher = document.querySelector(".room-speed-dial-launcher")
    const feed = document.querySelector(".room-chat-rail .room-feed")
    const attendance = document.querySelector(".room-dock-attendance")
    const danmaku = document.querySelector(".room-dock .danmaku-feature")
    const chat = document.querySelector(".room-dock .room-chat-panel")
    if (
      !rail ||
      !grid ||
      !form ||
      !player ||
      !queue ||
      !launcher ||
      !feed ||
      !attendance ||
      !danmaku ||
      !chat
    ) {
      throw new Error("Missing chat dock layout element")
    }
    function overlaps(left: ReturnType<typeof measure>, right: ReturnType<typeof measure>) {
      return (
        left.x < right.right &&
        left.right > right.x &&
        left.y < right.bottom &&
        left.bottom > right.y
      )
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      rail: measure(rail),
      railBackground: getComputedStyle(rail).backgroundColor,
      railBorderTop: getComputedStyle(rail).borderTopWidth,
      railInnerBottom:
        measure(rail).bottom -
        Number.parseFloat(getComputedStyle(rail).paddingBottom) -
        Number.parseFloat(getComputedStyle(rail).borderBottomWidth),
      attendance: measure(attendance),
      danmaku: measure(danmaku),
      chat: measure(chat),
      chatInnerBottom:
        measure(chat).bottom -
        Number.parseFloat(getComputedStyle(chat).paddingBottom) -
        Number.parseFloat(getComputedStyle(chat).borderBottomWidth),
      grid: measure(grid),
      form: measure(form),
      player: measure(player),
      queue: measure(queue),
      launcher: measure(launcher),
      position: getComputedStyle(rail).position,
      feedOverflowY: getComputedStyle(feed).overflowY,
      feedFlex: getComputedStyle(feed).flexGrow,
      dockOverlapsPlayer: overlaps(measure(rail), measure(player)),
      dockOverlapsQueue: overlaps(measure(rail), measure(queue)),
    }
  })
  expect(geometry.position).toBe("fixed")
  expect(geometry.viewport.width - geometry.rail.right).toBeGreaterThanOrEqual(8)
  expect(geometry.viewport.width - geometry.rail.right).toBeLessThanOrEqual(20)
  expect(geometry.rail.y).toBeLessThanOrEqual(1)
  expect(geometry.viewport.height - geometry.rail.bottom).toBeLessThanOrEqual(1)
  expect(
    geometry.rail.height + geometry.rail.y + (geometry.viewport.height - geometry.rail.bottom),
  ).toBeCloseTo(geometry.viewport.height, 0)
  expect(geometry.railBackground).not.toBe("rgba(0, 0, 0, 0)")
  expect(geometry.railBorderTop).toBe("1px")
  expect(geometry.rail.x - geometry.grid.right).toBeGreaterThanOrEqual(8)
  expect(geometry.attendance.y).toBeGreaterThanOrEqual(geometry.rail.y)
  expect(geometry.danmaku.y).toBeGreaterThanOrEqual(geometry.attendance.bottom)
  expect(geometry.chat.y).toBeGreaterThanOrEqual(geometry.danmaku.bottom)
  expect(geometry.chat.bottom).toBeLessThanOrEqual(geometry.rail.bottom)
  expect(Math.abs(geometry.chat.bottom - geometry.railInnerBottom)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.form.bottom - geometry.chatInnerBottom)).toBeLessThanOrEqual(1)
  expect(geometry.form.x).toBeGreaterThanOrEqual(geometry.rail.x)
  expect(geometry.form.right).toBeLessThanOrEqual(geometry.rail.right)
  expect(geometry.form.y).toBeGreaterThanOrEqual(geometry.rail.y)
  expect(geometry.form.bottom).toBeLessThanOrEqual(geometry.rail.bottom)
  expect(geometry.launcher.right).toBeLessThanOrEqual(geometry.rail.x)
  expect(geometry.dockOverlapsPlayer).toBe(false)
  if (!cinema) expect(geometry.dockOverlapsQueue).toBe(false)
  expect(geometry.feedOverflowY).toBe("auto")
  expect(Number(geometry.feedFlex)).toBeGreaterThan(0)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
}

async function expectDockPinnedWhileScrolling(page: import("@playwright/test").Page) {
  const before = await page.locator(".room-chat-rail").boundingBox()
  expect(before).not.toBeNull()
  await page.evaluate(() => window.scrollTo({ top: 120, behavior: "instant" }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  const after = await page.locator(".room-chat-rail").boundingBox()
  expect(after).not.toBeNull()
  expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1)
}

async function fillChatHistoryUntilScrollable(
  page: import("@playwright/test").Page,
  initialMessageCount = 0,
) {
  const feed = page.locator(".room-chat-rail .room-feed")
  const input = page.locator("#chat-message")
  const send = page.locator(".room-chat-form").getByRole("button", { name: "发送" })
  const messageCount = await feed.evaluate((element) => Math.ceil(element.clientHeight / 32) + 4)
  for (let index = 0; index < messageCount; index += 1) {
    await input.fill(`dock scroll line ${index + 1}`)
    await send.click()
  }
  await expect(feed.locator("li")).toHaveCount(messageCount + initialMessageCount)
  await expect(feed.locator("li").last()).toContainText(`dock scroll line ${messageCount}`)
  const dimensions = await feed.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return {
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      scrollTop: element.scrollTop,
      lastItemBottom: element.lastElementChild?.getBoundingClientRect().bottom ?? 0,
      lastMessageBottom:
        element.lastElementChild?.querySelector("p")?.getBoundingClientRect().bottom ?? 0,
      feedBottom: element.getBoundingClientRect().bottom,
    }
  })
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight)
  expect(dimensions.scrollTop).toBeGreaterThan(0)
  expect(dimensions.lastItemBottom).toBeLessThanOrEqual(dimensions.feedBottom + 1)
  expect(dimensions.lastMessageBottom).toBeLessThanOrEqual(dimensions.feedBottom + 1)
}

test("speed dial dismissal, focus, room settings and copy feedback", async ({
  page,
  browser,
}, info) => {
  await createRoom(page)
  const roomUrl = page.url()
  await expect(page.locator(".room-topbar").getByRole("link", { name: "返回楼层" })).toHaveCount(0)
  const launcher = page.locator(".room-speed-dial-launcher")
  const actions = page.locator(".room-speed-dial-actions")

  await expect(launcher).toHaveAccessibleName("房间控制")
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await expect(actions).toHaveAttribute("aria-hidden", "true")
  await expect(actions).toHaveAttribute("inert")
  await expect(actions.getByRole("button")).toHaveCount(0)

  const launcherBox = await launcher.boundingBox()
  expect(launcherBox?.width).toBeGreaterThanOrEqual(44)
  expect(launcherBox?.height).toBeGreaterThanOrEqual(44)
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  expect((launcherBox?.x ?? 0) + (launcherBox?.width ?? 0)).toBeLessThanOrEqual(
    (viewport?.width ?? 0) - 15,
  )
  expect((launcherBox?.y ?? 0) + (launcherBox?.height ?? 0)).toBeLessThanOrEqual(
    (viewport?.height ?? 0) - 15,
  )

  if (info.project.name !== "room-controls-phone" && launcherBox) {
    const startX = launcherBox.x + launcherBox.width / 2
    const startY = launcherBox.y + launcherBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX - 48, startY - 24)
    await page.mouse.up()
    const draggedBox = await launcher.boundingBox()
    expect(draggedBox).not.toBeNull()
    expect(Math.abs((draggedBox?.x ?? 0) - launcherBox.x)).toBeGreaterThan(20)
    const storedPosition = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("houkago.kyoushitsu.room-floating-position.v1") ?? "null"),
    )
    expect(storedPosition).toMatchObject({ version: 1 })
    await launcher.focus()
    await page.keyboard.press("ArrowRight")
    const nudgedBox = await launcher.boundingBox()
    expect(nudgedBox).not.toBeNull()
    expect((nudgedBox?.x ?? 0) - (draggedBox?.x ?? 0)).toBeGreaterThan(0)
  }

  if (info.project.name === "room-controls-phone") {
    await page.touchscreen.tap(
      (launcherBox?.x ?? 0) + (launcherBox?.width ?? 0) / 2,
      (launcherBox?.y ?? 0) + (launcherBox?.height ?? 0) / 2,
    )
    await expect(launcher).toHaveAttribute("aria-expanded", "true")
    await page.touchscreen.tap(10, 10)
    await expect(launcher).toHaveAttribute("aria-expanded", "false")
  }

  await launcher.press("Enter")
  await expect(launcher).toHaveAttribute("aria-expanded", "true")
  await expect(launcher).not.toHaveAccessibleName("房间控制")
  const informationAction = actions.getByRole("button", { name: "房间控制", exact: true })
  await expect(informationAction).toBeFocused()
  await page.keyboard.press("Escape")
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await expect(launcher).toBeFocused()
  await expect(actions).toHaveAttribute("inert")

  await launcher.click()
  await page.locator(".room-speed-dial-backdrop").click({ position: { x: 10, y: 10 } })
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await expect(launcher).toBeFocused()

  await launcher.click()
  await launcher.click()
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await expect(launcher).toBeFocused()

  await launcher.click()
  await informationAction.click()
  const dialog = page.getByRole("dialog", { name: "房间控制" })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator("#admission-mode")).toBeVisible()
  await expect(dialog.getByLabel("播放控制")).toBeVisible()
  await expect(dialog.locator(".room-controls-info-list")).toContainText("已入室")
  await expect(dialog.locator(".room-controls-dialog-header button")).toBeFocused()
  const dialogBox = await dialog.boundingBox()
  const dialogViewport = page.viewportSize()
  const expectedDialogLeft = ((dialogViewport?.width ?? 0) - (dialogBox?.width ?? 0)) / 2
  expect(dialogBox).not.toBeNull()
  expect(dialogViewport).not.toBeNull()
  expect(Math.abs((dialogBox?.x ?? 0) - expectedDialogLeft)).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: test.info().outputPath("room-controls-dialog.png"),
    animations: "disabled",
  })
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(launcher).toBeFocused()

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"])
  await launcher.click()
  await actions.getByRole("button", { name: "复制房间链接" }).click()
  const copiedUrl = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiedUrl).toBe(page.url())
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await launcher.click()
  await expect(actions.getByRole("button", { name: "已复制", exact: true })).toBeVisible()
  await waitForSpeedDialState(page, true)
  await page.screenshot({
    path: test.info().outputPath("room-controls.png"),
    animations: "disabled",
  })

  const guestContext = await browser.newContext({ baseURL: new URL(roomUrl).origin })
  const guest = await guestContext.newPage()
  try {
    await registerViewer(guest)
    await guest.goto(roomUrl)
    const guestLauncher = guest.locator(".room-speed-dial-launcher")
    await expect(guestLauncher).toHaveAccessibleName("房间信息")
    await guestLauncher.click()
    await guest
      .locator(".room-speed-dial-actions")
      .getByRole("button", { name: "房间信息" })
      .click()
    const guestDialog = guest.getByRole("dialog", { name: "房间信息" })
    await expect(guestDialog.locator(".room-controls-info-list")).toContainText("已入室")
    await expect(guestDialog.locator("#admission-mode")).toHaveCount(0)
    await expect(guestDialog.locator(".room-form")).toHaveCount(0)
  } finally {
    await guestContext.close()
  }
  await actions.getByRole("button", { name: "返回楼层", exact: true }).click()
  await expect(page).toHaveURL(new URL("/", roomUrl).href)
})

test("gated viewers retain a return link without the action menu", async ({ page, browser }) => {
  await createRoom(page)
  const roomUrl = page.url()
  await page.locator(".room-speed-dial-launcher").click()
  await page.locator(".room-speed-dial-actions").getByRole("button", { name: "房间控制" }).click()
  const dialog = page.getByRole("dialog", { name: "房间控制" })
  await dialog.locator("#admission-mode").selectOption("closed")
  await dialog.getByRole("button", { name: "保存入室方式" }).click()
  await expect(dialog.locator(".room-controls-info-list")).toContainText("禁止")
  const guestContext = await browser.newContext({ baseURL: new URL(roomUrl).origin })
  try {
    const guest = await guestContext.newPage()
    await registerViewer(guest)
    await guest.goto(roomUrl)
    await expect(guest.locator(".room-gate")).toBeVisible()
    await expect(guest.locator(".room-speed-dial-launcher")).toHaveCount(0)
    await guest.getByRole("link", { name: "返回楼层" }).click()
    await expect(guest).toHaveURL(new URL("/", roomUrl).href)
  } finally {
    await guestContext.close()
  }
})

test("playlist width, viewport bounds and cinema controls stay usable", async ({ page }, info) => {
  const roomId = await createRoom(page)
  const defaultViewport = page.viewportSize()
  let initialChatMessageCount = 0
  if (!defaultViewport) throw new Error("Desktop viewport size is unavailable")
  if (info.project.name !== "room-controls-phone") {
    await resizeViewport(page, { width: 2048, height: 1235 })
    await expectRoomWorkspaceGeometry(page, 1320)
    const emptyStage = await page.locator(".room-current").evaluate((stage) => {
      const bounds = stage.getBoundingClientRect()
      const first = stage.firstElementChild?.getBoundingClientRect()
      const last = stage.lastElementChild?.getBoundingClientRect()
      return {
        width: bounds.width,
        height: bounds.height,
        contentCenter: ((first?.top ?? 0) + (last?.bottom ?? 0)) / 2,
        stageCenter: bounds.top + bounds.height / 2,
      }
    })
    expect(Math.abs(emptyStage.height / emptyStage.width - 9 / 16)).toBeLessThanOrEqual(0.01)
    expect(Math.abs(emptyStage.contentCenter - emptyStage.stageCenter)).toBeLessThanOrEqual(8)
    const chatInput = page.locator("#chat-message")
    const sendMessage = page.locator(".room-chat-form").getByRole("button", { name: "发送" })
    const sendDanmaku = page
      .locator(".room-chat-form")
      .getByRole("button", { name: "弹幕", exact: true })
    const buttonLabels = await page
      .locator(".room-chat-form")
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.textContent?.trim()))
    expect(buttonLabels).toEqual(["弹幕", "发送"])
    await chatInput.fill("欢迎来到房间")
    await sendMessage.click()
    const sentChat = page.locator(".room-feed li").filter({ hasText: "欢迎来到房间" }).last()
    await expect(sentChat).toHaveText(/^[^\[]+：欢迎来到房间$/)
    await chatInput.fill("播放器弹幕准备就绪")
    await sendDanmaku.click()
    const sentDanmaku = page.locator(".room-feed li").filter({ hasText: "播放器弹幕准备就绪" })
    await expect(sentDanmaku.last()).toHaveText(/^\[弹幕\] [^：]+：播放器弹幕准备就绪$/)
    initialChatMessageCount = 3
    await chatInput.fill("播放器准备就绪")
    await sendMessage.click()
    await page.screenshot({
      path: test.info().outputPath("room-controls-empty-wide-layout.png"),
      animations: "disabled",
    })
    await resizeViewport(page, defaultViewport)
  }
  await addCurrentItem(page, roomId)

  const launcher = page.locator(".room-speed-dial-launcher")
  const actions = page.locator(".room-speed-dial-actions")
  await expect(page.locator(".room-side .baidu-panel")).toHaveCount(0)
  await expect(page.locator(".room-queue .room-source-section .baidu-panel")).toHaveCount(1)
  await expect(page.locator(".room-chat-rail")).toBeVisible()
  await expectRoomColumnLayout(page, info.project.name === "room-controls-phone")
  if (info.project.name === "room-controls-phone") {
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
    const itemTitle = await page.locator(".room-queue .room-row strong").first().boundingBox()
    const actionsBox = await page
      .locator(".room-queue .room-row .room-actions")
      .first()
      .boundingBox()
    expect(itemTitle?.width ?? 0).toBeGreaterThan(150)
    expect(actionsBox?.y ?? 0).toBeGreaterThanOrEqual(
      (itemTitle?.y ?? 0) + (itemTitle?.height ?? 0),
    )
  } else {
    const viewport = page.viewportSize()
    if (!viewport) throw new Error("Desktop viewport size is unavailable")
    await expectChatDockGeometry(page)
    await expectRoomWorkspaceGeometry(page)
    await expectRoomHeaderGeometry(page, 30.72)
    await resizeViewport(page, { width: 1199, height: viewport.height })
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
    await expectRoomHeaderGeometry(page, 40)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await resizeViewport(page, { width: 1200, height: viewport.height })
    await expectChatDockGeometry(page)
    await expectRoomHeaderGeometry(page, 28.8)
    await resizeViewport(page, { width: 1599, height: viewport.height })
    await expectRoomHeaderGeometry(page, 34)
    await resizeViewport(page, { width: 1600, height: viewport.height })
    await expectRoomHeaderGeometry(page, 40)
    await resizeViewport(page, viewport)
    await resizeViewport(page, { width: viewport.width, height: 640 })
    await expectDockPinnedWhileScrolling(page)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
    await resizeViewport(page, viewport)
    await resizeViewport(page, { width: 850, height: viewport.height })
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
    await expectRoomColumnLayout(page, true)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await resizeViewport(page, viewport)
    await resizeViewport(page, { width: 2048, height: 1235 })
    await expectChatDockGeometry(page)
    await expectRoomWorkspaceGeometry(page, 1320)
    await expectRoomHeaderGeometry(page, 40)
    await expectNoSpeedDialOverlap(page, ".room-speed-dial-launcher", ".room-current .player-stage")
    await page.screenshot({
      path: test.info().outputPath("room-controls-wide-layout.png"),
      animations: "disabled",
    })
    await resizeViewport(page, viewport)
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await expectNoSpeedDialOverlap(page, ".room-speed-dial-launcher")
  await expectNoSpeedDialOverlap(
    page,
    ".room-speed-dial-launcher",
    ".room-queue button, .room-queue input, .room-queue a",
  )
  await expectNoSpeedDialOverlap(page, ".room-speed-dial-launcher", ".room-current .player-stage")
  await launcher.click()
  await expect(actions).toHaveAttribute("aria-hidden", "false")
  await expect(actions).not.toHaveAttribute("inert")
  await expectNoSpeedDialOverlap(page, ".room-speed-dial-action")
  await expectActionsWithinViewport(page)
  await expect(page.locator(".room-speed-dial-backdrop")).toHaveCSS("pointer-events", "auto")
  await waitForSpeedDialState(page, true)
  await page.screenshot({
    path: test.info().outputPath("room-controls-open-layout.png"),
    animations: "disabled",
  })
  await launcher.click()
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
  await waitForSpeedDialState(page, false)
  if (info.project.name !== "room-controls-phone") {
    await fillChatHistoryUntilScrollable(page, initialChatMessageCount)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await page.screenshot({
    path: test.info().outputPath("room-controls-layout.png"),
    animations: "disabled",
  })

  await page.getByRole("button", { name: "剧场模式" }).click()
  await expect(page.locator(".room-page")).toHaveClass(/room-cinema/)
  if (info.project.name !== "room-controls-phone") {
    await expectChatDockGeometry(page, true)
    await expectNoSpeedDialOverlap(page, ".room-speed-dial-launcher", ".room-current .player-stage")
  } else {
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
  }
  await expect(launcher).toBeVisible()
  await expectNoSpeedDialOverlap(page, ".room-speed-dial-launcher")
  if (info.project.name === "room-controls-phone") {
    const composerGap = await page.evaluate(() => {
      const launcherRect = document
        .querySelector(".room-speed-dial-launcher")
        ?.getBoundingClientRect()
      const formRect = document.querySelector(".room-chat-form")?.getBoundingClientRect()
      if (!launcherRect || !formRect) throw new Error("Missing phone cinema composer geometry")
      return launcherRect.top - formRect.bottom
    })
    expect(composerGap).toBeGreaterThanOrEqual(8)
  }
  await launcher.click()
  await expectActionsWithinViewport(page)
  await expect(page.locator(".room-speed-dial-backdrop")).toHaveCSS("pointer-events", "auto")
  await waitForSpeedDialState(page, true)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await page.screenshot({
    path: test.info().outputPath("room-controls-cinema.png"),
    animations: "disabled",
  })

  await page.emulateMedia({ reducedMotion: "reduce" })
  const duration = await page
    .locator(".room-speed-dial-action")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration)
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001)
})
