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
