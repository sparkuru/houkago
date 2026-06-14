import { afterEach, beforeEach, expect, test } from "bun:test"
import { buinId } from "../src/lib/identity"

// LAN 明文 HTTP（非 secure context）では crypto.randomUUID が未定義になり
// buinId() が崩れて全站白屏した回帰の防止テスト。
// getRandomValues は全 context で使えるので fallback が v4 を返すことを確認する。

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const savedCrypto = globalThis.crypto
const savedLocalStorage = (globalThis as { localStorage?: Storage }).localStorage

function fakeLocalStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: fakeLocalStorage(),
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: savedCrypto,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, "localStorage", {
    value: savedLocalStorage,
    configurable: true,
    writable: true,
  })
})

test("randomUUID 欠如（非 secure context）でも合法 v4 を返す", () => {
  Object.defineProperty(globalThis, "crypto", {
    value: { getRandomValues: savedCrypto.getRandomValues.bind(savedCrypto) },
    configurable: true,
    writable: true,
  })
  expect(buinId()).toMatch(V4)
})

test("randomUUID 欠如でも二次呼び出しは持久一致（localStorage）", () => {
  Object.defineProperty(globalThis, "crypto", {
    value: { getRandomValues: savedCrypto.getRandomValues.bind(savedCrypto) },
    configurable: true,
    writable: true,
  })
  const first = buinId()
  expect(buinId()).toBe(first)
})

test("randomUUID あり（secure context）では従来通り動く", () => {
  expect(buinId()).toMatch(V4)
})
