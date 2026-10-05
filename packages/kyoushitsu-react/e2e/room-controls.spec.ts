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

async function expectLauncherWithinViewport(page: import("@playwright/test").Page) {
  const rect = await page.locator(".room-speed-dial-launcher").boundingBox()
  const viewport = page.viewportSize()
  if (!rect || !viewport) throw new Error("Missing launcher viewport geometry")
  expect(rect.x).toBeGreaterThanOrEqual(16)
  expect(rect.y).toBeGreaterThanOrEqual(16)
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width - 16)
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height - 16)
}

async function moveLauncherTo(
  page: import("@playwright/test").Page,
  x: number,
  y: number,
  touch = false,
) {
  const launcher = page.locator(".room-speed-dial-launcher")
  const start = await launcher.boundingBox()
  if (!start) throw new Error("Missing launcher")
  const startX = start.x + start.width / 2
  const startY = start.y + start.height / 2
  if (Math.hypot(x - startX, y - startY) < 8) {
    const viewport = page.viewportSize()
    if (!viewport) throw new Error("Missing drag viewport")
    await moveLauncherTo(page, x < viewport.width / 2 ? viewport.width - 42 : 42, 42, touch)
    await moveLauncherTo(page, x, y, touch)
    return
  }
  if (touch) {
    const session = await page.context().newCDPSession(page)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y: startY }],
    })
    for (let step = 1; step <= 12; step++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: startX + ((x - startX) * step) / 12, y: startY + ((y - startY) * step) / 12 },
        ],
      })
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await session.detach()
  } else {
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(x, y, { steps: 12 })
    await page.mouse.up()
  }
  await expect(launcher).toHaveAttribute("aria-expanded", "false")
}

async function expectLauncherCenter(page: import("@playwright/test").Page, x: number, y: number) {
  await expect
    .poll(async () => {
      const rect = await page.locator(".room-speed-dial-launcher").boundingBox()
      return (
        rect &&
        Math.abs(rect.x + rect.width / 2 - x) < 2 &&
        Math.abs(rect.y + rect.height / 2 - y) < 2
      )
    })
    .toBe(true)
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

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

async function expectRoomTextWithinViewport(page: import("@playwright/test").Page, width: number) {
  const textBounds = await page
    .locator(
      ".room-topbar h1, .room-row strong, .room-member-name, .room-current-empty h2, .room-waiting-hint, .room-source-section h3, .room-form label, .room-chat-form label, .danmaku-source-panel summary, .danmaku-display-settings label, .danmaku-display-settings legend",
    )
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const range = document.createRange()
        range.selectNodeContents(element)
        return [...range.getClientRects()].map((rect) => ({ left: rect.left, right: rect.right }))
      }),
    )
  for (const rect of textBounds) {
    expect(rect.left).toBeGreaterThanOrEqual(0)
    expect(rect.right).toBeLessThanOrEqual(width)
  }
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
  expect(geometry.viewportWidth - geometry.launcherRight).toBeGreaterThanOrEqual(16)
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
  expect(geometry.launcher.x).toBeGreaterThanOrEqual(16)
  expect(geometry.launcher.right).toBeLessThanOrEqual(geometry.viewport.width - 16)
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
  await dialog.evaluate((element) => {
    element.style.padding = "8px"
  })
  expect(
    await dialog.evaluate((element) => {
      const { left, top } = element.getBoundingClientRect()
      return document.elementFromPoint(left + 5, top + 90) === element
    }),
  ).toBe(true)
  await dialog.click({ position: { x: 5, y: 90 } })
  await expect(dialog).toBeVisible()
  await dialog.evaluate((element) => element.style.removeProperty("padding"))
  await page.screenshot({
    path: test.info().outputPath("room-controls-dialog.png"),
    animations: "disabled",
  })
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(launcher).toBeFocused()
  await launcher.click()
  await informationAction.click()
  await expect(dialog).toBeVisible()
  await page.mouse.click(2, 2)
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
    await expectRoomHeaderGeometry(page, 22)
    await resizeViewport(page, { width: 1199, height: viewport.height })
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
    await expectRoomHeaderGeometry(page, 22)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await resizeViewport(page, { width: 1200, height: viewport.height })
    await expectChatDockGeometry(page)
    await expectRoomHeaderGeometry(page, 22)
    await resizeViewport(page, { width: 1599, height: viewport.height })
    await expectRoomHeaderGeometry(page, 22)
    await resizeViewport(page, { width: 1600, height: viewport.height })
    await expectRoomHeaderGeometry(page, 22)
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
    await expectRoomHeaderGeometry(page, 22)
    await expectLauncherWithinViewport(page)
    await page.screenshot({
      path: test.info().outputPath("room-controls-wide-layout.png"),
      animations: "disabled",
    })
    await resizeViewport(page, viewport)
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await expectLauncherWithinViewport(page)
  await launcher.click()
  await expect(actions).toHaveAttribute("aria-hidden", "false")
  await expect(actions).not.toHaveAttribute("inert")
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
    await expectLauncherWithinViewport(page)
  } else {
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
  }
  await expect(launcher).toBeVisible()
  await expectLauncherWithinViewport(page)
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

test("room refinement keeps empty stage, queue-first sources and enlarged text readable", async ({
  page,
}, info) => {
  const roomId = await createRoom(page)
  const widths =
    info.project.name === "room-controls-phone"
      ? [320, 375, 812]
      : [768, 850, 851, 1199, 1200, 1280, 1440]
  for (const width of widths) {
    await resizeViewport(page, { width, height: width === 812 ? 375 : 900 })
    const stage = await page.locator(".room-current-empty").boundingBox()
    expect(stage).not.toBeNull()
    expect(Math.abs((stage?.height ?? 0) / (stage?.width ?? 1) - 9 / 16)).toBeLessThanOrEqual(0.01)
    await expectNoHorizontalOverflow(page)
    await expectLauncherWithinViewport(page)
  }
  await resizeViewport(page, info.project.use.viewport ?? { width: 1280, height: 900 })
  await page.screenshot({
    path: info.outputPath("refined-empty-room.png"),
    fullPage: true,
    animations: "disabled",
  })
  const longTitle = "長い番組タイトル".repeat(8) + "UnbrokenProgrammeName".repeat(4)
  for (const title of [longTitle, "Next programme"]) {
    const response = await page.context().request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
      headers: { origin: new URL(page.url()).origin },
      data: { title, type: "direct", url: mediaUrl },
    })
    expect(response.status()).toBe(200)
  }
  await expect(page.locator(".room-queue .room-row")).toHaveCount(2)
  const order = await page.locator(".room-queue").evaluate((queue) => {
    const list = queue.querySelector(".room-list")?.getBoundingClientRect()
    const source = queue.querySelector(".room-source-section")?.getBoundingClientRect()
    return { listBottom: list?.bottom ?? Number.POSITIVE_INFINITY, sourceTop: source?.top ?? 0 }
  })
  expect(order.listBottom).toBeLessThan(order.sourceTop)
  await page.locator(".danmaku-source-panel summary").click()
  await expect(page.getByLabel("弹幕设置", { exact: true })).toBeVisible()
  const settingsTargets = await page
    .locator(".danmaku-display-settings input, .danmaku-display-settings label")
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
  for (const height of settingsTargets) expect(height).toBeGreaterThanOrEqual(44)
  await expectLauncherWithinViewport(page)
  for (const width of [320, 375, 768, 812, 850, 851, 1199, 1200, 1280, 1440]) {
    await resizeViewport(page, { width, height: 900 })
    await expectRoomTextWithinViewport(page, width)
    await expectNoHorizontalOverflow(page)
    await expectLauncherWithinViewport(page)
  }
  await resizeViewport(page, info.project.use.viewport ?? { width: 1280, height: 900 })
  await page.screenshot({
    path: info.outputPath("refined-long-queue-settings.png"),
    fullPage: true,
    animations: "disabled",
  })
  await page.locator(".room-page").evaluate((room) => {
    const elements = [room, ...room.querySelectorAll("*")]
    const sizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    elements.forEach((element, index) => {
      if (element instanceof HTMLElement) element.style.fontSize = `${(sizes[index] ?? 16) * 2}px`
    })
  })
  await expectNoHorizontalOverflow(page)
  const viewportWidth = page.viewportSize()?.width ?? 0
  await expectRoomTextWithinViewport(page, viewportWidth)
  await expectLauncherWithinViewport(page)
  const controls = await page
    .locator(
      ".room-queue-panel button:visible, .room-queue-panel select:visible, .room-chat-form button, .room-chat-form input",
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height }
      }),
    )
  for (const control of controls) {
    expect(control.left).toBeGreaterThanOrEqual(0)
    expect(control.right).toBeLessThanOrEqual(viewportWidth)
    expect(control.width).toBeGreaterThanOrEqual(44)
    expect(control.height).toBeGreaterThanOrEqual(44)
  }
  await page.locator("#chat-message").fill("Enlarged text remains usable")
  await page.locator(".room-chat-form").getByRole("button", { name: "发送", exact: true }).click()
  await expect(page.locator(".room-feed")).toContainText("Enlarged text remains usable")
  await page.screenshot({
    path: info.outputPath("refined-room-text-200-percent.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("@layout-parity responsive player, queue and composer remain reachable", async ({
  page,
}, info) => {
  const roomId = await createRoom(page)
  await addCurrentItem(page, roomId)
  const viewport = page.viewportSize()
  if (!viewport) throw new Error("Room viewport is unavailable")
  const launcher = page.locator(".room-speed-dial-launcher")
  const chat = page.locator(".room-chat-form")
  const assertReachable = async () => {
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await expect(launcher).toBeVisible()
    await chat.locator("#chat-message").fill("Responsive composer fixture")
    await chat.getByRole("button", { name: "发送", exact: true }).click()
    await expect(
      page.locator(".room-feed li").filter({ hasText: "Responsive composer fixture" }).last(),
    ).toBeVisible()
    await expectLauncherWithinViewport(page)
    const dimensions = await page
      .locator(".room-queue button:visible, .room-chat-form button:visible")
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height))
    expect(dimensions.every((height) => height >= 43.5)).toBe(true)
  }
  await assertReachable()
  if (viewport.width >= 1200 && viewport.height >= 900) await expectChatDockGeometry(page)
  if (viewport.width < 1200)
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
  await page.screenshot({
    path: info.outputPath("responsive-room-normal.png"),
    animations: "disabled",
    fullPage: true,
  })
  await launcher.click()
  await expectActionsWithinViewport(page)
  await page
    .locator(".room-speed-dial-actions")
    .getByRole("button", { name: "房间控制", exact: true })
    .click()
  const controls = page.getByRole("dialog", { name: "房间控制" })
  await expect(controls).toBeVisible()
  const bounds = await controls.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0)
  expect(bounds?.y ?? -1).toBeGreaterThanOrEqual(0)
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width)
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport.height)
  await controls.locator(".room-controls-dialog-header button").click()
  await expect(launcher).toBeFocused()
  await page.getByRole("button", { name: "剧场模式" }).click()
  await expect(page.locator(".room-page")).toHaveClass(/room-cinema/)
  await assertReachable()
  if (viewport.width < 851)
    await expect(page.locator(".room-chat-rail")).toHaveCSS("position", "static")
  await page.screenshot({
    path: info.outputPath("responsive-room-cinema.png"),
    animations: "disabled",
    fullPage: true,
  })
})

test("source switching retains usable state", async ({ page }, info) => {
  const roomId = await createRoom(page)
  const picker = page.getByRole("combobox", { name: "选择来源" })
  await expect(picker).toHaveValue("link")
  await expect(page.locator(".baidu-panel")).toBeHidden()
  const url = page.getByLabel("视频链接", { exact: true })
  await url.fill("https://media.example.test/draft.mp4")
  await page.getByLabel("房间显示标题（可选）").fill("Preserved draft")
  await page.route("**/enmoku/preview", (route) =>
    route.fulfill({ json: { state: "ready", title: "Preserved draft", type: "direct" } }),
  )
  await page.getByRole("button", { name: "解析链接" }).click()
  await expect(page.getByRole("status")).toContainText("Preserved draft")
  if (info.project.name === "room-controls-phone") {
    await picker.tap()
    await picker.press("ArrowDown")
    await picker.press("Enter")
  } else {
    await picker.focus()
    await picker.press("ArrowDown")
    await picker.press("Enter")
  }
  await expect(picker).toHaveValue("baidu")
  await expect(url).toBeHidden()
  await expect(page.getByRole("button", { name: "管理连接" })).toBeVisible()
  await page.getByRole("button", { name: "管理连接" }).click()
  await expect(page.getByRole("dialog", { name: "连接百度网盘" })).toBeVisible()
  await page
    .getByRole("dialog", { name: "连接百度网盘" })
    .getByRole("button", { name: "关闭" })
    .click()
  await picker.selectOption("link")
  await expect(url).toHaveValue("https://media.example.test/draft.mp4")
  await expect(page.getByLabel("房间显示标题（可选）")).toHaveValue("Preserved draft")
  await expect(page.getByRole("button", { name: "加入队列" })).toBeVisible()
  await expect(page.locator(".baidu-panel")).toBeHidden()
  const pickerBox = await picker.boundingBox()
  expect(pickerBox?.height).toBeGreaterThanOrEqual(44)
  await picker.focus()
  await picker.press("Tab")
  await expect(url).toBeFocused()

  await addCurrentItem(page, roomId)
  await page.screenshot({
    path: info.outputPath("followup-source-picker.png"),
    fullPage: true,
    animations: "disabled",
  })
})

test("free launcher placement preserves attendance and composer targets", async ({
  page,
}, info) => {
  const roomId = await createRoom(page)
  const launcher = page.locator(".room-speed-dial-launcher")
  const touch = info.project.name === "room-controls-phone"
  const initialViewport = page.viewportSize()
  if (!initialViewport) throw new Error("Missing initial viewport")
  await expectLauncherCenter(
    page,
    initialViewport.width - 42,
    42 + (initialViewport.height - 84) * 0.65,
  )
  await page.screenshot({ path: info.outputPath("free-fresh-default.png"), animations: "disabled" })
  await page.locator("#chat-message").fill("Fresh composer is usable")
  await page.getByRole("button", { name: "发送", exact: true }).click()
  await expect(page.locator(".room-feed")).toContainText("Fresh composer is usable")
  await addCurrentItem(page, roomId)

  for (const viewport of touch
    ? [
        { width: 375, height: 812 },
        { width: 1280, height: 900 },
      ]
    : [
        { width: 2048, height: 1196 },
        { width: 1280, height: 900 },
      ]) {
    await resizeViewport(page, viewport)
    for (const cinema of [false, true]) {
      if (cinema) await page.getByRole("button", { name: "剧场模式" }).click()
      for (const selector of [
        ".room-dock-attendance h2",
        "#chat-message",
        ".room-chat-form button:last-child",
      ]) {
        const target = page.locator(selector)
        await target.scrollIntoViewIfNeeded()
        const box = await target.boundingBox()
        if (!box) throw new Error(`Missing placement target ${selector}`)
        const x = Math.max(42, Math.min(viewport.width - 42, box.x + box.width / 2))
        const y = Math.max(42, Math.min(viewport.height - 42, box.y + box.height / 2))
        await moveLauncherTo(page, x, y, touch)
        await expectLauncherCenter(page, x, y)
        await expect(launcher).toHaveAttribute("data-dragging", "false")
        await page.evaluate(() => {
          scrollBy(0, 120)
          const feed = document.querySelector(".room-feed")
          if (feed) feed.scrollTop = feed.scrollHeight
        })
        await expectLauncherCenter(page, x, y)
        await page.locator(".danmaku-source-panel summary").click()
        await expectLauncherCenter(page, x, y)
        await page.locator(".danmaku-source-panel summary").click()
        await expectLauncherCenter(page, x, y)
        await page.screenshot({
          path: info.outputPath(
            `free-${viewport.width}-${cinema ? "cinema" : "normal"}-${selector.includes("h2") ? "attendance" : selector.includes("chat-message") ? "input" : "send"}.png`,
          ),
          animations: "disabled",
        })
        await launcher.focus()
        await launcher.press("ArrowLeft")
        await expectLauncherCenter(page, x - 16, y)
        await launcher.press("ArrowRight")
        await expectLauncherCenter(page, x, y)
        await launcher.press("Enter")
        await waitForSpeedDialState(page, true)
        await expectActionsWithinViewport(page)
        await launcher.press("Escape")
        await expect(launcher).toBeFocused()
        await expect(page.locator(".room-speed-dial-actions")).toHaveAttribute("inert")
      }
      await moveLauncherTo(page, 42, 42, touch)
      await page.locator("#chat-message").fill(`Moved away ${viewport.width} ${cinema}`)
      await page.getByRole("button", { name: "发送", exact: true }).click()
      await expect(page.locator(".room-feed")).toContainText(
        `Moved away ${viewport.width} ${cinema}`,
      )
      if (cinema) await page.getByRole("button", { name: "剧场模式" }).click()
    }
  }
  await resizeViewport(page, { width: 1280, height: 900 })
  await page.locator("#chat-message").scrollIntoViewIfNeeded()
  const input = await page.locator("#chat-message").boundingBox()
  if (!input) throw new Error("Missing composer input")
  const x = input.x + input.width / 2
  const y = input.y + input.height / 2
  await moveLauncherTo(page, x, y, touch)
  const response = await page.context().request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
    headers: { origin: new URL(page.url()).origin },
    data: { title: "Position survives queue update", type: "direct", url: mediaUrl },
  })
  expect(response.status()).toBe(200)
  await expect(page.locator(".room-queue")).toContainText("Position survives queue update")
  await expectLauncherCenter(page, x, y)
  const stored = await page.evaluate(() =>
    localStorage.getItem("houkago.kyoushitsu.room-floating-position.v1"),
  )
  await page.reload()
  await expect(page.locator("#chat-message")).toBeVisible()
  await expectLauncherCenter(page, x, y)
  await resizeViewport(page, { width: 375, height: 812 })
  await expectLauncherWithinViewport(page)
  expect(
    await page.evaluate(() => localStorage.getItem("houkago.kyoushitsu.room-floating-position.v1")),
  ).toBe(stored)
  await launcher.press("Enter")
  await waitForSpeedDialState(page, true)
  await expectActionsWithinViewport(page)
  await launcher.press("Escape")
  await page.locator(".room-speed-dial-layer").evaluate((layer) => {
    layer.style.padding = "60px 40px 50px 30px"
  })
  const preference = JSON.parse(stored ?? "null") as { x: number; y: number }
  await expectLauncherCenter(page, 56 + 253 * preference.x, 86 + 650 * preference.y)
  await moveLauncherTo(page, 0, 0, touch)
  await expectLauncherCenter(page, 56, 86)
  await moveLauncherTo(page, 374, 811, touch)
  await expectLauncherCenter(page, 309, 736)
  await launcher.press("Enter")
  await waitForSpeedDialState(page, true)
  const menu = await page.locator(".room-speed-dial-actions").boundingBox()
  if (!menu) throw new Error("Missing safe-area menu")
  expect(menu.x).toBeGreaterThanOrEqual(30)
  expect(menu.y).toBeGreaterThanOrEqual(60)
  expect(menu.x + menu.width).toBeLessThanOrEqual(335)
  expect(menu.y + menu.height).toBeLessThanOrEqual(762)
  await launcher.press("Escape")
})
