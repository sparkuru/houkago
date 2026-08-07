import type { BaiduOAuthConfig } from "houkago-eisha"

export type HoukagoBaiduConfig = {
  oauth?: BaiduOAuthConfig
  credentialKey?: Uint8Array
  keyVersion: number
}

export function baiduConfig(env: NodeJS.ProcessEnv = process.env): HoukagoBaiduConfig {
  const clientId = clean(env.HOUKAGO_BAIDU_CLIENT_ID)
  const clientSecret = clean(env.HOUKAGO_BAIDU_CLIENT_SECRET)
  const redirectUri = clean(env.HOUKAGO_BAIDU_REDIRECT_URI)
  const keyVersion = positiveInteger(env.HOUKAGO_CREDENTIAL_KEY_VERSION) ?? 1
  const credentialKey = decodeCredentialKey(env.HOUKAGO_CREDENTIAL_KEY)
  const oauth =
    clientId && clientSecret && redirectUri ? { clientId, clientSecret, redirectUri } : undefined
  return { oauth, credentialKey, keyVersion }
}

function decodeCredentialKey(value: string | undefined): Uint8Array | undefined {
  if (!value) return undefined
  try {
    const decoded = Uint8Array.from(Buffer.from(value, "base64"))
    return decoded.byteLength === 32 ? decoded : undefined
  } catch {
    return undefined
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim()
  return result ? result : undefined
}

function positiveInteger(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}
