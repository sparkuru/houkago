import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { type Page, type TestInfo, expect, test } from "@playwright/test"

const frontendUrl = process.env.PLAYWRIGHT_BASE_URL ?? ""
const housouUrl = process.env.PLAYWRIGHT_HOUSOU_URL ?? ""
const mediaUrl = `${(process.env.PLAYWRIGHT_MEDIA_URL ?? "").replace(/\/$/, "")}/`
const publicMediaUrl = process.env.PLAYWRIGHT_PUBLIC_MEDIA_URL ?? ""

type Observation = Record<string, unknown>

function observeRoom(page: Page) {
  const events = { admissions: [] as string[], closed: 0, chats: [] as string[] }
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname !== "/ws") return
    socket.on("close", () => {
      events.closed += 1
    })
    socket.on("framereceived", (frame) => {
      const message: unknown = JSON.parse(frame.payload.toString())
      if (
        typeof message !== "object" ||
        message === null ||
        !("type" in message) ||
        !("payload" in message) ||
        typeof message.payload !== "object" ||
        message.payload === null
      )
        return
      if (
        message.type === "NYUUSHITSU" &&
        "senderId" in message &&
        message.senderId === "server" &&
        "status" in message.payload &&
        typeof message.payload.status === "string"
      )
        events.admissions.push(message.payload.status)
      if (
        message.type === "OSHABERI" &&
        "content" in message.payload &&
        typeof message.payload.content === "string"
      )
        events.chats.push(message.payload.content)
    })
  })
  return events
}

async function register(page: Page, role: string) {
  const username = `a_${role}_${randomUUID().replaceAll("-", "").slice(0, 18)}`
  await page.goto("/")
  await page.getByRole("button", { name: "没有账号？注册" }).click()
  await page.getByLabel("用户名").fill(username)
  await page.getByLabel("密码", { exact: true }).fill(randomUUID())
  await page.getByRole("button", { name: "注册并继续" }).click()
  await expect(page.getByText(username, { exact: true })).toBeVisible()
  const response = await page.context().request.get(`${housouUrl}/seitoshou/me`)
  expect(response.status()).toBe(200)
  const account: { id: string; username: string } = await response.json()
  expect(account.username).toBe(username)
  return account
}

async function createRoom(page: Page) {
  await page.getByLabel("部室名").fill(`Acceptance ${randomUUID().slice(0, 8)}`)
  await page.getByRole("button", { name: "创建并入部" }).click()
  await expect(page.getByRole("heading", { name: "聊天室" })).toBeVisible()
  const roomId = new URL(page.url()).pathname.split("/").at(-1)
  if (!roomId) throw new Error("The created room has no ID")
  return roomId
}

async function controls(page: Page) {
  await page.locator(".room-speed-dial-launcher").click()
  await page
    .locator(".room-speed-dial-actions")
    .getByRole("button", { name: "房间控制", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "房间控制" })
  await expect(dialog).toBeVisible()
  return dialog
}

async function closeControls(page: Page) {
  const dialog = page.getByRole("dialog", { name: "房间控制" })
  await dialog.locator(".room-controls-dialog-header button").click()
  await expect(dialog).toBeHidden()
}

async function addControlledMedia(page: Page, file: string, title: string) {
  const roomId = new URL(page.url()).pathname.split("/").at(-1)
  const type = file.endsWith(".m3u8") ? "hls" : file.endsWith(".mpd") ? "dash" : "direct"
  const response = await page.context().request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
    headers: { origin: frontendUrl },
    data: {
      title,
      type,
      url: new URL(file, mediaUrl).href,
      ...(file === "master.m3u8"
        ? { subtitles: { English: { type: "hls", url: new URL("sub-en.m3u8", mediaUrl).href } } }
        : {}),
    },
  })
  expect(response.status()).toBe(200)
  const row = page.locator(".room-queue .room-row").filter({ hasText: title })
  await expect(row).toBeVisible()
  return row
}

async function sendChat(page: Page, content: string, name = "发送") {
  await page.locator("#chat-message").fill(content)
  await page.locator(".room-chat-form").getByRole("button", { name, exact: true }).click()
}

async function videoState(page: Page) {
  return page.locator(".player-screen video").evaluate((video: HTMLVideoElement) => ({
    time: video.currentTime,
    paused: video.paused,
    readyState: video.readyState,
    error: video.error?.code ?? null,
    rate: video.playbackRate,
  }))
}

async function settledPair(host: Page, guest: Page, paused: boolean) {
  await expect
    .poll(
      async () => {
        const [a, b] = await Promise.all([videoState(host), videoState(guest)])
        return a.paused === paused && b.paused === paused && Math.abs(a.time - b.time) <= 2
      },
      { message: "Both real players agree on pause/play and drift is at most 2 seconds" },
    )
    .toBe(true)
  const samples = []
  for (let index = 0; index < 3; index += 1) {
    const [a, b] = await Promise.all([videoState(host), videoState(guest)])
    expect(a.paused).toBe(paused)
    expect(b.paused).toBe(paused)
    expect(a.error).toBeNull()
    expect(b.error).toBeNull()
    expect(Math.abs(a.time - b.time)).toBeLessThanOrEqual(2)
    samples.push({ host: a, guest: b, drift: Math.abs(a.time - b.time) })
    await host.waitForTimeout(250)
  }
  return samples
}

async function retainEvidence(info: TestInfo, observations: Observation[]) {
  const path = info.outputPath("sanitized-observations.json")
  await writeFile(path, JSON.stringify(observations, null, 2))
  await info.attach("sanitized-observations", {
    contentType: "application/json",
    path,
  })
}

test("public URL preview rejects controlled LAN media without adding a queue entry", async ({
  page,
}, info) => {
  await register(page, "preview")
  await createRoom(page)
  await page.getByLabel("视频链接").fill(new URL("clip.mp4", mediaUrl).href)
  const response = page.waitForResponse((result) => result.url().endsWith("/enmoku/preview"))
  await page.getByRole("button", { name: "解析链接" }).click()
  expect((await response).status()).toBe(400)
  await expect(page.getByRole("alert")).toContainText(
    "private and local upstream URLs are not supported",
  )
  await expect(page.locator(".room-queue .room-row")).toHaveCount(0)
  await retainEvidence(info, [
    {
      action: "public preview LAN guard",
      status: 400,
      expectedMessage: "private and local upstream URLs are not supported",
      queueCount: 0,
    },
  ])
  await page.screenshot({ path: info.outputPath("lan-preview-rejected.png") })
})

test("actual public media UI preview, queue addition and decoded playback", async ({
  page,
  browser,
}, info) => {
  const deliveries: { status: number; bytes: number; contentType: string }[] = []
  page.on("response", (response) => {
    if (!new URL(response.url()).pathname.startsWith("/eisha/proxy/")) return
    deliveries.push({
      status: response.status(),
      bytes: Number(response.headers()["content-length"] ?? 0),
      contentType: response.headers()["content-type"] ?? "",
    })
  })
  const observations: Observation[] = [
    {
      source: publicMediaUrl,
      browser: browser.version(),
      boundary: "actual public HTTP provider through backend preview and media proxy",
    },
  ]
  try {
    await register(page, "public")
    await createRoom(page)
    await page.getByLabel("视频链接").fill(publicMediaUrl)
    await page.getByLabel("房间显示标题（可选）").fill("Acceptance public CC0 video")
    const preview = page.waitForResponse((response) => response.url().endsWith("/enmoku/preview"))
    await page.getByRole("button", { name: "解析链接" }).click()
    const result = await preview
    expect(result.status()).toBe(200)
    await expect(page.getByRole("status")).toContainText("Acceptance public CC0 video")
    observations.push({ action: "public URL preview", status: result.status() })
    await page.getByRole("button", { name: "加入队列", exact: true }).click()
    const row = page
      .locator(".room-queue .room-row")
      .filter({ hasText: "Acceptance public CC0 video" })
    await expect(row).toBeVisible()
    await row.getByRole("button", { name: "设为当前" }).click()
    await expect.poll(async () => (await videoState(page)).readyState).toBeGreaterThanOrEqual(2)
    await page.getByTestId("player-play-toggle").click()
    await expect.poll(async () => (await videoState(page)).time).toBeGreaterThan(0.5)
    expect(
      deliveries.some(
        (item) =>
          [200, 206].includes(item.status) &&
          item.bytes > 0 &&
          item.contentType.startsWith("video/"),
      ),
    ).toBe(true)
    observations.push({
      action: "actual media decoded progression",
      state: await videoState(page),
      deliveries,
    })
    await page.screenshot({ path: info.outputPath("public-video-playing.png") })
  } finally {
    observations.push({ action: "HTTP responses observed", deliveries })
    await retainEvidence(info, observations)
  }
})

test("real backend admission, permissions, queue, chat and document reconnect", async ({
  page: host,
  browser,
}, info) => {
  const guestContext = await browser.newContext({
    baseURL: frontendUrl,
    viewport: host.viewportSize(),
  })
  const guest = await guestContext.newPage()
  const hostEvents = observeRoom(host)
  const guestEvents = observeRoom(guest)
  const observations: Observation[] = []
  try {
    const hostAccount = await register(host, "host")
    const roomId = await createRoom(host)
    const roomUrl = host.url()
    const dialog = await controls(host)
    await dialog.getByLabel("入室方式").selectOption("approval")
    await dialog.getByRole("button", { name: "保存入室方式" }).click()
    await expect(dialog.locator(".room-controls-info dd").nth(2)).toHaveText("审批")
    const guestAccount = await register(guest, "guest")
    expect(guestAccount.id).not.toBe(hostAccount.id)
    const protectedReads: string[] = []
    guest.on("request", (request) => {
      const url = new URL(request.url())
      if (
        request.method() === "GET" &&
        url.origin === new URL(housouUrl).origin &&
        [`/bushitsu/${roomId}`, `/bushitsu/${roomId}/bangumi`].includes(url.pathname)
      )
        protectedReads.push(url.pathname)
    })
    await guest.goto(roomUrl)
    await expect(guest.getByText("正在等待部長承认…")).toBeVisible()
    expect(protectedReads).toEqual([])
    await expect.poll(() => guestEvents.admissions.includes("waiting")).toBe(true)
    await dialog.getByRole("button", { name: "承认", exact: true }).click()
    await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
    await expect.poll(() => guestEvents.admissions.includes("entered")).toBe(true)
    observations.push({
      criterion: "A1",
      action: "approval",
      independentIdentities: true,
      protectedReadsAfterAdmission: protectedReads.length,
      admissionEvents: [...guestEvents.admissions],
    })
    await closeControls(host)
    await sendChat(host, "Acceptance host chat")
    await expect(
      guest.locator(".room-feed li").filter({ hasText: "Acceptance host chat" }),
    ).toHaveCount(1)
    await sendChat(guest, "Acceptance guest chat")
    await expect(
      host.locator(".room-feed li").filter({ hasText: "Acceptance guest chat" }),
    ).toHaveCount(1)
    const denied = await guestContext.request.post(`${housouUrl}/bushitsu/${roomId}/enmoku`, {
      headers: { origin: frontendUrl },
      data: { title: "Denied", type: "direct", url: new URL("clip.mp4", mediaUrl).href },
    })
    expect(denied.status()).toBe(403)
    await expect(guest.getByLabel("视频链接")).toHaveCount(0)
    const first = await addControlledMedia(host, "clip.mp4", "Acceptance first")
    await addControlledMedia(host, "clip.mp4", "Acceptance pending")
    await expect(guest.locator(".room-queue .room-row")).toHaveCount(2)
    await first.getByRole("button", { name: "设为当前" }).click()
    await expect(
      guest.getByRole("heading", { name: "Acceptance first", exact: true }),
    ).toBeVisible()
    await expect(guest.getByTestId("player-play-toggle")).toBeDisabled()
    await controls(host)
    await dialog.getByRole("button", { name: "共同选片", exact: true }).click()
    await expect(dialog.getByLabel("选片", { exact: true })).toBeChecked()
    await expect(guest.getByLabel("视频链接")).toBeVisible()
    await expect(guest.getByTestId("player-play-toggle")).toBeEnabled()
    for (const name of ["上移", "下移", "清空待播"])
      await expect(guest.getByRole("button", { name, exact: true })).toHaveCount(0)
    observations.push({
      criterion: "A1",
      action: "playlist-enabled guest deletion UI visibility observation",
      guestDeleteButtonCount: await guest
        .getByRole("button", { name: "删除", exact: true })
        .count(),
      deleteButtonVisibilityIsObservationOnly: true,
    })
    await guest.locator("#chat-message").fill("Permission gated draft")
    await dialog.getByLabel("发言", { exact: true }).click()
    await expect(dialog.getByLabel("发言", { exact: true })).not.toBeChecked()
    await expect(guest.locator("#chat-message")).toBeDisabled()
    await expect(
      guest.locator(".room-chat-form").getByRole("button", { name: "发送", exact: true }),
    ).toBeDisabled()
    await dialog.getByLabel("发言", { exact: true }).click()
    await expect(dialog.getByLabel("发言", { exact: true })).toBeChecked()
    await closeControls(host)
    const pending = guest.locator(".room-queue .room-row").filter({ hasText: "Acceptance pending" })
    await pending.getByRole("button", { name: "设为当前" }).click()
    await expect(
      host.getByRole("heading", { name: "Acceptance pending", exact: true }),
    ).toBeVisible()
    const closedBefore = guestEvents.closed
    const admissionsBefore = guestEvents.admissions.length
    await guest.reload()
    await expect.poll(() => guestEvents.closed).toBeGreaterThan(closedBefore)
    await expect
      .poll(() => guestEvents.admissions.slice(admissionsBefore).includes("entered"))
      .toBe(true)
    await expect(
      guest.getByRole("heading", { name: "Acceptance pending", exact: true }),
    ).toBeVisible()
    await expect(guest.locator(".room-queue .room-row")).toHaveCount(2)
    const restored = await guestContext.request.get(`${housouUrl}/seitoshou/me`)
    expect((await restored.json()).id).toBe(guestAccount.id)
    await sendChat(guest, "Acceptance after reconnect")
    await expect(
      host.locator(".room-feed li").filter({ hasText: "Acceptance after reconnect" }),
    ).toHaveCount(1)
    expect(hostEvents.chats.filter((content) => content === "Acceptance guest chat")).toHaveLength(
      1,
    )
    expect(
      hostEvents.chats.filter((content) => content === "Acceptance after reconnect"),
    ).toHaveLength(1)
    observations.push({
      criterion: "A1",
      action: "document reload reconnect",
      identityPreserved: true,
      actualSocketClosures: guestEvents.closed - closedBefore,
      freshAdmissions: guestEvents.admissions.slice(admissionsBefore),
      duplicateChatEvents: false,
      queueCount: 2,
      currentTitle: "Acceptance pending",
    })
    host.once("dialog", (confirmation) => confirmation.accept())
    await host.getByRole("button", { name: "清空待播", exact: true }).click()
    await expect(host.locator(".room-queue .room-row strong")).toHaveText(["Acceptance pending"])
    await expect(guest.locator(".room-queue .room-row strong")).toHaveText(["Acceptance pending"])
    await host.screenshot({ path: info.outputPath("desktop-governance.png") })
    await guest.screenshot({ path: info.outputPath("desktop-reconnected.png") })
  } finally {
    await retainEvidence(info, observations)
    await guestContext.close()
  }
})

test("guest queue deletion follows playlist permission while reorder and clear remain host-only", async ({
  page: host,
  browser,
}, info) => {
  const guestContext = await browser.newContext({
    baseURL: frontendUrl,
    viewport: host.viewportSize(),
  })
  const guest = await guestContext.newPage()
  const observations: Observation[] = []
  const queueEvents: { host: string[][]; guest: string[][] } = { host: [], guest: [] }
  const guestEvents = observeRoom(guest)
  let pendingMediaRequests = 0
  for (const [client, page] of [
    ["host", host],
    ["guest", guest],
  ] as const) {
    page.on("request", (request) => {
      if (request.url() === new URL("clip.mp4", mediaUrl).href) pendingMediaRequests += 1
    })
    page.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname !== "/ws") return
      socket.on("framereceived", (frame) => {
        const message = JSON.parse(frame.payload.toString()) as {
          type?: string
          payload?: { enmoku?: { title: string }[] }
        }
        if (message.type === "BANGUMI" && Array.isArray(message.payload?.enmoku)) {
          queueEvents[client].push(message.payload.enmoku.map((item) => item.title))
        }
      })
    })
  }
  try {
    await register(host, "owner")
    const roomId = await createRoom(host)
    await register(guest, "member")
    await guest.goto(host.url())
    await expect.poll(() => guestEvents.admissions.includes("entered")).toBe(true)
    await addControlledMedia(host, "clip.mp4", "Owner managed pending")
    await addControlledMedia(host, "clip.mp4", "Owner retained pending")
    const beforeTitles = ["Owner managed pending", "Owner retained pending"]
    for (const page of [host, guest]) {
      await expect(page.locator(".room-queue .room-row strong")).toHaveText(beforeTitles)
    }
    await expect(guest.getByLabel("视频链接")).toHaveCount(0)
    const queueResponse = await host
      .context()
      .request.get(`${housouUrl}/bushitsu/${roomId}/bangumi`)
    expect(queueResponse.status()).toBe(200)
    const queue: { id: string; title: string }[] = await queueResponse.json()
    const item = queue.find((entry) => entry.title === "Owner managed pending")
    if (!item) throw new Error("The authoritative queue lacks its pending item")
    const headers = { origin: frontendUrl }
    const deniedRemove = await guestContext.request.delete(
      `${housouUrl}/bushitsu/${roomId}/enmoku/${item.id}`,
      { headers },
    )
    const deniedQueueResponse = await host
      .context()
      .request.get(`${housouUrl}/bushitsu/${roomId}/bangumi`)
    expect(deniedQueueResponse.status()).toBe(200)
    const deniedQueue: { title: string }[] = await deniedQueueResponse.json()
    observations.push({
      criterion: "A1",
      action: "guest without playlist permission cannot delete an owner's queued item",
      guestAdmitted: guestEvents.admissions.includes("entered"),
      guestPlaylistGranted: false,
      deleteStatus: deniedRemove.status(),
      expectedStatus: 403,
      beforeTitles,
      afterTitles: deniedQueue.map((entry) => entry.title),
    })
    expect(deniedRemove.status()).toBe(403)
    expect(deniedQueue.map((entry) => entry.title)).toEqual(beforeTitles)
    for (const page of [host, guest]) {
      await expect(page.locator(".room-queue .room-row strong")).toHaveText(beforeTitles)
    }
    const dialog = await controls(host)
    await expect(dialog.getByLabel("选片", { exact: true })).not.toBeChecked()
    await dialog.getByRole("button", { name: "共同选片", exact: true }).click()
    await expect(dialog.getByLabel("选片", { exact: true })).toBeChecked()
    await closeControls(host)
    await expect(guest.getByLabel("视频链接")).toBeVisible()
    const guestDeleteButtonCount = await guest
      .getByRole("button", { name: "删除", exact: true })
      .count()
    const move = await guestContext.request.post(
      `${housouUrl}/bushitsu/${roomId}/bangumi/${item.id}/move`,
      { headers, data: { direction: "up" } },
    )
    const clear = await guestContext.request.delete(
      `${housouUrl}/bushitsu/${roomId}/bangumi/pending`,
      { headers },
    )
    const governedQueueResponse = await host
      .context()
      .request.get(`${housouUrl}/bushitsu/${roomId}/bangumi`)
    expect(governedQueueResponse.status()).toBe(200)
    const governedQueue: { title: string }[] = await governedQueueResponse.json()
    observations.push({
      criterion: "A1",
      action: "playlist permission preserves host-only reorder and pending clear",
      guestPlaylistGranted: true,
      guestDeleteButtonCount,
      deleteButtonVisibilityIsObservationOnly: true,
      moveStatus: move.status(),
      clearStatus: clear.status(),
      afterTitles: governedQueue.map((entry) => entry.title),
    })
    expect(move.status()).toBe(403)
    expect(clear.status()).toBe(403)
    expect(governedQueue.map((entry) => entry.title)).toEqual(beforeTitles)
    const remove = await guestContext.request.delete(
      `${housouUrl}/bushitsu/${roomId}/enmoku/${item.id}`,
      { headers },
    )
    const remaining = await host.context().request.get(`${housouUrl}/bushitsu/${roomId}/bangumi`)
    expect(remaining.status()).toBe(200)
    const after: { title: string }[] = await remaining.json()
    const afterTitles = ["Owner retained pending"]
    observations.push({
      criterion: "A1",
      action: "playlist-enabled guest may delete another member's queued item",
      guestPlaylistGranted: true,
      deleteStatus: remove.status(),
      expectedStatus: 200,
      beforeTitles,
      afterTitles: after.map((entry) => entry.title),
    })
    expect(remove.status()).toBe(200)
    expect(after.map((entry) => entry.title)).toEqual(afterTitles)
    for (const [client, page] of [
      ["host", host],
      ["guest", guest],
    ] as const) {
      await expect.poll(() => queueEvents[client].at(-1)).toEqual(afterTitles)
      await expect(page.locator(".room-queue .room-row strong")).toHaveText(afterTitles)
    }
    observations.push({
      criterion: "A1",
      action: "both real clients apply the final authoritative queue broadcast",
      hostWsQueueTitles: queueEvents.host.at(-1),
      guestWsQueueTitles: queueEvents.guest.at(-1),
      pendingMediaRequests,
      mediaScope: "queue-only pending items; no media selected or downloaded",
    })
    expect(pendingMediaRequests).toBe(0)
  } finally {
    await retainEvidence(info, observations)
    await guestContext.close()
  }
})

for (const format of ["mp4", "hls", "dash"] as const) {
  test(`real HTTP ${format} explicit addition, two-client progression and synchronization`, async ({
    page: host,
    browser,
  }, info) => {
    const guestContext = await browser.newContext({
      baseURL: frontendUrl,
      viewport: host.viewportSize(),
    })
    const guest = await guestContext.newPage()
    const observations: Observation[] = []
    const deliveries: { client: string; file: string; status: number; bytes: number }[] = []
    for (const [client, page] of [
      ["host", host],
      ["guest", guest],
    ] as const) {
      page.on("response", (response) => {
        if (!response.url().startsWith(mediaUrl)) return
        deliveries.push({
          client,
          file: new URL(response.url()).pathname.split("/").at(-1) ?? "",
          status: response.status(),
          bytes: Number(response.headers()["content-length"] ?? 0),
        })
      })
    }
    try {
      await register(host, "media")
      await createRoom(host)
      await register(guest, "viewer")
      await guest.goto(host.url())
      await expect(guest.getByRole("heading", { name: "聊天室" })).toBeVisible()
      const file = format === "mp4" ? "clip.mp4" : format === "hls" ? "master.m3u8" : "clip.mpd"
      const title = `Acceptance HTTP ${format}`
      const row = await addControlledMedia(host, file, title)
      await expect(guest.locator(".room-queue .room-row").filter({ hasText: title })).toBeVisible()
      await row.getByRole("button", { name: "设为当前" }).click()
      for (const page of [host, guest]) {
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
        await expect.poll(async () => (await videoState(page)).readyState).toBeGreaterThanOrEqual(2)
      }
      await expect(guest.getByTestId("player-play-toggle")).toBeDisabled()
      await host.getByTestId("player-play-toggle").click()
      await expect(guest.getByRole("button", { name: "点击参加放映" })).toBeVisible()
      await guest.getByRole("button", { name: "点击参加放映" }).click()
      await expect.poll(async () => (await videoState(host)).time).toBeGreaterThan(0.5)
      await expect.poll(async () => (await videoState(guest)).time).toBeGreaterThan(0.5)
      observations.push({
        criterion: "A2",
        format,
        action: "host play and viewer join",
        samples: await settledPair(host, guest, false),
      })
      await host.getByTestId("player-play-toggle").click()
      observations.push({
        format,
        action: "host pause",
        samples: await settledPair(host, guest, true),
      })
      await host.getByTestId("player-seek").fill("4")
      await expect.poll(async () => (await videoState(host)).time).toBeGreaterThan(3.5)
      await expect.poll(async () => (await videoState(guest)).time).toBeGreaterThan(3.5)
      observations.push({
        format,
        action: "host seek 4",
        samples: await settledPair(host, guest, true),
      })
      const dialog = await controls(host)
      await dialog.getByLabel("播放控制", { exact: true }).click()
      await expect(dialog.getByLabel("播放控制", { exact: true })).toBeChecked()
      await closeControls(host)
      await expect(guest.getByTestId("player-play-toggle")).toBeEnabled()
      await guest.getByTestId("player-rate").selectOption("1.5")
      await expect.poll(async () => (await videoState(host)).rate).toBe(1.5)
      await guest.getByTestId("player-seek").fill("2")
      await expect.poll(async () => Math.abs((await videoState(host)).time - 2)).toBeLessThan(0.5)
      observations.push({
        format,
        action: "permitted viewer seek 2 and rate 1.5",
        samples: await settledPair(host, guest, true),
      })
      if (format === "hls") {
        await expect(host.getByTestId("player-subtitle")).toBeVisible()
        await host.getByTestId("player-subtitle").selectOption({ label: "English" })
        await expect
          .poll(() =>
            host
              .locator(".player-screen video")
              .evaluate((video: HTMLVideoElement) =>
                Array.from(video.textTracks).some(
                  (track) =>
                    track.mode === "showing" &&
                    Array.from(track.activeCues ?? []).some(
                      (cue) =>
                        cue instanceof VTTCue && cue.text.includes("Acceptance English subtitle"),
                    ),
                ),
              ),
          )
          .toBe(true)
        await expect(guest.getByTestId("player-subtitle")).toHaveValue("off")
        observations.push({
          format,
          action: "English subtitle",
          activeCue: "Acceptance English subtitle",
          guestSubtitle: "off",
        })
      }
      await guest.getByTestId("player-play-toggle").click()
      const start = await Promise.all([videoState(host), videoState(guest)])
      await expect
        .poll(async () => {
          const [a, b] = await Promise.all([videoState(host), videoState(guest)])
          return a.time > start[0].time + 0.5 && b.time > start[1].time + 0.5
        })
        .toBe(true)
      observations.push({
        format,
        action: "permitted viewer resumes",
        samples: await settledPair(host, guest, false),
      })
      if (format === "hls") {
        await sendChat(host, "Acceptance live danmaku", "弹幕")
        await expect(
          host
            .locator(".room-feed li")
            .filter({ hasText: "Acceptance live danmaku" })
            .locator("small"),
        ).toContainText("[弹幕]")
        await expect(guest.locator(".player-screen .danmaku-live-bubble")).toContainText(
          "Acceptance live danmaku",
        )
        await guest.getByTestId("player-web-fullscreen").click()
        await expect(guest.locator(".player-stage")).toHaveClass(/player-web-fullscreen/)
        await expect(guest.locator(".player-stage .danmaku-live-bubble")).toContainText(
          "Acceptance live danmaku",
        )
        await guest.getByTestId("player-web-fullscreen").click()
        await expect(guest.locator(".room-speed-dial-launcher")).toBeVisible()
        observations.push({
          format,
          action: "server-echoed danmaku and web fullscreen",
          guestOverlayObserved: true,
        })
      }
      await guest.getByTestId("player-play-toggle").click()
      observations.push({
        format,
        action: "viewer pause",
        samples: await settledPair(host, guest, true),
      })
      const payloadFile =
        format === "mp4"
          ? "clip.mp4"
          : format === "hls"
            ? "segment0.mpegts"
            : "chunk-stream0-00001.m4s"
      for (const client of ["host", "guest"])
        expect(
          deliveries.some(
            (item) =>
              item.client === client &&
              item.file === payloadFile &&
              [200, 206].includes(item.status) &&
              item.bytes > 0,
          ),
        ).toBe(true)
      observations.push({ format, action: "actual HTTP delivery", deliveries })
      await host.screenshot({ path: info.outputPath(`${format}-host.png`) })
      await guest.screenshot({ path: info.outputPath(`${format}-guest.png`) })
    } finally {
      observations.push({ action: "HTTP responses observed", deliveries })
      await retainEvidence(info, observations)
      await guestContext.close()
    }
  })
}
