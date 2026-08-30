import { type Page, expect, test } from "@playwright/test"

async function createRoom(page: Page, accountSuffix: string): Promise<void> {
  await page.goto("/")
  const username = `pw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${accountSuffix}`
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
          url: "https://media.example.test/room-shell.mp4",
        }),
      })
      return { body: await response.json(), status: response.status }
    },
    { sourceTitle: title },
  )
  expect(result.status).toBe(200)
}

async function installReadyAdapter(page: Page): Promise<void> {
  await page.route("**/baidu/adaptor/pairing", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      deviceId: "fixture-device-id",
      localPaired: true,
    })
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ state: "paired" }),
    })
  })
  await page.addInitScript(() => {
    window.addEventListener("message", (event) => {
      const request = event.data
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        typeof request !== "object" ||
        request === null ||
        request.source !== "houkago-page" ||
        request.type !== "HELLO"
      ) {
        return
      }
      window.postMessage(
        {
          source: "houkago-adapter",
          protocolVersion: 1,
          nonce: request.nonce,
          type: "HELLO",
          ok: true,
          data: {
            protocolVersion: 1,
            clientVersion: "fixture-1",
            browser: "firefox",
            deviceId: "fixture-device-id",
            capabilities: [
              { id: "baidu.account.user-held", schemaVersion: 1, ready: true },
              { id: "baidu.files.read", schemaVersion: 1, ready: true },
              { id: "baidu.media.request-headers", schemaVersion: 1, ready: true },
            ],
          },
        },
        window.location.origin,
      )
    })
  })
}

async function installRevocableAdapter(page: Page, pairingLocalStates: boolean[]): Promise<void> {
  await page.route("**/baidu/adaptor/pairing", async (route) => {
    const request = route.request().postDataJSON() as { localPaired: boolean }
    pairingLocalStates.push(request.localPaired)
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        request.localPaired
          ? { state: "paired" }
          : {
              state: "pairing-required",
              pairingCode: "fixture-pairing-code-1234",
              expiresAt: Date.now() + 60_000,
            },
      ),
    })
  })
  await page.addInitScript(() => {
    let localPaired = true
    window.addEventListener("message", (event) => {
      const request = event.data
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        typeof request !== "object" ||
        request === null ||
        request.source !== "houkago-page"
      ) {
        return
      }
      const envelope = {
        source: "houkago-adapter",
        protocolVersion: 1,
        nonce: request.nonce,
      }
      if (request.type === "HELLO") {
        const capability = (id: string) =>
          localPaired
            ? { id, schemaVersion: 1, ready: true }
            : { id, schemaVersion: 1, ready: false, reason: "not-paired" }
        window.postMessage(
          {
            ...envelope,
            type: "HELLO",
            ok: true,
            data: {
              protocolVersion: 1,
              clientVersion: "fixture-1",
              browser: "firefox",
              deviceId: "fixture-device-id",
              capabilities: [
                capability("baidu.account.user-held"),
                capability("baidu.files.read"),
                capability("baidu.media.request-headers"),
              ],
            },
          },
          window.location.origin,
        )
        return
      }
      if (request.type === "BAIDU_REVOKE") localPaired = false
      if (request.type === "PAIR") localPaired = true
      if (request.type === "BAIDU_REVOKE" || request.type === "PAIR") {
        window.postMessage({ ...envelope, type: "RESULT", ok: true }, window.location.origin)
      }
    })
  })
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

test("desktop queue presents current, pending, disabled, and action hierarchy states", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-tall", "desktop queue evidence")
  await createRoom(page, "queue_hierarchy_desktop")
  const titles = ["第一部 · 直接来源", "第二部 · 等待操作", "第三部 · 最后一项"]
  for (const title of titles) await addRoomSource(page, title)
  await page.reload()

  const rows = page.locator(".bangumi-row")
  await expect(rows).toHaveCount(3)
  await expect(page.locator(".bangumi-count")).toHaveText("3")
  await expect(rows.first().getByRole("button", { name: "上移" })).toBeDisabled()
  await expect(rows.last().getByRole("button", { name: "下移" })).toBeDisabled()

  const targetRow = page.locator(".bangumi-row", { hasText: titles[1] })
  const play = targetRow.getByRole("button", { name: "播放", exact: true })
  await expect(play).toHaveClass(/primary/)
  await expect(targetRow.getByRole("button", { name: "取消播放" })).toHaveClass(/secondary/)
  await expect(targetRow.getByRole("button", { name: "删除" })).toHaveClass(/destructive/)
  await expect(targetRow.getByRole("button", { name: "上移" })).toHaveClass(/quiet/)
  await play.focus()
  await expect(play).toHaveCSS("outline-width", "3px")
  await play.click()
  await expect(targetRow).toHaveAttribute("aria-current", "true")
  await expect(targetRow.getByText("上映中", { exact: true })).toBeVisible()

  const movePattern = "**/bangumi/*/move"
  let releaseMove: (() => void) | undefined
  await page.route(movePattern, async (route) => {
    await new Promise<void>((resolve) => {
      releaseMove = resolve
    })
    await route.continue()
  })
  await targetRow.getByRole("button", { name: "上移" }).click()
  await expect.poll(() => Boolean(releaseMove)).toBe(true)
  await expect(targetRow).toHaveAttribute("aria-busy", "true")
  await expect(targetRow.getByText("处理中…", { exact: true })).toBeVisible()
  const moveButtons = page.getByRole("button", { name: /^(上移|下移)$/ })
  for (let index = 0; index < (await moveButtons.count()); index += 1) {
    await expect(moveButtons.nth(index)).toBeDisabled()
  }
  releaseMove?.()
  await expect(page.locator(".bangumi-feedback[role='status']")).toHaveText("队列已更新。")

  await page.unroute(movePattern)
  await page.route(movePattern, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture failure" }),
    }),
  )
  const movedRow = page.locator(".bangumi-row", { hasText: titles[1] })
  await movedRow.getByRole("button", { name: "下移" }).click()
  await expect(page.locator(".bangumi-content > .bangumi-feedback[role='alert']")).toHaveText(
    "队列操作失败，请稍后重试。",
  )

  const geometry = await page.locator(".bangumi").evaluate((element) => ({
    buttons: Array.from(element.querySelectorAll<HTMLButtonElement>(".bangumi-action")).map(
      (button) => {
        const box = button.getBoundingClientRect()
        return {
          height: box.height,
          left: box.left,
          minHeight: getComputedStyle(button).minHeight,
          right: box.right,
        }
      },
    ),
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
  expect(geometry.buttons.every((button) => button.minHeight === "44px")).toBe(true)
  expect(geometry.buttons.every((button) => button.height >= 43.5)).toBe(true)
  expect(
    geometry.buttons.every((button) => button.left >= 0 && button.right <= geometry.viewportWidth),
  ).toBe(true)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
  await page.screenshot({
    path: testInfo.outputPath("queue-composer-desktop.png"),
    fullPage: false,
  })
})

test("the desktop room shell keeps the media stage primary and surfaces bounded", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-tall", "desktop shell evidence")
  await createRoom(page, "room_shell_desktop")

  const stage = page.locator(".stage")
  const playerWrap = page.locator(".player-wrap, .placeholder").first()
  const workbench = page.locator(".room-workbench")
  const chat = page.locator(".bushitsu > .chat-panel")
  await expect(playerWrap).toBeVisible()
  await expect(workbench).toBeVisible()
  await expect(chat).toBeVisible()
  await expect(stage).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expect(playerWrap).toHaveCSS("border-radius", "14px")
  await expect(workbench).toHaveCSS("gap", "12px")

  const layout = await page.evaluate(() => {
    const selectors = [
      ".stage",
      ".player-wrap, .placeholder",
      ".room-workbench",
      ".bushitsu > .chat-panel",
    ]
    const boxes = Object.fromEntries(
      selectors.map((selector) => {
        const element = document.querySelector(selector)
        const box = element?.getBoundingClientRect()
        return [
          selector,
          box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null,
        ]
      }),
    )
    return {
      boxes,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
  const playerBox = layout.boxes[".player-wrap, .placeholder"]
  const stageBox = layout.boxes[".stage"]
  const workbenchBox = layout.boxes[".room-workbench"]
  const chatBox = layout.boxes[".bushitsu > .chat-panel"]
  expect(playerBox).not.toBeNull()
  expect(stageBox).not.toBeNull()
  expect(workbenchBox).not.toBeNull()
  expect(chatBox).not.toBeNull()
  expect(playerBox?.right).toBeLessThanOrEqual(workbenchBox?.right ?? 0)
  expect(workbenchBox?.right).toBeLessThanOrEqual(stageBox?.right ?? 0)
  expect(chatBox?.left).toBeGreaterThanOrEqual(stageBox?.right ?? 0)
  expect(chatBox?.bottom).toBeLessThanOrEqual(layout.viewport.height)
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport.width)

  await page.screenshot({ path: testInfo.outputPath("room-shell-desktop.png"), fullPage: false })
})

test("cinema mode keeps the player and desktop chat rail visible", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-tall", "cinema mode coverage")
  await createRoom(page, "room_shell_cinema")
  const title = `cinema_${Date.now()}`
  await addRoomSource(page, title)
  await page.reload()

  const row = page.locator(".bangumi-row", { hasText: title })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "播放", exact: true }).click()
  await expect(page.locator(".enmoku-player")).toBeVisible()

  const cinemaControl = page.locator(".art-control-houkagoCinema")
  await expect(cinemaControl).toBeVisible()
  await cinemaControl.click()
  await expect(page.locator(".bushitsu")).toHaveClass(/cinema-mode/)
  await expect(page.locator(".media-toolbar")).toBeHidden()
  await expect(page.locator(".room-workbench")).toBeHidden()
  await expect(page.locator(".timeline-danmaku-source")).toBeHidden()
  await expect(page.locator(".bushitsu > .chat-panel")).toBeVisible()
  await expect(page.locator(".mobile-chat-launcher")).toBeHidden()

  const cinemaLayout = await page.evaluate(() => {
    const stage = document.querySelector(".stage")?.getBoundingClientRect()
    const player = document.querySelector(".player-wrap")?.getBoundingClientRect()
    return {
      stage,
      player,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
  expect(cinemaLayout.player?.width).toBeGreaterThan(0)
  expect(cinemaLayout.player?.width).toBeLessThanOrEqual(cinemaLayout.stage?.width ?? 0)
  expect(cinemaLayout.scrollWidth).toBeLessThanOrEqual(cinemaLayout.viewportWidth)
  await page.screenshot({ path: testInfo.outputPath("room-shell-cinema.png"), fullPage: false })

  await cinemaControl.click()
  await expect(page.locator(".room-workbench")).toBeVisible()
  await expect(page.locator(".bushitsu > .chat-panel")).toBeVisible()
})

test("Baidu connection uses an unselected, keyboard-operable retention step", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-tall", "single desktop coverage")
  await installReadyAdapter(page)
  await page.route("**/baidu/status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        serverSavedEnabled: true,
        connected: false,
        adaptorOnline: true,
      }),
    }),
  )
  await createRoom(page, "baidu_retention")

  const launcher = page.getByRole("button", { name: "从百度网盘选择" })
  await launcher.click()
  const dialog = page.getByRole("dialog", { name: "连接百度网盘" })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "继续" }).click()
  await expect(dialog.getByText("凭据保存方式", { exact: true })).toBeVisible()
  await expect(dialog.getByRole("radio", { name: /服务端加密保存/ })).not.toBeChecked()
  await expect(dialog.getByRole("radio", { name: /仅由本机适配器保存/ })).not.toBeChecked()
  await expect(dialog.getByText("推荐", { exact: true })).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await expect(launcher).toBeFocused()
})

test("Baidu browser exposes read-only file states and selection", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-tall", "single desktop coverage")
  await installReadyAdapter(page)
  await page.route("**/baidu/status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        serverSavedEnabled: true,
        connected: true,
        retentionMode: "server-saved",
        accountName: "fixture-account",
        adaptorOnline: true,
      }),
    }),
  )
  await page.route("**/baidu/files/list", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        path: "/",
        entries: [
          {
            id: "folder-1",
            name: "动画",
            path: "/动画",
            isDirectory: true,
            mediaType: "unsupported",
          },
          {
            id: "video-1",
            name: "movie.mp4",
            path: "/movie.mp4",
            isDirectory: false,
            size: 1572864,
            mediaType: "video",
          },
          {
            id: "text-1",
            name: "notes.txt",
            path: "/notes.txt",
            isDirectory: false,
            mediaType: "unsupported",
          },
        ],
      }),
    }),
  )
  await createRoom(page, "baidu_browser")

  await page.getByRole("button", { name: "从百度网盘选择" }).click()
  const dialog = page.getByRole("dialog", { name: "选择网盘视频" })
  await expect(dialog).toBeVisible()
  const add = dialog.getByRole("button", { name: "加入所选视频" })
  await expect(add).toBeDisabled()
  await expect(dialog.getByRole("button", { name: /notes\.txt/ })).toBeDisabled()
  await dialog.getByRole("button", { name: /movie\.mp4/ }).click()
  await expect(add).toBeEnabled()
  await expect(dialog.getByText("已选择: movie.mp4")).toBeVisible()

  const manage = dialog.getByRole("button", { name: "管理连接", exact: true })
  await expect(manage).toHaveCSS("min-height", "44px")
  await manage.click()
  const connectionDialog = page.getByRole("dialog", { name: "连接百度网盘" })
  await expect(dialog).toBeHidden()
  await expect(connectionDialog).toBeVisible()
  await expect(connectionDialog).toContainText("fixture-account")
  await expect(page.locator("dialog[open]")).toHaveCount(1)
})

test("Baidu revoke confirms consequences, preserves failure state, and re-pairs after success", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-tall", "single desktop coverage")
  const pairingLocalStates: boolean[] = []
  await installRevocableAdapter(page, pairingLocalStates)
  let connected = true
  let failRevoke = true
  let revokeAttempts = 0
  await page.route("**/baidu/status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        serverSavedEnabled: true,
        connected,
        ...(connected ? { retentionMode: "server-saved", accountName: "fixture-account" } : {}),
        adaptorOnline: connected,
      }),
    }),
  )
  await page.route("**/baidu/connection", async (route) => {
    revokeAttempts += 1
    if (failRevoke) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "INTERNAL", message: "fixture failure" } }),
      })
      return
    }
    connected = false
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) })
  })
  await createRoom(page, "baidu_revoke")

  await page.getByRole("button", { name: "管理百度连接" }).click()
  const dialog = page.getByRole("dialog", { name: "连接百度网盘" })
  await dialog.getByRole("button", { name: "撤销百度连接" }).click()
  await expect(dialog.getByRole("heading", { name: "确认撤销百度连接？" })).toBeVisible()
  await expect(dialog).toContainText("已有的百度网盘队列片源会变为不可用，但不会被自动删除")
  await expect(dialog).toContainText("不会在百度账户侧撤销")
  await expect(dialog.getByRole("button", { name: "取消" })).toBeFocused()

  await page.keyboard.press("Escape")
  expect(revokeAttempts).toBe(0)
  const revoke = dialog.getByRole("button", { name: "撤销百度连接" })
  await expect(revoke).toBeFocused()
  await revoke.click()
  await dialog.getByRole("button", { name: "确认撤销连接" }).click()
  await expect(dialog.getByRole("alert").first()).toHaveText(
    "百度连接撤销失败，当前连接仍然有效，请稍后重试。",
  )
  await expect(dialog).toContainText("fixture-account")
  await expect(dialog.getByRole("heading", { name: "确认撤销百度连接？" })).toBeVisible()

  failRevoke = false
  await dialog.getByRole("button", { name: "确认撤销连接" }).click()
  await expect(dialog.getByRole("radio", { name: /服务端加密保存/ })).toBeVisible()
  await expect(dialog.getByRole("radio", { name: /仅由本机适配器保存/ })).toBeVisible()
  await expect(dialog.getByRole("radio", { name: /服务端加密保存/ })).not.toBeChecked()
  expect(pairingLocalStates).toContain(false)
  await dialog.getByRole("radio", { name: /仅由本机适配器保存/ }).check()
  await dialog.getByRole("button", { name: "继续" }).click()
  await expect(dialog.getByRole("button", { name: "打开百度授权" })).toBeEnabled()
})
