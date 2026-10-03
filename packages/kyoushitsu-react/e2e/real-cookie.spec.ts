import { randomUUID } from "node:crypto"
import { type Page, expect, test } from "@playwright/test"

const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? "http://127.0.0.1:3000"
const frontendUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173"

async function register(target: Page, prefix: string) {
  const username = `${prefix.slice(0, 11)}_${randomUUID().replaceAll("-", "").slice(0, 20)}`
  await target.goto("/")
  await target.getByRole("button", { name: "没有账号？注册" }).click()
  await target.getByLabel("用户名").fill(username)
  await target.getByLabel("密码", { exact: true }).fill("M6-fixture-password")
  await target.getByRole("button", { name: "注册并继续" }).click()
  await expect(target.getByText(username, { exact: true })).toBeVisible()
  return username
}

async function openControls(page: Page, label = "房间控制") {
  await page.locator(".room-speed-dial-launcher").click()
  await page
    .locator(".room-speed-dial-actions")
    .getByRole("button", { name: label, exact: true })
    .click()
  const controls = page.getByRole("dialog", { name: label })
  await expect(controls).toBeVisible()
  return controls
}

async function closeControls(page: Page, label = "房间控制") {
  const controls = page.getByRole("dialog", { name: label })
  await controls.locator(".room-controls-dialog-header button").click()
  await expect(controls).toBeHidden()
}

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
  browser,
}) => {
  const guestContext = await browser.newContext({
    baseURL: frontendUrl,
    viewport: page.viewportSize(),
  })
  const guest = await guestContext.newPage()
  let guestRoomSockets = 0
  guest.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname === "/ws") guestRoomSockets += 1
  })
  try {
    await register(page, "m4_host")
    await page.getByLabel("部室名").fill("M4 shared room")
    await page.getByRole("button", { name: "创建并入部" }).click()
    await expect(page.getByRole("heading", { name: "聊天室" })).toBeVisible()
    const roomUrl = page.url()
    const roomId = new URL(roomUrl).pathname.split("/").at(-1)
    expect(roomId).toBeTruthy()
    const controls = await openControls(page)
    await controls.getByLabel("入室方式").selectOption("approval")
    await controls.getByRole("button", { name: "保存入室方式" }).click()
    await register(guest, "m4_guest")
    await guest.goto(roomUrl)
    await expect(guest.getByText("正在等待部長承认…")).toBeVisible()
    await expect(controls.getByRole("heading", { name: "待审", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "承认" }).click()
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    await closeControls(page)
    await page.route("**/enmoku/preview", (route) =>
      route.fulfill({
        status: 403,
        json: { error: { code: "FORBIDDEN", message: "Preview denied" } },
      }),
    )
    await page.getByLabel("视频链接").fill("https://example.com/clip.mp4")
    await page.getByRole("button", { name: "解析链接" }).click()
    await expect(page.getByRole("alert")).toContainText("Preview denied")
    await expect(page.getByLabel("视频链接")).toHaveValue("https://example.com/clip.mp4")
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
    await expect(page.getByLabel("视频链接")).toHaveValue("")
    await expect(page.getByLabel("房间显示标题（可选）")).toHaveValue("")
    await expect(page.getByRole("button", { name: "加入队列" })).toHaveCount(0)
    await expect(guest.getByRole("listitem").getByText("Shared clip")).toBeVisible()
    await page.getByRole("button", { name: "设为当前" }).click()
    await expect(guest.getByRole("heading", { name: "Shared clip" })).toBeVisible()
    await openControls(page)
    const remove = controls.getByRole("button", { name: "移除", exact: true })
    let removalRequests = 0
    await page.route("**/bushitsu/*/meibo/*", (route) => {
      removalRequests += 1
      return route.fulfill({
        status: 500,
        json: { error: { code: "INTERNAL", message: "Removal failed" } },
      })
    })
    page.once("dialog", (dialog) => dialog.dismiss())
    await remove.click()
    expect(removalRequests).toBe(0)
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    page.once("dialog", (dialog) => dialog.accept())
    await remove.click()
    await expect(controls.getByRole("alert")).toContainText("Removal failed")
    expect(removalRequests).toBe(1)
    await expect(remove).toBeEnabled()
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    await page.unroute("**/bushitsu/*/meibo/*")
    const removed = page.waitForResponse(
      (response) => response.request().method() === "DELETE" && response.url().includes("/meibo/"),
    )
    page.once("dialog", (dialog) => dialog.accept())
    await remove.click()
    expect((await removed).status()).toBe(200)
    await expect(guest).toHaveURL(/\?revoked=1/)
    await expect(guest.getByRole("alert")).toContainText("你已被移出该部室")
    const socketsAtRevocation = guestRoomSockets
    await guest.reload()
    await expect(guest.getByRole("alert")).toContainText("你已被移出该部室")
    expect(guestRoomSockets).toBe(socketsAtRevocation)
  } finally {
    await guestContext.close()
  }
})

test("@real-cookie owner manages pending queue while permitted members can only select", async ({
  page,
  browser,
}) => {
  const guestContext = await browser.newContext({
    baseURL: frontendUrl,
    viewport: page.viewportSize(),
  })
  const guest = await guestContext.newPage()
  try {
    await register(page, "m6_queue_host")
    await page.getByLabel("部室名").fill("M6 queue governance")
    await page.getByRole("button", { name: "创建并入部" }).click()
    await expect(page.getByRole("heading", { name: "聊天室" })).toBeVisible()
    const roomUrl = page.url()
    const roomId = new URL(roomUrl).pathname.split("/").at(-1)
    await register(guest, "m6_queue_guest")
    await guest.goto(roomUrl)
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    for (const title of ["First", "Current", "Third", "Delete me"]) {
      const added = await page.context().request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
        headers: { origin: frontendUrl },
        data: {
          title,
          type: "direct",
          url: `https://example.test/${title.replaceAll(" ", "-")}.mp4`,
        },
      })
      expect(added.status()).toBe(200)
    }
    const rows = page.locator(".room-queue .room-row")
    const guestRows = guest.locator(".room-queue .room-row")
    await expect(rows).toHaveCount(4)
    await expect(rows.first().getByRole("button", { name: "上移" })).toBeDisabled()
    await expect(rows.last().getByRole("button", { name: "下移" })).toBeDisabled()
    const current = rows.filter({ hasText: "Current" })
    await current.getByRole("button", { name: "设为当前" }).click()
    await expect(guest.getByRole("heading", { name: "Current", exact: true })).toBeVisible()
    await current.getByRole("button", { name: "上移" }).click()
    await expect(rows.locator("strong")).toHaveText(["Current", "First", "Third", "Delete me"])
    await expect(guestRows.locator("strong")).toHaveText(["Current", "First", "Third", "Delete me"])
    const serverQueue = await page.context().request.get(`${housouUrl}/bushitsu/${roomId}/bangumi`)
    expect((await serverQueue.json()).map((item: { title: string }) => item.title)).toEqual([
      "Current",
      "First",
      "Third",
      "Delete me",
    ])
    const controls = await openControls(page)
    await expect(controls.getByLabel("发言", { exact: true })).toBeChecked()
    await expect(controls.getByLabel("播放控制", { exact: true })).not.toBeChecked()
    await expect(controls.getByLabel("选片", { exact: true })).not.toBeChecked()
    await expect(controls.getByRole("button", { name: "仅聊天", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await controls.getByRole("button", { name: "共同播放", exact: true }).click()
    await expect(controls.getByRole("button", { name: "共同播放", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await expect(controls.getByLabel("播放控制", { exact: true })).toBeChecked()
    await expect(guest.getByTestId("player-play-toggle")).toBeEnabled()
    await controls.getByRole("button", { name: "共同选片", exact: true }).click()
    await expect(controls.getByRole("button", { name: "共同选片", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await expect(controls.getByLabel("选片", { exact: true })).toBeChecked()
    await guest.locator("#chat-message").fill("Permission fixture draft")
    await controls.getByLabel("发言", { exact: true }).click()
    await expect(controls.getByLabel("发言", { exact: true })).not.toBeChecked()
    await expect(controls.getByText("当前权限由精细设置自定义。", { exact: true })).toBeVisible()
    await expect(
      guest.locator(".room-chat-form").getByRole("button", { name: "发送", exact: true }),
    ).toBeDisabled()
    await controls.getByLabel("发言", { exact: true }).click()
    await expect(controls.getByLabel("发言", { exact: true })).toBeChecked()
    await expect(
      guest.locator(".room-chat-form").getByRole("button", { name: "发送", exact: true }),
    ).toBeEnabled()
    await closeControls(page)
    const guestControls = await openControls(guest, "房间信息")
    await expect(guestControls.locator(".room-controls-info")).toContainText("共同选片")
    for (const name of ["仅聊天", "共同播放", "共同选片"]) {
      await expect(guestControls.getByRole("button", { name, exact: true })).toHaveCount(0)
    }
    await closeControls(guest, "房间信息")
    await expect(guest.getByLabel("视频链接")).toBeVisible()
    await expect(
      guestRows.filter({ hasText: "First" }).getByRole("button", { name: "设为当前" }),
    ).toBeEnabled()
    await expect(
      guestRows.filter({ hasText: "Current" }).getByRole("button", { name: "设为当前" }),
    ).toBeDisabled()
    for (const name of ["上移", "下移", "删除", "清空待播"]) {
      await expect(guest.getByRole("button", { name, exact: true })).toHaveCount(0)
    }
    await expect(current.getByRole("button", { name: "删除", exact: true })).toHaveCount(0)
    const deleting = rows
      .filter({ hasText: "Delete me" })
      .getByRole("button", { name: "删除", exact: true })
    page.once("dialog", (dialog) => dialog.dismiss())
    await deleting.click()
    await expect(rows).toHaveCount(4)
    page.once("dialog", (dialog) => dialog.accept())
    await deleting.click()
    await expect(rows).toHaveCount(3)
    await expect(guestRows).toHaveCount(3)
    page.once("dialog", (dialog) => dialog.dismiss())
    await page.getByRole("button", { name: "清空待播" }).click()
    await expect(rows).toHaveCount(3)
    page.once("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "清空待播" }).click()
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText("Current")
    await expect(guestRows).toHaveCount(1)
    await expect(guestRows.first()).toContainText("Current")
    await expect(guest.getByRole("heading", { name: "Current", exact: true })).toBeVisible()
    await openControls(page)
    await controls.getByRole("button", { name: "仅聊天", exact: true }).click()
    await expect(controls.getByRole("button", { name: "仅聊天", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    await expect(guest.getByLabel("视频链接")).toHaveCount(0)
    await expect(guest.getByTestId("player-play-toggle")).toBeDisabled()
  } finally {
    await guestContext.close()
  }
})

test("@real-cookie admission rejects, closed/password gating and open recovery preserve protected reads", async ({
  page,
  browser,
}) => {
  const visitorContext = await browser.newContext({
    baseURL: frontendUrl,
    viewport: page.viewportSize(),
  })
  const visitor = await visitorContext.newPage()
  try {
    await register(page, "m6_admission_host")
    await page.getByLabel("部室名").fill("M6 admission")
    await page.getByRole("button", { name: "创建并入部" }).click()
    await expect(page.getByRole("heading", { name: "聊天室" })).toBeVisible()
    const roomUrl = page.url()
    const roomPath = new URL(roomUrl).pathname
    const controls = await openControls(page)
    const saveMode = async (mode: string) => {
      await controls.getByLabel("入室方式").selectOption(mode)
      if (mode === "password") await controls.getByLabel("入室密码").fill("M6-room-password")
      await controls.getByRole("button", { name: "保存入室方式" }).click()
      await expect(controls.locator(".room-controls-info dd").nth(2)).toHaveText(
        mode === "open"
          ? "开放"
          : mode === "approval"
            ? "审批"
            : mode === "password"
              ? "密码"
              : "禁止",
      )
    }
    await saveMode("approval")
    await register(visitor, "m6_admission_visitor")
    const protectedReads: string[] = []
    visitor.on("request", (request) => {
      if (
        request.method() === "GET" &&
        new URL(request.url()).origin === new URL(housouUrl).origin &&
        [roomPath, `${roomPath}/bangumi`].includes(new URL(request.url()).pathname)
      )
        protectedReads.push(request.url())
    })
    await visitor.goto(roomUrl)
    await expect(visitor.getByText("正在等待部長承认…")).toBeVisible()
    await controls.getByRole("button", { name: "拒绝", exact: true }).click()
    await expect(visitor.getByRole("heading", { name: "聊天室" })).toHaveCount(0)
    await expect(visitor.getByText("入室没有被承认。", { exact: true })).toBeVisible()
    for (const mode of ["closed", "password"]) {
      await saveMode(mode)
      await visitor.reload()
      await expect(visitor.getByText("这个部室当前关闭入室。", { exact: true })).toBeVisible()
      await expect(visitor.getByRole("heading", { name: "聊天室" })).toHaveCount(0)
    }
    expect(protectedReads).toEqual([])
    await saveMode("open")
    await visitor.reload()
    await expect(visitor.getByRole("heading", { name: "聊天室" })).toBeVisible()
    expect(protectedReads.length).toBeGreaterThan(0)
  } finally {
    await visitorContext.close()
  }
})

test("@real-cookie room information tracks online duration, departures and rejoining names", async ({
  page,
  browser,
}) => {
  const guestContext = await browser.newContext({
    baseURL: frontendUrl,
    viewport: page.viewportSize(),
  })
  const guest = await guestContext.newPage()
  try {
    await register(page, "m6_presence")
    await page.getByLabel("部室名").fill("M6 member presence")
    await page.getByRole("button", { name: "创建并入部" }).click()
    await expect(page.getByRole("heading", { name: "聊天室" })).toBeVisible()
    const roomUrl = page.url()
    const username = await register(guest, "m6_member")
    await guest.goto(roomUrl)
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    await guest.locator("#chat-message").fill("History name fixture")
    await guest
      .locator(".room-chat-form")
      .getByRole("button", { name: "发送", exact: true })
      .click()
    const chat = page.locator(".room-feed li").filter({ hasText: "History name fixture" })
    await expect(chat.locator("strong")).toHaveText(username)
    const controls = await openControls(page)
    const online = controls.getByRole("region", { name: "当前在线", exact: true })
    const history = controls.getByRole("region", { name: "历史在线", exact: true })
    const member = online.getByRole("row").filter({ hasText: username })
    await expect(member).toBeVisible()
    await expect(member.getByTestId("member-online-duration")).toHaveText(/秒|分|时/)
    await expect(member.getByTestId("member-online-duration")).toHaveText(/^(?:[2-9]|\d{2,})秒$/)
    await expect(history).not.toContainText(username)
    await guest.goto("/")
    await expect(member).toHaveCount(0)
    const departed = history.getByRole("row").filter({ hasText: username })
    await expect(departed).toBeVisible()
    const departureTime = await departed.locator("time").getAttribute("datetime")
    expect(Number.isFinite(Date.parse(departureTime ?? ""))).toBe(true)
    await expect(chat.locator("strong")).toHaveText(username)
    await guest.goto(roomUrl)
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    await expect(member).toBeVisible()
    await expect(member.getByTestId("member-online-duration")).toHaveText(/^[01]秒$/)
    await expect(history).not.toContainText(username)
    await expect(chat.locator("strong")).toHaveText(username)
    await page.screenshot({
      path: test.info().outputPath("member-presence-modal.png"),
      animations: "disabled",
    })
    await closeControls(page)
    await expect(page.locator(".room-speed-dial-launcher")).toBeFocused()
  } finally {
    await guestContext.close()
  }
})
