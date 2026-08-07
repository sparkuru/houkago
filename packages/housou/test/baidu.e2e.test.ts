import { expect, test } from "bun:test"
import type { KousokuMessage } from "houkago-kousoku"
import { getBaiduConnection } from "../src/db/queries/baidu"
import { app } from "../src/index"
import { CredentialCipher } from "../src/lib/credential-crypto"

const origin = "http://127.0.0.1:5173"

test("Baidu OAuth, pairing, source, and grants keep secrets behind adaptor auth", async () => {
  process.env.HOUKAGO_BAIDU_CLIENT_ID = "client-id"
  process.env.HOUKAGO_BAIDU_CLIENT_SECRET = "client-secret"
  process.env.HOUKAGO_BAIDU_REDIRECT_URI = "http://localhost/baidu/oauth/callback"
  process.env.HOUKAGO_CREDENTIAL_KEY = Buffer.alloc(32, 9).toString("base64")
  const originalFetch = globalThis.fetch
  globalThis.fetch = baiduFixtureFetch(originalFetch)
  app.listen(0)
  const base = `http://localhost:${app.server?.port}`
  const sockets: WebSocket[] = []

  try {
    const accountSuffix = crypto.randomUUID().slice(0, 8)
    const alice = await register(originalFetch, base, `baidu_alice_${accountSuffix}`)
    const bob = await register(originalFetch, base, `baidu_bob_${accountSuffix}`)
    const roomResponse = await localFetch(originalFetch, `${base}/bushitsu`, alice.cookie, {
      method: "POST",
      body: JSON.stringify({ name: "Baidu grants" }),
    })
    const room = (await roomResponse.json()) as { id: string }
    sockets.push(await admit(base, room.id, alice.cookie))

    const aliceSharedAdapter = await pair(originalFetch, base, alice.cookie, "shared-device-0001")
    expect(
      await localFetch(originalFetch, `${base}/baidu/adaptor/pairing`, alice.cookie, {
        method: "POST",
        body: JSON.stringify({ deviceId: "shared-device-0001", localPaired: true }),
      }).then((response) => response.json()),
    ).toEqual({ state: "paired" })
    const bobAdapter = await pair(originalFetch, base, bob.cookie, "shared-device-0001")
    expect(
      await originalFetch(`${base}/baidu/adaptor/heartbeat`, {
        method: "POST",
        headers: { authorization: `Bearer ${aliceSharedAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(401)
    const aliceAdapter = await pair(originalFetch, base, alice.cookie, "alice-device-0001")

    const started = await localFetch(originalFetch, `${base}/baidu/oauth/start`, alice.cookie, {
      method: "POST",
      body: JSON.stringify({ retentionMode: "server-saved" }),
    })
    expect(started.status).toBe(200)
    const { authorizationUrl } = (await started.json()) as { authorizationUrl: string }
    const state = new URL(authorizationUrl).searchParams.get("state") ?? ""

    const callback = await originalFetch(
      `${base}/baidu/oauth/callback?code=one-use-code&state=${encodeURIComponent(state)}`,
    )
    const callbackBody = await callback.text()
    expect(callback.status).toBe(200)
    expect(callback.headers.get("content-type")).toBe("text/html; charset=utf-8")
    expect(callback.headers.get("cache-control")).toBe("no-store")
    expect(callbackBody).toContain("Authorization complete")
    expect(callbackBody).not.toContain("one-use-code")
    expect(callbackBody).not.toContain(state)
    expect(callbackBody).not.toContain("access-secret")
    expect(callbackBody).not.toContain("refresh-secret")

    const replay = await originalFetch(
      `${base}/baidu/oauth/callback?code=replay&state=${encodeURIComponent(state)}`,
    )
    expect(replay.status).toBe(400)

    const status = await localFetch(originalFetch, `${base}/baidu/status`, alice.cookie)
    const statusText = await status.text()
    expect(statusText).not.toContain("access-secret")
    expect(statusText).not.toContain("refresh-secret")
    expect(JSON.parse(statusText)).toMatchObject({
      connected: true,
      retentionMode: "server-saved",
      accountName: "Baidu Fixture",
    })

    const listed = await localFetch(originalFetch, `${base}/baidu/files/list`, alice.cookie, {
      method: "POST",
      body: JSON.stringify({ path: "/" }),
    })
    expect(await listed.json()).toEqual({
      path: "/",
      entries: [
        {
          id: "9001",
          name: "fixture.mp4",
          path: "/fixture.mp4",
          isDirectory: false,
          size: 1234,
          modifiedAt: 1700000000000,
          mediaType: "video",
        },
      ],
    })
    const rotatedConnection = getBaiduConnection(alice.id)
    const rotatedToken = new CredentialCipher(Buffer.alloc(32, 9), 1).decrypt<{
      refreshToken: string
    }>(
      rotatedConnection?.encryptedTokenBundle ?? "",
      `baidu-connection:${alice.id}:${rotatedConnection?.authorizationId}`,
    )
    expect(rotatedToken.refreshToken).toBe("refresh-secret-rotated")

    const savedBangumi = nextMessage(
      sockets[0] as WebSocket,
      (message) => message.type === "BANGUMI",
    )
    const selected = await localFetch(originalFetch, `${base}/baidu/sources`, alice.cookie, {
      method: "POST",
      body: JSON.stringify({
        bushitsuId: room.id,
        fileId: "9001",
        fileName: "forged-name.mp4",
        size: 999999,
      }),
    })
    expect(selected.status).toBe(200)
    const enmokuText = await selected.text()
    expect(enmokuText).not.toContain("access-secret")
    expect(enmokuText).not.toContain("refresh-secret")
    expect(enmokuText).not.toContain("d.pcs.baidu.com")
    const enmoku = JSON.parse(enmokuText) as {
      title: string
      provider: { sourceId: string; fileName: string; size: number }
    }
    expect(enmoku.title).toBe("fixture.mp4")
    expect(enmoku.provider.fileName).toBe("fixture.mp4")
    expect(enmoku.provider.size).toBe(1234)
    const savedBangumiText = JSON.stringify(await savedBangumi)
    expect(savedBangumiText).not.toContain("access-secret")
    expect(savedBangumiText).not.toContain("refresh-secret")
    expect(savedBangumiText).not.toContain("baidupcs.com")
    const bangumiText = await originalFetch(`${base}/bushitsu/${room.id}/bangumi`).then(
      (response) => response.text(),
    )
    expect(bangumiText).not.toContain("access-secret")
    expect(bangumiText).not.toContain("refresh-secret")
    expect(bangumiText).not.toContain("baidupcs.com")

    const forged = await localFetch(
      originalFetch,
      `${base}/bushitsu/${room.id}/enmoku`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({
          title: "forged",
          type: "direct",
          url: "https://example.test/forged",
          provider: {
            kind: "baidu",
            sourceId: "forged",
            fileName: "forged.mp4",
          },
        }),
      },
    )
    expect(forged.status).toBe(400)

    expect(
      await localFetch(
        originalFetch,
        `${base}/baidu/sources/${enmoku.provider.sourceId}/availability?bushitsuId=${room.id}`,
        bob.cookie,
      ).then((response) => response.status),
    ).toBe(403)
    expect(
      await localFetch(
        originalFetch,
        `${base}/baidu/sources/${enmoku.provider.sourceId}/grants`,
        bob.cookie,
        { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
      ).then((response) => response.status),
    ).toBe(403)
    sockets.push(await admit(base, room.id, bob.cookie))

    const availability = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${enmoku.provider.sourceId}/availability?bushitsuId=${room.id}`,
      alice.cookie,
    )
    expect(await availability.json()).toEqual({
      sourceId: enmoku.provider.sourceId,
      mode: "server-saved",
      ownerOnline: true,
      playable: true,
    })

    const grantResponse = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${enmoku.provider.sourceId}/grants`,
      bob.cookie,
      { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
    )
    const grantText = await grantResponse.text()
    expect(grantText).not.toContain("d.pcs.baidu.com")
    const grant = JSON.parse(grantText) as { state: string; grantUrl: string }
    expect(grant.state).toBe("ready")
    const grantId = new URL(grant.grantUrl).pathname.split("/").at(-1) ?? ""

    const wrongViewerClaim = await originalFetch(`${base}/baidu/adaptor/grants/${grantId}`, {
      headers: { authorization: `Bearer ${aliceAdapter.adaptorToken}` },
    })
    expect(wrongViewerClaim.status).toBe(403)

    const claim = await originalFetch(`${base}/baidu/adaptor/grants/${grantId}`, {
      headers: { authorization: `Bearer ${bobAdapter.adaptorToken}` },
    })
    const claimed = (await claim.json()) as { sentinelUrl: string; dlink: string }
    expect(claim.status).toBe(200)
    expect(claimed.sentinelUrl).toBe(grant.grantUrl)
    expect(claimed.dlink).toContain("baidupcs.com")
    expect(claimed.dlink).not.toContain("access_token")
    expect(JSON.stringify(claimed)).not.toContain("access-secret")
    expect(
      await originalFetch(`${base}/baidu/adaptor/grants/${grantId}`, {
        headers: { authorization: `Bearer ${bobAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(403)
    expect(await originalFetch(grant.grantUrl).then((response) => response.status)).toBe(428)

    expect(
      await localFetch(originalFetch, `${base}/baidu/connection`, alice.cookie, {
        method: "DELETE",
      }).then((response) => response.status),
    ).toBe(200)
    const heldAdapter = await pair(originalFetch, base, alice.cookie, "alice-device-held1")
    const heldStart = await localFetch(originalFetch, `${base}/baidu/oauth/start`, alice.cookie, {
      method: "POST",
      body: JSON.stringify({
        retentionMode: "user-held",
        deviceId: "alice-device-held1",
      }),
    }).then((response) => response.json() as Promise<{ authorizationUrl: string }>)
    const heldState = new URL(heldStart.authorizationUrl).searchParams.get("state") ?? ""
    expect(
      await originalFetch(
        `${base}/baidu/oauth/callback?code=held-code&state=${encodeURIComponent(heldState)}`,
      ).then((response) => response.status),
    ).toBe(200)
    expect(
      await localFetch(
        originalFetch,
        `${base}/baidu/sources/${enmoku.provider.sourceId}/availability?bushitsuId=${room.id}`,
        bob.cookie,
      ).then((response) => response.json()),
    ).toEqual({
      sourceId: enmoku.provider.sourceId,
      mode: "server-saved",
      ownerOnline: true,
      playable: false,
      reason: "connection-revoked",
    })
    expect(
      await localFetch(
        originalFetch,
        `${base}/baidu/sources/${enmoku.provider.sourceId}/grants`,
        bob.cookie,
        { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
      ).then((response) => response.status),
    ).toBe(409)

    const handoff = await originalFetch(`${base}/baidu/adaptor/oauth/handoff`, {
      method: "POST",
      headers: { authorization: `Bearer ${heldAdapter.adaptorToken}` },
    })
    expect(handoff.status).toBe(200)
    expect(await handoff.json()).toMatchObject({
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
    })
    expect(
      await originalFetch(`${base}/baidu/adaptor/oauth/refresh`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${heldAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ refreshToken: "refresh-secret" }),
      }).then((response) => response.json()),
    ).toMatchObject({
      accessToken: "access-secret-refreshed",
      refreshToken: "refresh-secret-rotated",
    })
    expect(
      await originalFetch(`${base}/baidu/adaptor/oauth/handoff`, {
        method: "POST",
        headers: { authorization: `Bearer ${heldAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(409)

    const heldBangumi = nextMessage(
      sockets[1] as WebSocket,
      (message) => message.type === "BANGUMI",
    )
    const heldSourceResponse = await localFetch(
      originalFetch,
      `${base}/baidu/sources`,
      alice.cookie,
      {
        method: "POST",
        body: JSON.stringify({
          bushitsuId: room.id,
          fileId: "page-id-not-stored",
          fileName: "held.mp4",
          size: 77,
          upstreamHandle: "extension-only-handle",
        }),
      },
    )
    const heldSource = (await heldSourceResponse.json()) as { provider: { sourceId: string } }
    const heldBangumiText = JSON.stringify(await heldBangumi)
    expect(heldBangumiText).not.toContain("access-secret")
    expect(heldBangumiText).not.toContain("refresh-secret")
    expect(heldBangumiText).not.toContain("extension-only-handle")
    const secondaryAdapter = await pair(originalFetch, base, alice.cookie, "alice-secondary-01")
    expect(
      await originalFetch(`${base}/baidu/adaptor/oauth/refresh`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${secondaryAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ refreshToken: "refresh-secret" }),
      }).then((response) => response.status),
    ).toBe(403)
    const heldGrant = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${heldSource.provider.sourceId}/grants`,
      bob.cookie,
      { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
    ).then((response) => response.json() as Promise<{ requestId: string; state: string }>)
    expect(heldGrant.state).toBe("pending")
    expect(
      await originalFetch(`${base}/baidu/adaptor/session`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${secondaryAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(200)

    const requests = await originalFetch(`${base}/baidu/adaptor/dlink-requests`, {
      headers: { authorization: `Bearer ${heldAdapter.adaptorToken}` },
    }).then(
      (response) =>
        response.json() as Promise<
          Array<{ requestId: string; nonce: string; sourceId: string; bushitsuId: string }>
        >,
    )
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      requestId: heldGrant.requestId,
      sourceId: heldSource.provider.sourceId,
      bushitsuId: room.id,
    })
    expect(
      await originalFetch(`${base}/baidu/adaptor/dlink-requests`, {
        headers: { authorization: `Bearer ${bobAdapter.adaptorToken}` },
      }).then((response) => response.json()),
    ).toEqual([])
    expect(
      await originalFetch(`${base}/baidu/adaptor/dlink-responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${bobAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: heldGrant.requestId,
          nonce: requests[0]?.nonce,
          dlink: "https://d.pcs.baidu.com/file/held",
          expiresAt: Date.now() + 60_000,
        }),
      }).then((response) => response.status),
    ).toBe(403)
    expect(
      await originalFetch(`${base}/baidu/adaptor/dlink-responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${heldAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: heldGrant.requestId,
          nonce: "wrong-nonce-value",
          dlink: "https://d.pcs.baidu.com/file/held",
          expiresAt: Date.now() + 60_000,
        }),
      }).then((response) => response.status),
    ).toBe(403)
    expect(
      await originalFetch(`${base}/baidu/adaptor/dlink-responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${heldAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: heldGrant.requestId,
          nonce: requests[0]?.nonce,
          dlink: "https://d.pcs.baidu.com/file/held?access_token=must-not-pass",
          expiresAt: Date.now() + 60_000,
        }),
      }).then((response) => response.status),
    ).toBe(403)
    expect(
      await originalFetch(`${base}/baidu/adaptor/dlink-responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${heldAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: heldGrant.requestId,
          nonce: requests[0]?.nonce,
          dlink: "https://d.pcs.baidu.com/file/held",
          expiresAt: Date.now() + 60_000,
        }),
      }).then((response) => response.status),
    ).toBe(200)

    const readyHeldGrant = await localFetch(
      originalFetch,
      `${base}/baidu/grants/${heldGrant.requestId}`,
      bob.cookie,
    ).then((response) => response.json() as Promise<{ grantUrl: string; state: string }>)
    expect(readyHeldGrant.state).toBe("ready")
    expect(JSON.stringify(readyHeldGrant)).not.toContain("d.pcs.baidu.com")
    const heldGrantId = new URL(readyHeldGrant.grantUrl).pathname.split("/").at(-1) ?? ""
    const heldClaim = await originalFetch(`${base}/baidu/adaptor/grants/${heldGrantId}`, {
      headers: { authorization: `Bearer ${bobAdapter.adaptorToken}` },
    })
    expect(heldClaim.status).toBe(200)
    const heldClaimText = await heldClaim.text()
    expect(heldClaimText).not.toContain("access_token")
    expect(heldClaimText).not.toContain("access-secret")

    const failedGrant = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${heldSource.provider.sourceId}/grants`,
      bob.cookie,
      { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
    ).then((response) => response.json() as Promise<{ requestId: string; state: string }>)
    expect(failedGrant.state).toBe("pending")
    const failedRequests = await originalFetch(`${base}/baidu/adaptor/dlink-requests`, {
      headers: { authorization: `Bearer ${heldAdapter.adaptorToken}` },
    }).then((response) => response.json() as Promise<Array<{ requestId: string; nonce: string }>>)
    const failedRequest = failedRequests.find(
      (request) => request.requestId === failedGrant.requestId,
    )
    const failureResponse = await originalFetch(`${base}/baidu/adaptor/dlink-responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${heldAdapter.adaptorToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        requestId: failedGrant.requestId,
        nonce: failedRequest?.nonce,
        failure: "upstream-resolution-failed",
      }),
    })
    expect(failureResponse.status).toBe(200)
    const failedPollText = await localFetch(
      originalFetch,
      `${base}/baidu/grants/${failedGrant.requestId}`,
      bob.cookie,
    ).then((response) => response.text())
    expect(JSON.parse(failedPollText)).toEqual({
      state: "failed",
      reason: "upstream-resolution-failed",
    })
    expect(failedPollText).not.toContain("access-secret")
    expect(failedPollText).not.toContain("refresh-secret")
    expect(failedPollText).not.toContain("baidupcs.com")

    const leavePending = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${heldSource.provider.sourceId}/grants`,
      bob.cookie,
      { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
    ).then((response) => response.json() as Promise<{ requestId: string }>)
    const [leaveRequest] = await originalFetch(`${base}/baidu/adaptor/dlink-requests`, {
      headers: { authorization: `Bearer ${heldAdapter.adaptorToken}` },
    }).then((response) => response.json() as Promise<Array<{ requestId: string; nonce: string }>>)
    expect(leaveRequest?.requestId).toBe(leavePending.requestId)
    expect(
      await originalFetch(`${base}/baidu/adaptor/dlink-responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${heldAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: leavePending.requestId,
          nonce: leaveRequest?.nonce,
          dlink: "https://d.pcs.baidu.com/file/leave",
          expiresAt: Date.now() + 60_000,
        }),
      }).then((response) => response.status),
    ).toBe(200)
    const leaveReady = await localFetch(
      originalFetch,
      `${base}/baidu/grants/${leavePending.requestId}`,
      bob.cookie,
    ).then((response) => response.json() as Promise<{ grantUrl: string }>)
    const leaveGrantId = new URL(leaveReady.grantUrl).pathname.split("/").at(-1) ?? ""
    await closeSocket(sockets[0] as WebSocket)
    expect(
      await originalFetch(`${base}/baidu/adaptor/grants/${leaveGrantId}`, {
        headers: { authorization: `Bearer ${bobAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(403)

    expect(
      await originalFetch(`${base}/baidu/adaptor/session`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${heldAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(200)
    const offline = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${heldSource.provider.sourceId}/availability?bushitsuId=${room.id}`,
      bob.cookie,
    ).then((response) => response.json())
    expect(offline).toEqual({
      sourceId: heldSource.provider.sourceId,
      mode: "user-held",
      ownerOnline: false,
      playable: false,
      reason: "owner-offline",
    })

    sockets.push(await admit(base, room.id, alice.cookie))
    const revokeAdapter = await pair(originalFetch, base, alice.cookie, "alice-device-held1")
    const revokePending = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${heldSource.provider.sourceId}/grants`,
      bob.cookie,
      { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
    ).then((response) => response.json() as Promise<{ requestId: string; state: string }>)
    expect(revokePending.state).toBe("pending")
    const [revokeRequest] = await originalFetch(`${base}/baidu/adaptor/dlink-requests`, {
      headers: { authorization: `Bearer ${revokeAdapter.adaptorToken}` },
    }).then((response) => response.json() as Promise<Array<{ requestId: string; nonce: string }>>)
    expect(revokeRequest?.requestId).toBe(revokePending.requestId)
    expect(
      await originalFetch(`${base}/baidu/adaptor/dlink-responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${revokeAdapter.adaptorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requestId: revokePending.requestId,
          nonce: revokeRequest?.nonce,
          dlink: "https://d.pcs.baidu.com/file/revoke",
          expiresAt: Date.now() + 60_000,
        }),
      }).then((response) => response.status),
    ).toBe(200)
    const revokeReady = await localFetch(
      originalFetch,
      `${base}/baidu/grants/${revokePending.requestId}`,
      bob.cookie,
    ).then((response) => response.json() as Promise<{ grantUrl: string; state: string }>)
    expect(revokeReady.state).toBe("ready")
    const revokeGrantId = new URL(revokeReady.grantUrl).pathname.split("/").at(-1) ?? ""
    const revokeSecondPending = await localFetch(
      originalFetch,
      `${base}/baidu/sources/${heldSource.provider.sourceId}/grants`,
      bob.cookie,
      { method: "POST", body: JSON.stringify({ bushitsuId: room.id }) },
    ).then((response) => response.json() as Promise<{ requestId: string; state: string }>)
    expect(revokeSecondPending.state).toBe("pending")

    expect(
      await localFetch(originalFetch, `${base}/baidu/connection`, alice.cookie, {
        method: "DELETE",
      }).then((response) => response.status),
    ).toBe(200)
    expect(
      await originalFetch(`${base}/baidu/adaptor/grants/${revokeGrantId}`, {
        headers: { authorization: `Bearer ${bobAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(403)
    expect(
      await localFetch(
        originalFetch,
        `${base}/baidu/grants/${revokeSecondPending.requestId}`,
        bob.cookie,
      ).then((response) => response.status),
    ).toBe(403)
    expect(
      await originalFetch(`${base}/baidu/adaptor/heartbeat`, {
        method: "POST",
        headers: { authorization: `Bearer ${revokeAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(401)
    expect(
      await originalFetch(`${base}/baidu/adaptor/heartbeat`, {
        method: "POST",
        headers: { authorization: `Bearer ${bobAdapter.adaptorToken}` },
      }).then((response) => response.status),
    ).toBe(200)
    expect(
      await localFetch(
        originalFetch,
        `${base}/baidu/sources/${heldSource.provider.sourceId}/availability?bushitsuId=${room.id}`,
        bob.cookie,
      ).then((response) => response.json()),
    ).toEqual({
      sourceId: heldSource.provider.sourceId,
      mode: "user-held",
      ownerOnline: true,
      playable: false,
      reason: "connection-revoked",
    })
  } finally {
    for (const socket of sockets) socket.close()
    app.server?.stop()
    globalThis.fetch = originalFetch
    Reflect.deleteProperty(process.env, "HOUKAGO_BAIDU_CLIENT_ID")
    Reflect.deleteProperty(process.env, "HOUKAGO_BAIDU_CLIENT_SECRET")
    Reflect.deleteProperty(process.env, "HOUKAGO_BAIDU_REDIRECT_URI")
    Reflect.deleteProperty(process.env, "HOUKAGO_CREDENTIAL_KEY")
  }
})

async function register(
  fetcher: typeof fetch,
  base: string,
  username: string,
): Promise<{ cookie: string; id: string }> {
  const response = await fetcher(`${base}/seitoshou/register`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ username, password: "correct-horse-battery" }),
  })
  expect(response.status).toBe(200)
  const seito = (await response.json()) as { id: string }
  return { cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", id: seito.id }
}

async function pair(fetcher: typeof fetch, base: string, cookie: string, deviceId: string) {
  const pairing = await localFetch(fetcher, `${base}/baidu/adaptor/pairing`, cookie, {
    method: "POST",
    body: JSON.stringify({ deviceId, localPaired: false }),
  }).then(
    (response) =>
      response.json() as Promise<{
        state: "pairing-required"
        pairingCode: string
      }>,
  )
  expect(pairing.state).toBe("pairing-required")
  const response = await fetcher(`${base}/baidu/adaptor/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairingCode: pairing.pairingCode, deviceId }),
  })
  expect(response.status).toBe(200)
  return response.json() as Promise<{ adaptorToken: string }>
}

async function admit(base: string, bushitsuId: string, cookie: string): Promise<WebSocket> {
  const ws = new WebSocket(`${base.replace("http", "ws")}/ws?bushitsuId=${bushitsuId}`, {
    headers: { cookie, origin },
  })
  const entered = new Promise<void>((resolve) => {
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as KousokuMessage
      if (message.type === "NYUUSHITSU" && message.payload.status === "entered") resolve()
    })
  })
  await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve(), { once: true }))
  await entered
  return ws
}

function nextMessage(
  ws: WebSocket,
  predicate: (message: KousokuMessage) => boolean,
): Promise<KousokuMessage> {
  return new Promise((resolve) => {
    const listener = (event: MessageEvent) => {
      const message = JSON.parse(event.data) as KousokuMessage
      if (!predicate(message)) return
      ws.removeEventListener("message", listener)
      resolve(message)
    }
    ws.addEventListener("message", listener)
  })
}

function closeSocket(ws: WebSocket): Promise<void> {
  if (ws.readyState === WebSocket.CLOSED) return Promise.resolve()
  return new Promise((resolve) => {
    ws.addEventListener("close", () => resolve(), { once: true })
    ws.close()
  })
}

function localFetch(
  fetcher: typeof fetch,
  url: string,
  cookie: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set("origin", origin)
  headers.set("cookie", cookie)
  if (init.body) headers.set("content-type", "application/json")
  return fetcher(url, { ...init, headers })
}

function baiduFixtureFetch(fallback: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
    )
    if (init?.method === "HEAD" && url.hostname === "d.pcs.baidu.com") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.baidupcs.com/final?cap=fixture" },
      })
    }
    if (url.hostname === "openapi.baidu.com" && url.pathname === "/oauth/2.0/token") {
      if (url.searchParams.get("grant_type") === "refresh_token") {
        return Response.json({
          access_token: "access-secret-refreshed",
          refresh_token: "refresh-secret-rotated",
          expires_in: 3600,
          scope: "basic netdisk",
        })
      }
      return Response.json({
        access_token: "access-secret",
        refresh_token: "refresh-secret",
        expires_in: 1,
        scope: "basic netdisk",
      })
    }
    if (url.hostname === "pan.baidu.com" && url.searchParams.get("method") === "uinfo") {
      return Response.json({ errno: 0, baidu_name: "Baidu Fixture" })
    }
    if (url.hostname === "pan.baidu.com" && url.searchParams.get("method") === "list") {
      if (url.searchParams.get("access_token") !== "access-secret-refreshed") {
        return Response.json({ errno: -6 })
      }
      return Response.json({
        errno: 0,
        list: [
          {
            fs_id: 9001,
            server_filename: "fixture.mp4",
            path: "/fixture.mp4",
            isdir: 0,
            size: 1234,
            server_mtime: 1700000000,
            category: 1,
          },
        ],
      })
    }
    if (url.hostname === "pan.baidu.com" && url.searchParams.get("method") === "filemetas") {
      expect(url.searchParams.get("fsids")).toBe("[9001]")
      expect(url.searchParams.get("dlink")).toBe("1")
      return Response.json({
        errno: 0,
        list: [
          {
            fs_id: 9001,
            filename: "fixture.mp4",
            path: "/fixture.mp4",
            isdir: 0,
            size: 1234,
            server_mtime: 1700000000,
            category: 1,
            dlink: "https://d.pcs.baidu.com/file/fixture",
          },
        ],
      })
    }
    return fallback(input, init)
  }
}
