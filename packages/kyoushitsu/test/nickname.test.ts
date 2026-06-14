import { afterEach, beforeEach, expect, test } from "bun:test"
import { loadNickname, saveNickname } from "../src/lib/nickname"

// ニックネーム持久化の純テスト：缺省 ""、save→load 往復。直接进房/刷新で名が残る前提。

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
  Object.defineProperty(globalThis, "localStorage", {
    value: savedLocalStorage,
    configurable: true,
    writable: true,
  })
})

test("未設定なら空文字を返す", () => {
  expect(loadNickname()).toBe("")
})

test("save した名前を load で読み戻す", () => {
  saveNickname("唯")
  expect(loadNickname()).toBe("唯")
})

test("save は上書きする", () => {
  saveNickname("梓")
  saveNickname("律")
  expect(loadNickname()).toBe("律")
})
