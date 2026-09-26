import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"

test("@real-cookie register refresh Vue room continuity and confirmed signout", async ({
  page,
  context,
}) => {
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
  const identity = await context.request.get("http://127.0.0.1:3000/seitoshou/me")
  expect(identity.status()).toBe(200)
  const account: { id: string; username: string } = await identity.json()
  expect(account.username).toBe(username)
  const roomName = `M3 cookie ${Date.now()}`
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
  await expect(page).toHaveURL(/http:\/\/127\.0\.0\.1:5173\/bushitsu\//)
  await expect(page.getByText(roomName, { exact: true }).first()).toBeVisible()
  const same = await context.request.get("http://127.0.0.1:3000/seitoshou/me")
  expect(same.status()).toBe(200)
  expect((await same.json()).id).toBe(account.id)
  await expect
    .poll(() => admitted, { message: "Vue room receives authoritative admission" })
    .toBe(true)
  await page.goto("http://127.0.0.1:5174/")
  await expect(page.getByText(username, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "退出登录" }).click()
  await expect(page.getByLabel("用户名")).toBeVisible()
  expect((await context.request.get("http://127.0.0.1:3000/seitoshou/me")).status()).toBe(401)
  expect(errors).toEqual([])
})
