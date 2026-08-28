import {
  type AdapterPageResponse,
  BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
  type BaiduMediaFingerprint,
  HOUKAGO_ADAPTER_CLIENT_SOURCE,
  HOUKAGO_ADAPTER_PROTOCOL_VERSION,
} from "houkago-kousoku"

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/**
 * Read and hash only the requested prefix from an already authorized grant.
 * The caller supplies a sentinel URL; the extension network port owns the
 * private redirect to Baidu and this module never receives that destination.
 */
export async function fingerprintBaiduMedia(
  grantUrl: string,
  maxBytes = BAIDU_MEDIA_FINGERPRINT_MAX_BYTES,
  fetcher: Fetcher = fetch,
): Promise<BaiduMediaFingerprint> {
  if (!isWebUrl(grantUrl)) throw new Error("media fingerprint URL is invalid")
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > BAIDU_MEDIA_FINGERPRINT_MAX_BYTES) {
    throw new Error("media fingerprint range is invalid")
  }

  const response = await fetcher(grantUrl, {
    credentials: "include",
    headers: { Range: `bytes=0-${maxBytes - 1}` },
  })
  if (!response.ok) throw new Error("media fingerprint request failed")

  const bytes = await readPrefix(response, maxBytes)
  if (bytes.byteLength === 0) throw new Error("media fingerprint response is empty")
  return {
    algorithm: "md5",
    scope: "prefix",
    bytes: bytes.byteLength,
    value: md5Hex(bytes),
  }
}

export function mediaFingerprintError(nonce: string): AdapterPageResponse {
  return {
    source: HOUKAGO_ADAPTER_CLIENT_SOURCE,
    protocolVersion: HOUKAGO_ADAPTER_PROTOCOL_VERSION,
    nonce,
    type: "ERROR",
    ok: false,
    error: { code: "ADAPTER_ERROR", message: "Media fingerprint unavailable" },
  }
}

async function readPrefix(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    const full = new Uint8Array(await response.arrayBuffer())
    return full.byteLength > maxBytes ? full.slice(0, maxBytes) : full
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < maxBytes) {
      const next = await reader.read()
      if (next.done) break
      if (next.value.byteLength === 0) continue
      const remaining = maxBytes - total
      const chunk = next.value.byteLength > remaining ? next.value.slice(0, remaining) : next.value
      chunks.push(chunk)
      total += chunk.byteLength
      if (chunk.byteLength < next.value.byteLength) {
        await reader.cancel()
        break
      }
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
  } catch {
    return false
  }
}

const SHIFT_AMOUNTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]
const ROUND_CONSTANTS = Array.from(
  { length: 64 },
  (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0,
)

function md5Hex(input: Uint8Array): string {
  const paddedLength = ((input.byteLength + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(input)
  padded[input.byteLength] = 0x80
  const bitLength = input.byteLength * 8
  for (let index = 0; index < 8; index += 1) {
    padded[paddedLength - 8 + index] = (bitLength / 2 ** (8 * index)) & 0xff
  }

  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476
  const words = new Uint32Array(16)

  for (let offset = 0; offset < padded.byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const start = offset + index * 4
      words[index] =
        (padded[start] ?? 0) |
        ((padded[start + 1] ?? 0) << 8) |
        ((padded[start + 2] ?? 0) << 16) |
        ((padded[start + 3] ?? 0) << 24)
    }

    const originalA = a
    const originalB = b
    const originalC = c
    const originalD = d
    for (let index = 0; index < 64; index += 1) {
      let functionValue: number
      let wordIndex: number
      if (index < 16) {
        functionValue = (b & c) | (~b & d)
        wordIndex = index
      } else if (index < 32) {
        functionValue = (d & b) | (~d & c)
        wordIndex = (5 * index + 1) % 16
      } else if (index < 48) {
        functionValue = b ^ c ^ d
        wordIndex = (3 * index + 5) % 16
      } else {
        functionValue = c ^ (b | ~d)
        wordIndex = (7 * index) % 16
      }
      const next =
        (a + functionValue + (ROUND_CONSTANTS[index] ?? 0) + (words[wordIndex] ?? 0)) >>> 0
      const shift = SHIFT_AMOUNTS[index] ?? 0
      const rotated = (next << shift) | (next >>> (32 - shift))
      a = d
      d = c
      c = b
      b = (b + rotated) >>> 0
    }
    a = (a + originalA) >>> 0
    b = (b + originalB) >>> 0
    c = (c + originalC) >>> 0
    d = (d + originalD) >>> 0
  }

  return [a, b, c, d]
    .flatMap((word) => [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, word >>> 24])
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
