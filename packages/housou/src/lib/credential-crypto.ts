import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

type CipherEnvelope = {
  v: number
  iv: string
  ciphertext: string
  tag: string
}

export class CredentialCipher {
  constructor(
    private readonly key: Uint8Array,
    readonly keyVersion: number,
  ) {
    if (key.byteLength !== 32) throw new Error("credential key must contain exactly 32 bytes")
  }

  encrypt(value: unknown, context: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", this.key, iv)
    cipher.setAAD(Buffer.from(context, "utf8"))
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
    const envelope: CipherEnvelope = {
      v: this.keyVersion,
      iv: iv.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    }
    return JSON.stringify(envelope)
  }

  decrypt<T>(value: string, context: string): T {
    const envelope = parseEnvelope(value)
    if (envelope.v !== this.keyVersion) throw new Error("credential key version is unavailable")
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(envelope.iv, "base64"))
    decipher.setAAD(Buffer.from(context, "utf8"))
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ])
    return JSON.parse(plaintext.toString("utf8")) as T
  }
}

function parseEnvelope(value: string): CipherEnvelope {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid encrypted credential")
  }
  const envelope = parsed as Partial<CipherEnvelope>
  if (
    !Number.isSafeInteger(envelope.v) ||
    typeof envelope.iv !== "string" ||
    typeof envelope.ciphertext !== "string" ||
    typeof envelope.tag !== "string"
  ) {
    throw new Error("invalid encrypted credential")
  }
  return envelope as CipherEnvelope
}
