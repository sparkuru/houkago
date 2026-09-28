import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"

const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? "http://127.0.0.1:3000"
const frontendUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173"

test("@real-cookie register refresh React room continuity and confirmed signout", async ({
  page,
  context,
}, info) => {
  const username = `m3_${randomUUID().replaceAll("-", "").slice(0, 24)}`
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill("M3-fixture-password")
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(username, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText(username, { exact: true })).toBeVisible()
  const identity = await context.request.get(`${housouUrl}/seitoshou/me`)
  expect(identity.status()).toBe(200)
  const account: { id: string; username: string } = await identity.json()
  expect(account.username).toBe(username)
  const roomName = `M4 cookie ${Date.now()}`
  await page.getByLabel("部室名").fill(roomName)
  let admitted = false
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname !== "/ws") return
    socket.on("framereceived", (frame) => {
      const message: unknown = JSON.parse(frame.payload.toString())
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "NYUUSHITSU" &&
        "senderId" in message &&
        message.senderId === "server" &&
        "payload" in message &&
        typeof message.payload === "object" &&
        message.payload !== null &&
        "status" in message.payload &&
        message.payload.status === "entered"
      )
        admitted = true
    })
  })
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page).toHaveURL(new RegExp(`${frontendUrl}/bushitsu/`))
  await expect(page.getByText(roomName, { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "聊天室" })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: info.outputPath("admitted-room.png"), fullPage: true })
  const same = await context.request.get(`${housouUrl}/seitoshou/me`)
  expect(same.status()).toBe(200)
  expect((await same.json()).id).toBe(account.id)
  await expect
    .poll(() => admitted, { message: "React room receives authoritative admission" })
    .toBe(true)
  await page.goto("/")
  await expect(page.getByText(username, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "退出登录" }).click()
  await expect(page.getByLabel("用户名")).toBeVisible()
  expect((await context.request.get(`${housouUrl}/seitoshou/me`)).status()).toBe(401)
  expect(errors).toEqual([])
})

test("@real-cookie two clients handle approval, chat, queue and revocation", async ({
  page,
  context,
  browser,
}) => {
  const guestContext = await browser.newContext({ baseURL: frontendUrl })
  const guest = await guestContext.newPage()
  const register = async (target: typeof page, prefix: string) => {
    const username = `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`
    await target.goto("/")
    await target.getByRole("button", { name: "没有账号？注册" }).click()
    await target.getByLabel("用户名").fill(username)
    await target.getByLabel("密码", { exact: true }).fill("M4-fixture-password")
    await target.getByRole("button", { name: "注册并继续" }).click()
    await expect(target.getByText(username, { exact: true })).toBeVisible()
    return username
  }
  try {
    await register(page, "m4_host")
    await page.getByLabel("部室名").fill("M4 shared room")
    await page.getByRole("button", { name: "创建并入部" }).click()
    await expect(page.getByRole("heading", { name: "聊天室" })).toBeVisible()
    const roomUrl = page.url()
    const roomId = new URL(roomUrl).pathname.split("/").at(-1)
    expect(roomId).toBeTruthy()
    await page.getByLabel("入室方式").selectOption("approval")
    await page.getByRole("button", { name: "保存入室方式" }).click()
    await register(guest, "m4_guest")
    await guest.goto(roomUrl)
    await expect(guest.getByText("正在等待部長承认…")).toBeVisible()
    await expect(page.getByText("待审")).toBeVisible()
    await page.getByRole("button", { name: "承认" }).click()
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    await page.route("**/enmoku/preview", (route) =>
      route.fulfill({
        status: 403,
        json: { error: { code: "FORBIDDEN", message: "Preview denied" } },
      }),
    )
    await page.getByLabel("视频链接").fill("https://example.com/clip.mp4")
    await page.getByRole("button", { name: "解析链接" }).click()
    await expect(page.getByRole("alert")).toContainText("Preview denied")
    await page.unroute("**/enmoku/preview")
    // The real direct-source add and BANGUMI broadcast need no upstream fetch;
    // preview probes the remote media URL, so keep that one response local.
    await page.route("**/enmoku/preview", (route) =>
      route.fulfill({
        status: 200,
        json: { state: "ready", title: "Shared clip", type: "direct" },
      }),
    )
    await page.locator("#chat-message").fill("Hello from host")
    await page.locator(".room-chat-form").getByRole("button", { name: "发送" }).click()
    await expect(guest.getByText("Hello from host")).toBeVisible()
    await guest.locator("#chat-message").fill("Hello from guest")
    await guest.locator(".room-chat-form").getByRole("button", { name: "发送" }).click()
    await expect(page.getByText("Hello from guest")).toBeVisible()
    await expect(guest.getByLabel("视频链接")).toHaveCount(0)
    const denied = await guestContext.request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
      headers: { origin: frontendUrl },
      data: { title: "Denied", type: "direct", url: "https://example.com/denied.mp4" },
    })
    expect(denied.status()).toBe(403)
    await page.getByLabel("视频链接").fill("https://example.test/clip.mp4")
    await page.getByLabel("房间显示标题（可选）").fill("Shared clip")
    await page.getByRole("button", { name: "解析链接" }).click()
    await expect(page.getByRole("status")).toContainText("Shared clip")
    await page.getByRole("button", { name: "加入队列" }).click()
    await expect(page.getByRole("listitem").getByText("Shared clip")).toBeVisible()
    await expect(guest.getByRole("listitem").getByText("Shared clip")).toBeVisible()
    await page.getByRole("button", { name: "设为当前" }).click()
    await expect(guest.getByRole("heading", { name: "Shared clip" })).toBeVisible()
    const guestIdentity = await guestContext.request.get(`${housouUrl}/seitoshou/me`)
    const guestAccount: { id: string } = await guestIdentity.json()
    const removed = await context.request.delete(
      `${housouUrl}/bushitsu/${roomId}/meibo/${guestAccount.id}`,
      {
        headers: { origin: frontendUrl },
      },
    )
    expect(removed.status()).toBe(200)
    await expect(guest).toHaveURL(/\?revoked=1/)
  } finally {
    await guestContext.close()
  }
})
