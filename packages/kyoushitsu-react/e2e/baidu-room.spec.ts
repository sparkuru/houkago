import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { type Page, expect, test } from "@playwright/test"

const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? "http://127.0.0.1:3000"
const frontendUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173"
const video = readFile(fileURLToPath(new URL("./fixtures/media/clip.mp4", import.meta.url)))

type FixtureState = {
  connected: boolean
  revokeFails: boolean
  grantCalls: number
  grantPolls: number
  sourceBodies: unknown[]
  pairingBodies: unknown[]
  oauthBodies: unknown[]
}

function initialFixture(): FixtureState {
  return {
    connected: false,
    revokeFails: false,
    grantCalls: 0,
    grantPolls: 0,
    sourceBodies: [],
    pairingBodies: [],
    oauthBodies: [],
  }
}

async function installAdapter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fixtureWindow = window as typeof window & {
      __baiduFixture?: { paired: boolean; requests: Array<Record<string, unknown>> }
    }
    const fixture = { paired: false, requests: [] as Array<Record<string, unknown>> }
    fixtureWindow.__baiduFixture = fixture
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== location.origin) return
      const request = event.data as Record<string, unknown>
      if (request?.source !== "houkago-page" || typeof request.nonce !== "string") return
      fixture.requests.push(request)
      const envelope = {
        source: "houkago-adapter",
        protocolVersion: 1,
        nonce: request.nonce,
        ok: true,
      }
      let response: Record<string, unknown>
      if (request.type === "HELLO") {
        response = {
          ...envelope,
          type: "HELLO",
          data: {
            protocolVersion: 1,
            clientVersion: "1.0.0",
            browser: "chromium",
            deviceId: "fixture-device-123456",
            capabilities: [
              "baidu.account.user-held",
              "baidu.files.read",
              "baidu.media.request-headers",
            ].map((id) =>
              fixture.paired
                ? { id, schemaVersion: 1, ready: true }
                : { id, schemaVersion: 1, ready: false, reason: "not-paired" },
            ),
          },
        }
      } else if (request.type === "BAIDU_LIST") {
        response = {
          ...envelope,
          type: "BAIDU_LIST_RESULT",
          data:
            request.path === "/"
              ? {
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
                      id: "readme-1",
                      name: "说明.txt",
                      path: "/说明.txt",
                      isDirectory: false,
                      mediaType: "unsupported",
                    },
                  ],
                }
              : {
                  path: "/动画",
                  entries: [
                    {
                      id: "video-1",
                      name: "测试影片.mp4",
                      path: "/动画/测试影片.mp4",
                      isDirectory: false,
                      mediaType: "video",
                      size: 4096,
                    },
                  ],
                },
        }
      } else {
        if (request.type === "PAIR") fixture.paired = true
        if (request.type === "BAIDU_REVOKE") fixture.paired = false
        response = { ...envelope, type: "RESULT" }
      }
      queueMicrotask(() => window.postMessage(response, location.origin))
    })
  })
}

async function installProviderRoutes(page: Page, state: FixtureState): Promise<void> {
  await page.route("**/baidu/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const headers = {
      "access-control-allow-origin": frontendUrl,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
    }
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers })
    if (path === "/baidu/status")
      return route.fulfill({
        headers,
        json: {
          enabled: true,
          serverSavedEnabled: true,
          connected: state.connected,
          adaptorOnline: state.connected,
          ...(state.connected
            ? { retentionMode: "user-held", accountName: "Fixture account" }
            : {}),
        },
      })
    if (path === "/baidu/adaptor/pairing") {
      const body: { localPaired: boolean } = request.postDataJSON()
      state.pairingBodies.push(body)
      return route.fulfill({
        headers,
        json: body.localPaired
          ? { state: "paired" }
          : {
              state: "pairing-required",
              pairingCode: "fixture-code-123456",
              expiresAt: Date.now() + 60_000,
            },
      })
    }
    if (path === "/baidu/oauth/start") {
      state.oauthBodies.push(request.postDataJSON())
      return route.fulfill({
        headers,
        json: {
          authorizationUrl: "https://oauth.example.test/authorize",
          expiresAt: Date.now() + 60_000,
        },
      })
    }
    if (path === "/baidu/connection" && request.method() === "DELETE") {
      if (state.revokeFails)
        return route.fulfill({
          status: 503,
          headers,
          json: { error: { code: "UPSTREAM", message: "Revoke failed" } },
        })
      state.connected = false
      return route.fulfill({ headers, json: { ok: true } })
    }
    if (path === "/baidu/sources" && request.method() === "POST") {
      const body: { bushitsuId: string } = request.postDataJSON()
      state.sourceBodies.push(body)
      return route.fulfill({
        headers,
        json: {
          id: "baidu-item-1",
          bushitsuId: body.bushitsuId,
          title: "测试影片.mp4",
          type: "direct",
          url: `${housouUrl}/baidu/media/fixture-grant`,
          addedBy: "fixture-account",
          provider: { kind: "baidu", sourceId: "source-1", fileName: "测试影片.mp4" },
        },
      })
    }
    if (path === "/baidu/sources/source-1/availability")
      return route.fulfill({
        headers,
        json: {
          sourceId: "source-1",
          mode: "user-held",
          ownerOnline: true,
          playable: true,
        },
      })
    if (path === "/baidu/sources/source-1/grants") {
      state.grantCalls += 1
      return route.fulfill({
        headers,
        json: {
          state: "pending",
          requestId: "fixture-request-123456",
          expiresAt: Date.now() + 60_000,
        },
      })
    }
    if (path === "/baidu/grants/fixture-request-123456") {
      state.grantPolls += 1
      return route.fulfill({
        headers,
        json:
          state.grantPolls < 2
            ? {
                state: "pending",
                requestId: "fixture-request-123456",
                expiresAt: Date.now() + 60_000,
              }
            : {
                state: "ready",
                grantUrl: `${housouUrl}/baidu/media/fixture-grant`,
                expiresAt: Date.now() + 60_000,
              },
      })
    }
    if (path === "/baidu/media/fixture-grant")
      return route.fulfill({
        status: 200,
        headers: { ...headers, "content-type": "video/mp4", "accept-ranges": "bytes" },
        body: await video,
      })
    return route.continue()
  })
  await page
    .context()
    .route("https://oauth.example.test/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Authorized</p>" }),
    )
}

async function createRoom(page: Page): Promise<string> {
  const username = `m5_baidu_${randomUUID().replaceAll("-", "").slice(0, 18)}`
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill("M5-fixture-password")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await page.getByLabel("部室名").fill(`M5 Baidu ${username}`)
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page.getByLabel("视频链接")).toBeVisible()
  const roomId = new URL(page.url()).pathname.split("/").at(-1)
  if (!roomId) throw new Error("Missing room ID")
  return roomId
}

test("desktop pairing, retention, OAuth, file permit and revoke states", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name === "baidu-phone")
  const state = initialFixture()
  await installAdapter(page)
  await installProviderRoutes(page, state)
  const roomId = await createRoom(page)
  await expect.poll(() => state.pairingBodies.length).toBeGreaterThan(0)
  await page.getByRole("combobox", { name: "选择来源" }).selectOption("baidu")
  const panel = page.locator(".baidu-panel")
  const manage = panel.getByRole("button", { name: "管理连接" })
  await expect(manage).toBeVisible()
  await manage.click()
  const connection = page.getByRole("dialog", { name: "连接百度网盘" })
  const userHeld = connection.getByRole("radio", { name: /仅由本机适配器保存/ })
  if (!(await userHeld.isVisible())) await connection.getByRole("button", { name: "继续" }).click()
  await expect(connection.locator("input[type=radio]:checked")).toHaveCount(0)
  await userHeld.check()
  await connection.getByRole("button", { name: "继续" }).click()
  const popupPromise = page.waitForEvent("popup")
  await connection.getByRole("button", { name: "打开百度授权" }).click()
  const popup = await popupPromise
  await expect.poll(() => state.oauthBodies.length).toBe(1)
  expect(state.oauthBodies[0]).toMatchObject({
    retentionMode: "user-held",
    deviceId: "fixture-device-123456",
  })
  state.connected = true
  await popup.close()
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect(connection.getByText("Fixture account")).toBeVisible()
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { __baiduFixture?: { requests: Array<{ type: string }> } }
      ).__baiduFixture?.requests.some((request) => request.type === "OAUTH_HANDOFF"),
    ),
  ).toBe(true)
  await connection.getByRole("button", { name: "关闭" }).click()

  await panel.getByRole("button", { name: "选择网盘视频" }).click()
  const files = page.getByRole("dialog", { name: "选择网盘视频" })
  await files.getByRole("button", { name: /动画/ }).last().click()
  await expect(
    files
      .getByRole("navigation", { name: "当前网盘目录" })
      .getByRole("button", { name: "动画", exact: true }),
  ).toBeDisabled()
  await files.getByRole("button", { name: "关闭" }).click()
  await page.getByRole("combobox", { name: "选择来源" }).selectOption("link")
  await expect(panel).toBeHidden()
  await page.getByRole("combobox", { name: "选择来源" }).selectOption("baidu")
  await panel.getByRole("button", { name: "选择网盘视频" }).click()
  await expect(
    files
      .getByRole("navigation", { name: "当前网盘目录" })
      .getByRole("button", { name: "动画", exact: true }),
  ).toBeDisabled()
  await files.getByRole("button", { name: /测试影片\.mp4/ }).click()
  await files.getByRole("button", { name: "加入所选视频" }).click()
  await expect(files).toContainText("视频已加入番组表")
  expect(state.sourceBodies).toEqual([
    {
      bushitsuId: roomId,
      fileId: "video-1",
      fileName: "测试影片.mp4",
      size: 4096,
      upstreamHandle: "video-1",
    },
  ])
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { __baiduFixture?: { requests: Array<{ type: string }> } }
      ).__baiduFixture?.requests.some((request) => request.type === "BAIDU_PERMIT"),
    ),
  ).toBe(true)
  await files.getByRole("button", { name: "关闭" }).click()
  await page.getByRole("combobox", { name: "选择来源" }).selectOption("link")
  await expect(panel).toBeHidden()
  await page.getByRole("combobox", { name: "选择来源" }).selectOption("baidu")
  await expect(panel).toContainText("已连接")

  state.revokeFails = true
  await manage.click()
  await connection.getByRole("button", { name: "撤销百度连接" }).click()
  await connection.getByRole("button", { name: "确认撤销连接" }).click()
  await expect(connection.getByRole("alert").filter({ hasText: "撤销失败" })).toBeVisible()
  await expect(connection.getByText("Fixture account")).toBeVisible()
  state.revokeFails = false
  await connection.getByRole("button", { name: "确认撤销连接" }).click()
  await expect(connection.getByRole("radio", { name: /仅由本机适配器保存/ })).toBeVisible()
  await expect(connection.locator("input[type=radio]:checked")).toHaveCount(0)
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { __baiduFixture?: { requests: Array<{ type: string }> } }
      ).__baiduFixture?.requests.some((request) => request.type === "BAIDU_REVOKE"),
    ),
  ).toBe(true)
  await connection.getByRole("button", { name: "关闭" }).click()

  const guestContext = await browser.newContext({ baseURL: frontendUrl })
  try {
    const guest = await guestContext.newPage()
    await guest.goto("/")
    await guest.getByRole("button", { name: "没有账号？注册" }).click()
    const guestName = `m5_baidu_guest_${randomUUID().replaceAll("-", "").slice(0, 15)}`
    await guest.getByLabel("用户名").fill(guestName)
    await guest.getByLabel("密码", { exact: true }).fill("M5-fixture-password")
    await guest.getByRole("button", { name: "注册并继续" }).click()
    await expect(guest.getByText(guestName, { exact: true })).toBeVisible()
    await guest.goto(`${frontendUrl}/bushitsu/${roomId}`)
    await expect(
      guest.locator(".baidu-panel").getByRole("button", { name: "管理连接" }),
    ).toBeVisible()
    await expect(
      guest.locator(".baidu-panel").getByRole("button", { name: "选择网盘视频" }),
    ).toHaveCount(0)
  } finally {
    await guestContext.close()
  }
})

test("desktop grant waits for owner once and mounts media only after adapter preparation", async ({
  page,
}, info) => {
  test.skip(info.project.name === "baidu-phone")
  const state = initialFixture()
  state.connected = true
  await installAdapter(page)
  await installProviderRoutes(page, state)
  const roomId = await createRoom(page)
  const fixtureItem = {
    id: "baidu-item-1",
    bushitsuId: roomId,
    title: "Baidu fixture",
    type: "direct",
    url: `${housouUrl}/baidu/media/fixture-grant`,
    addedBy: "fixture-account",
    provider: { kind: "baidu", sourceId: "source-1", fileName: "Fixture.mp4" },
  }
  await page.routeWebSocket("**/ws", (socket) => {
    const server = socket.connectToServer()
    socket.onMessage((frame) => {
      const message = JSON.parse(frame.toString()) as {
        type: string
        payload: Record<string, unknown>
      }
      if (message.type === "JOUEI" && message.payload.enmokuId === fixtureItem.id) {
        socket.send(JSON.stringify({ ...message, senderId: "server", ts: Date.now() }))
      } else server.send(frame)
    })
    server.onMessage((frame) => {
      const message = JSON.parse(frame.toString()) as {
        type: string
        payload: Record<string, unknown>
      }
      if (message.type === "BANGUMI") {
        socket.send(JSON.stringify({ ...message, payload: { enmoku: [fixtureItem] } }))
        socket.send(
          JSON.stringify({
            type: "JOUEI",
            senderId: "server",
            ts: Date.now(),
            payload: { enmokuId: fixtureItem.id },
          }),
        )
      } else if (message.type === "GENJOU") {
        socket.send(
          JSON.stringify({ ...message, payload: { ...message.payload, enmokuId: fixtureItem.id } }),
        )
      } else socket.send(frame)
    })
  })
  // Keep the real room admission/socket; replace only its queue snapshot with
  // one synthetic provider item so the page can exercise grant preparation.
  await page.route(`**/bushitsu/${roomId}/bangumi`, (route) =>
    route.fulfill({ json: [fixtureItem] }),
  )
  await page.reload()
  const row = page.getByRole("listitem").filter({ hasText: "Baidu fixture" })
  await expect(row).toBeVisible()
  await row.getByRole("button", { name: "设为当前" }).click()
  await expect(page.getByRole("heading", { name: "Baidu fixture" })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText("正在等待片源所有者的设备准备播放链接…")).toBeVisible()
  await expect(page.locator(".player-screen video")).toBeVisible()
  await expect.poll(() => state.grantCalls).toBe(1)
  expect(state.grantPolls).toBeGreaterThanOrEqual(2)
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { __baiduFixture?: { requests: Array<{ type: string }> } }
      ).__baiduFixture?.requests.some((request) => request.type === "BAIDU_MEDIA_PREPARE"),
    ),
  ).toBe(true)
})

test("phone explains desktop-only Baidu and keeps ordinary room controls", async ({
  page,
}, info) => {
  test.skip(info.project.name === "baidu-desktop")
  const state = initialFixture()
  await installProviderRoutes(page, state)
  await createRoom(page)
  await page.getByRole("combobox", { name: "选择来源" }).selectOption("baidu")
  const panel = page.locator(".baidu-panel")
  await expect(panel).toContainText("仅支持安装 houkago-adapter 的桌面浏览器")
  await expect(panel.getByRole("button", { name: "管理连接" })).toBeVisible()
  await expect(panel.getByRole("button", { name: "选择网盘视频" })).toBeDisabled()
  await page.getByRole("combobox", { name: "选择来源" }).selectOption("link")
  await expect(page.getByLabel("视频链接")).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  expect(state.grantCalls).toBe(0)
})
