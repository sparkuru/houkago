import { execFileSync } from "node:child_process"
import { X509Certificate, createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { type IncomingMessage, type Server, createServer as createHttpServer } from "node:http"
import { createServer as createHttpsServer } from "node:https"
import { type Socket, connect } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { type Page, chromium, expect, test } from "@playwright/test"

declare const chrome: {
  declarativeNetRequest: {
    getSessionRules(): Promise<
      Array<{
        action: {
          requestHeaders?: Array<{ header: string; operation: string; value?: string }>
          responseHeaders?: Array<{ header: string; operation: string; value?: string }>
          type: string
        }
        condition: { resourceTypes?: string[]; tabIds?: number[] }
        id: number
      }>
    >
  }
}

test.setTimeout(60_000)

test("installed Chromium applies the real content-script, worker, and DNR boundary", async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "houkago-chromium-adapter-"))
  const profilePath = join(temporaryRoot, "profile")
  const extensionPath = resolve(import.meta.dirname, "../../houkago-adapter/dist/chromium")
  const certificatePath = join(temporaryRoot, "controlled.crt")
  const privateKeyPath = join(temporaryRoot, "controlled.key")

  const mediaRequests: RequestEvidence[] = []
  const ordinaryRequests: RequestEvidence[] = []
  const transportErrors: string[] = []
  const tunnelSockets = new Set<Socket>()
  let sentinelRequests = 0
  let pageOrigin = ""

  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined
  let controlServer: Server | undefined
  let proxyServer: Server | undefined
  let mediaServer: Server | undefined
  let testError: unknown
  const cleanupErrors: unknown[] = []
  try {
    createCertificate(certificatePath, privateKeyPath)
    const certificate = await readFile(certificatePath)
    const certificateSpki = createHash("sha256")
      .update(new X509Certificate(certificate).publicKey.export({ format: "der", type: "spki" }))
      .digest("base64")
    mediaServer = createHttpsServer(
      {
        cert: certificate,
        key: await readFile(privateKeyPath),
      },
      (request, response) => {
        response.setHeader("access-control-allow-origin", pageOrigin)
        response.setHeader("access-control-allow-headers", "range")
        if (request.method === "OPTIONS") {
          response.writeHead(204).end()
          return
        }
        mediaRequests.push(requestEvidence(request))
        const range = headerValue(request, "range")
        response.writeHead(range ? 206 : 200, {
          "accept-ranges": "bytes",
          "cache-control": "max-age=3600",
          "content-length": "4",
          "content-type": "video/mp4",
          etag: '"controlled-etag"',
          "last-modified": "Thu, 01 Jan 1970 00:00:00 GMT",
          ...(range ? { "content-range": "bytes 0-3/4" } : {}),
        })
        response.end("test")
      },
    )
    mediaServer.on("tlsClientError", (error) => transportErrors.push(error.message))
    const mediaPort = await listen(mediaServer)
    const dlink = "https://d.pcs.baidu.com/controlled-media?grant=fixture"
    proxyServer = createHttpServer((_request, response) => response.writeHead(502).end())
    proxyServer.on("connect", (request, clientSocket, head) => {
      trackSocket(clientSocket, tunnelSockets, transportErrors)
      if (request.url !== "d.pcs.baidu.com:443") {
        clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n")
        return
      }
      const upstream = connect(mediaPort, "127.0.0.1", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n")
        if (head.length > 0) upstream.write(head)
        clientSocket.pipe(upstream)
        upstream.pipe(clientSocket)
      })
      trackSocket(upstream, tunnelSockets, transportErrors)
      upstream.on("error", (error) => {
        clientSocket.destroy()
      })
    })
    const proxyPort = await listen(proxyServer)
    controlServer = createHttpServer((request, response) => {
      const origin = pageOrigin
      if (request.url === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" })
        response.end("<!doctype html><title>Houkago adapter controlled smoke</title>")
        return
      }
      if (request.url === "/ordinary") {
        ordinaryRequests.push(requestEvidence(request))
        response.writeHead(200, { "content-type": "text/plain" })
        response.end("ordinary")
        return
      }
      if (request.url === "/baidu/media/g1") {
        sentinelRequests += 1
        response.writeHead(428, { "content-type": "text/plain" })
        response.end("adapter required")
        return
      }
      if (request.url === "/baidu/adaptor/pair" && request.method === "POST") {
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ adaptorToken: "controlled-adaptor-token" }))
        return
      }
      if (request.url === "/baidu/adaptor/grants/g1" && request.method === "GET") {
        if (request.headers.authorization !== "Bearer controlled-adaptor-token") {
          response.writeHead(401).end()
          return
        }
        response.writeHead(200, { "content-type": "application/json" })
        response.end(
          JSON.stringify({
            id: "controlled-grant",
            sentinelUrl: `${origin}/baidu/media/g1`,
            dlink,
            expiresAt: Date.now() + 120_000,
          }),
        )
        return
      }
      if (request.url === "/baidu/adaptor/session" && request.method === "DELETE") {
        response.writeHead(204).end()
        return
      }
      if (request.url === "/baidu/adaptor/heartbeat" && request.method === "POST") {
        response.writeHead(204).end()
        return
      }
      response.writeHead(404).end()
    })
    const controlPort = await listen(controlServer)
    pageOrigin = `http://127.0.0.1:${controlPort}`

    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath()
    context = await chromium.launchPersistentContext(profilePath, {
      executablePath,
      headless: process.env.PLAYWRIGHT_HEADED !== "1",
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        `--proxy-server=http://127.0.0.1:${proxyPort}`,
        `--ignore-certificate-errors-spki-list=${certificateSpki}`,
        "--proxy-bypass-list=127.0.0.1;localhost",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-quic",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    })
    const browserMajorVersion = Number(context.browser()?.version().split(".")[0])
    expect(browserMajorVersion).toBeGreaterThanOrEqual(120)

    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker", { timeout: 10_000 }).catch(() => undefined))
    if (!worker) {
      throw new Error(
        `No extension service worker loaded from ${extensionPath}; the selected browser may reject --load-extension`,
      )
    }
    expect(worker.url()).toMatch(/^chrome-extension:\/\/[a-p]{32}\/background\.js$/)

    const page = await context.newPage()
    await page.goto(pageOrigin)
    const primeCache = async () =>
      page.evaluate(async (mediaUrl) => {
        const response = await fetch(mediaUrl)
        return {
          body: await response.text(),
          cacheControl: response.headers.get("cache-control"),
          status: response.status,
        }
      }, dlink)
    expect(await primeCache()).toEqual({
      body: "test",
      cacheControl: "max-age=3600",
      status: 200,
    })
    expect(await primeCache()).toEqual({
      body: "test",
      cacheControl: "max-age=3600",
      status: 200,
    })
    expect(mediaRequests).toEqual([
      {
        cacheControl: undefined,
        method: "GET",
        providerUserAgent: false,
        range: undefined,
        refererPresent: true,
      },
    ])
    const hello = await adapterRequest(page, "HELLO")
    expect(hello).toMatchObject({
      source: "houkago-adapter",
      type: "HELLO",
      ok: true,
      data: { browser: "chromium" },
    })

    const pair = await adapterRequest(page, "PAIR", {
      serverBase: pageOrigin,
      pairingCode: "controlled-pairing-code",
    })
    expect(pair).toMatchObject({ source: "houkago-adapter", type: "RESULT", ok: true })
    const prepared = await adapterRequest(page, "BAIDU_MEDIA_PREPARE", {
      grantUrl: `${pageOrigin}/baidu/media/g1`,
      expiresAt: Date.now() + 60_000,
    })
    expect(prepared).toMatchObject({ source: "houkago-adapter", type: "RESULT", ok: true })
    const sessionRules = await worker.evaluate(async () => {
      return chrome.declarativeNetRequest.getSessionRules()
    })
    expect(sessionRules).toHaveLength(2)
    expect(sessionRules.find((rule) => rule.action.type === "modifyHeaders")).toMatchObject({
      action: {
        requestHeaders: [
          { header: "user-agent", operation: "set", value: "pan.baidu.com" },
          { header: "referer", operation: "remove" },
          { header: "cache-control", operation: "set", value: "no-cache" },
        ],
        responseHeaders: [{ header: "cache-control", operation: "set", value: "no-store" }],
      },
      condition: {
        resourceTypes: ["media", "xmlhttprequest"],
      },
    })
    const scopedTabIds = sessionRules.flatMap((rule) => rule.condition.tabIds ?? [])
    expect(scopedTabIds).toHaveLength(2)
    expect(new Set(scopedTabIds).size).toBe(1)

    const adapted = await page.evaluate(async (sentinelUrl) => {
      try {
        const response = await fetch(sentinelUrl, { headers: { range: "bytes=0-3" } })
        return {
          body: await response.text(),
          cacheControl: response.headers.get("cache-control"),
          error: null,
          status: response.status,
        }
      } catch (error) {
        return {
          body: null,
          cacheControl: null,
          error: error instanceof Error ? error.message : String(error),
          status: null,
        }
      }
    }, `${pageOrigin}/baidu/media/g1`)
    expect(
      adapted,
      `controlled media evidence: ${JSON.stringify(mediaRequests)}; TLS: ${JSON.stringify(transportErrors)}`,
    ).toEqual({
      body: "test",
      cacheControl: "no-store",
      error: null,
      status: 206,
    })
    expect(sentinelRequests).toBe(0)
    expect(mediaRequests).toHaveLength(2)
    expect(mediaRequests.at(-1)).toEqual({
      cacheControl: "no-cache",
      method: "GET",
      providerUserAgent: true,
      range: "bytes=0-3",
      refererPresent: false,
    })
    const repeated = await page.evaluate(async (sentinelUrl) => {
      const response = await fetch(sentinelUrl, { headers: { range: "bytes=0-3" } })
      return {
        body: await response.text(),
        cacheControl: response.headers.get("cache-control"),
        status: response.status,
      }
    }, `${pageOrigin}/baidu/media/g1`)
    expect(repeated).toEqual({ body: "test", cacheControl: "no-store", status: 206 })
    expect(mediaRequests).toHaveLength(3)
    expect(mediaRequests.at(-1)).toEqual({
      cacheControl: "no-cache",
      method: "GET",
      providerUserAgent: true,
      range: "bytes=0-3",
      refererPresent: false,
    })

    const isolatedPage = await context.newPage()
    await isolatedPage.goto(pageOrigin)
    const isolatedStatus = await isolatedPage.evaluate(async (sentinelUrl) => {
      return (await fetch(sentinelUrl)).status
    }, `${pageOrigin}/baidu/media/g1`)
    expect(isolatedStatus).toBe(428)
    expect(sentinelRequests).toBe(1)

    expect(await page.evaluate(async () => (await fetch("/ordinary")).text())).toBe("ordinary")
    expect(ordinaryRequests).toEqual([
      {
        cacheControl: undefined,
        method: "GET",
        providerUserAgent: false,
        range: undefined,
        refererPresent: true,
      },
    ])

    const revoked = await adapterRequest(page, "BAIDU_REVOKE")
    expect(revoked).toMatchObject({ source: "houkago-adapter", type: "RESULT", ok: true })
    expect(
      await worker.evaluate(
        async () => (await chrome.declarativeNetRequest.getSessionRules()).length,
      ),
    ).toBe(0)
    const revokedStatus = await page.evaluate(async (sentinelUrl) => {
      return (await fetch(sentinelUrl)).status
    }, `${pageOrigin}/baidu/media/g1`)
    expect(revokedStatus).toBe(428)
    expect(sentinelRequests).toBe(2)
    expect(mediaRequests).toHaveLength(3)
  } catch (error) {
    testError = error
  } finally {
    await context?.close().catch((error) => cleanupErrors.push(error))
    for (const socket of tunnelSockets) socket.destroy()
    const serverResults = await Promise.allSettled([
      closeServer(controlServer),
      closeServer(proxyServer),
      closeServer(mediaServer),
    ])
    cleanupErrors.push(
      ...serverResults
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason),
    )
    await rm(temporaryRoot, { recursive: true, force: true }).catch((error) =>
      cleanupErrors.push(error),
    )
  }
  if (testError !== undefined) throw testError
  expect(cleanupErrors, "controlled smoke cleanup failed").toEqual([])
})

type RequestEvidence = {
  cacheControl: string | undefined
  method: string
  providerUserAgent: boolean
  range: string | undefined
  refererPresent: boolean
}

function requestEvidence(request: IncomingMessage): RequestEvidence {
  return {
    cacheControl: headerValue(request, "cache-control"),
    method: request.method ?? "UNKNOWN",
    providerUserAgent: request.headers["user-agent"] === "pan.baidu.com",
    range: headerValue(request, "range"),
    refererPresent: headerValue(request, "referer") !== undefined,
  }
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value.join(",") : value
}

function trackSocket(socket: Socket, sockets: Set<Socket>, errors: string[]): void {
  sockets.add(socket)
  socket.on("close", () => sockets.delete(socket))
  socket.on("error", (error) => errors.push(error.message))
}

function createCertificate(certificatePath: string, privateKeyPath: string): void {
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      "/CN=d.pcs.baidu.com",
      "-addext",
      "subjectAltName=DNS:d.pcs.baidu.com",
      "-keyout",
      privateKeyPath,
      "-out",
      certificatePath,
      "-days",
      "1",
    ],
    { stdio: "ignore" },
  )
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("controlled server address missing")
  return address.port
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server?.listening) return
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

async function adapterRequest(
  page: Page,
  type: string,
  payload: Record<string, unknown> = {},
): Promise<unknown> {
  return page.evaluate(
    ({ requestType, requestPayload }) =>
      new Promise<unknown>((resolve, reject) => {
        const nonce = crypto.randomUUID()
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage)
          reject(new Error(`adapter response timed out for ${requestType}`))
        }, 10_000)
        function onMessage(event: MessageEvent<unknown>) {
          const response = event.data
          if (
            event.source !== window ||
            event.origin !== window.location.origin ||
            typeof response !== "object" ||
            response === null ||
            !("source" in response) ||
            !("nonce" in response) ||
            response.source !== "houkago-adapter" ||
            response.nonce !== nonce
          ) {
            return
          }
          window.clearTimeout(timeout)
          window.removeEventListener("message", onMessage)
          resolve(response)
        }
        window.addEventListener("message", onMessage)
        window.postMessage(
          {
            source: "houkago-page",
            protocolVersion: 1,
            nonce,
            type: requestType,
            ...requestPayload,
          },
          window.location.origin,
        )
      }),
    { requestType: type, requestPayload: payload },
  )
}
