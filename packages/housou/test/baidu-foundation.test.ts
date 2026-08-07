import { expect, test } from "bun:test"
import { getBaiduAdaptorSession, insertBaiduAdaptorSession } from "../src/db/queries/baidu"
import { insertSeito } from "../src/db/queries/seito"
import { addEnmoku, createBushitsu, fetchBangumi } from "../src/domain/bushitsu"
import {
  completeBaiduOAuth,
  consumeBaiduHandoff,
  createBaiduPairing,
  redeemBaiduPairing,
  revokeBaiduConnection,
  startBaiduOAuth,
} from "../src/lib/baidu"
import { CredentialCipher } from "../src/lib/credential-crypto"

test("AES-256-GCM credentials round-trip and reject tampering", () => {
  const cipher = new CredentialCipher(crypto.getRandomValues(new Uint8Array(32)), 7)
  const encrypted = cipher.encrypt(
    { accessToken: "access-secret", refreshToken: "refresh-secret" },
    "baidu-connection:alice",
  )

  expect(encrypted).not.toContain("access-secret")
  expect(encrypted).not.toContain("refresh-secret")
  expect(cipher.decrypt(encrypted, "baidu-connection:alice")).toEqual({
    accessToken: "access-secret",
    refreshToken: "refresh-secret",
  })

  const envelope = JSON.parse(encrypted) as { ciphertext: string }
  envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`
  expect(() => cipher.decrypt(JSON.stringify(envelope), "baidu-connection:alice")).toThrow()
  expect(() => cipher.decrypt(encrypted, "baidu-connection:bob")).toThrow()
  expect(() => cipher.decrypt(encrypted, "baidu-source:alice")).toThrow()
})

test("Baidu provider metadata survives the SQLite Enmoku boundary", () => {
  const suffix = crypto.randomUUID()
  const seito = insertSeito({
    id: `seito-${suffix}`,
    username: `owner-${suffix}`,
    usernameNorm: `owner-${suffix}`,
    passwordHash: "unused",
    createdAt: Date.now(),
  })
  const room = createBushitsu("Baidu room", seito.id)
  const created = addEnmoku(room.id, {
    title: "movie.mp4",
    type: "direct",
    url: "/baidu/source/safe-source",
    addedBy: seito.id,
    provider: {
      kind: "baidu",
      sourceId: "safe-source",
      ownerName: "safe account",
      fileName: "movie.mp4",
      size: 42,
    },
  })

  expect(fetchBangumi(room.id)[0]?.provider).toEqual(created.provider)
})

test("revoking one Baidu connection clears only that user's transient authorization state", async () => {
  const suffix = crypto.randomUUID()
  const now = Date.now()
  const alice = insertSeito({
    id: `baidu-revoke-alice-${suffix}`,
    username: `baidu-revoke-alice-${suffix}`,
    usernameNorm: `baidu-revoke-alice-${suffix}`,
    passwordHash: "unused",
    createdAt: now,
  })
  const bob = insertSeito({
    id: `baidu-revoke-bob-${suffix}`,
    username: `baidu-revoke-bob-${suffix}`,
    usernameNorm: `baidu-revoke-bob-${suffix}`,
    passwordHash: "unused",
    createdAt: now,
  })
  const aliceSession = {
    tokenDigest: `alice-session-${suffix}`,
    seitoId: alice.id,
    deviceId: `alice-device-${suffix}`,
    expiresAt: now + 60_000,
    lastSeenAt: now,
  }
  const bobSession = {
    tokenDigest: `bob-session-${suffix}`,
    seitoId: bob.id,
    deviceId: `bob-device-${suffix}`,
    expiresAt: now + 60_000,
    lastSeenAt: now,
  }
  insertBaiduAdaptorSession(aliceSession, now)
  insertBaiduAdaptorSession(bobSession, now)

  process.env.HOUKAGO_BAIDU_CLIENT_ID = "client-id"
  process.env.HOUKAGO_BAIDU_CLIENT_SECRET = "client-secret"
  process.env.HOUKAGO_BAIDU_REDIRECT_URI = "http://localhost/baidu/oauth/callback"
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
    )
    if (url.hostname === "openapi.baidu.com") {
      const code = url.searchParams.get("code") ?? "unknown"
      return Response.json({
        access_token: `access-${code}`,
        refresh_token: `refresh-${code}`,
        expires_in: 3600,
        scope: "basic netdisk",
      })
    }
    if (url.hostname === "pan.baidu.com" && url.searchParams.get("method") === "uinfo") {
      return Response.json({ errno: 0, baidu_name: "Baidu fixture" })
    }
    throw new Error(`unexpected URL: ${url.origin}${url.pathname}`)
  }

  try {
    const aliceCompletedState = oauthState(
      startBaiduOAuth(alice.id, "user-held", aliceSession.deviceId, now).authorizationUrl,
    )
    const bobCompletedState = oauthState(
      startBaiduOAuth(bob.id, "user-held", bobSession.deviceId, now).authorizationUrl,
    )
    await completeBaiduOAuth("alice-completed", aliceCompletedState, now)
    await completeBaiduOAuth("bob-completed", bobCompletedState, now)

    const alicePendingState = oauthState(
      startBaiduOAuth(alice.id, "user-held", aliceSession.deviceId, now).authorizationUrl,
    )
    const bobPendingState = oauthState(
      startBaiduOAuth(bob.id, "user-held", bobSession.deviceId, now).authorizationUrl,
    )
    const alicePairing = createBaiduPairing(alice.id, `alice-next-${suffix}`, false, now)
    const bobPairing = createBaiduPairing(bob.id, `bob-next-${suffix}`, false, now)
    if (alicePairing.state !== "pairing-required" || bobPairing.state !== "pairing-required") {
      throw new Error("pairing fixture did not issue one-use codes")
    }

    revokeBaiduConnection(alice.id, now + 1)

    expect(getBaiduAdaptorSession(aliceSession.tokenDigest)?.revokedAt).toBe(now + 1)
    expect(getBaiduAdaptorSession(bobSession.tokenDigest)?.revokedAt).toBeUndefined()
    expect(() =>
      redeemBaiduPairing(alicePairing.pairingCode, `alice-next-${suffix}`, now + 1),
    ).toThrow("pairing code is invalid")
    expect(
      redeemBaiduPairing(bobPairing.pairingCode, `bob-next-${suffix}`, now + 1).adaptorToken,
    ).toBeString()
    await expect(completeBaiduOAuth("alice-pending", alicePendingState, now + 1)).rejects.toThrow(
      "OAuth state is invalid",
    )
    await completeBaiduOAuth("bob-pending", bobPendingState, now + 1)
    expect(() => consumeBaiduHandoff(aliceSession, now + 1)).toThrow("OAuth handoff is unavailable")
    expect(consumeBaiduHandoff(bobSession, now + 1).refreshToken).toBe("refresh-bob-pending")
  } finally {
    globalThis.fetch = originalFetch
    Reflect.deleteProperty(process.env, "HOUKAGO_BAIDU_CLIENT_ID")
    Reflect.deleteProperty(process.env, "HOUKAGO_BAIDU_CLIENT_SECRET")
    Reflect.deleteProperty(process.env, "HOUKAGO_BAIDU_REDIRECT_URI")
  }
})

function oauthState(authorizationUrl: string): string {
  const state = new URL(authorizationUrl).searchParams.get("state")
  if (!state) throw new Error("OAuth fixture did not produce a state")
  return state
}
