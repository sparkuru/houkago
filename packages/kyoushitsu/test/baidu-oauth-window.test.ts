import { expect, test } from "bun:test"
import {
  baiduOauthWindowClosed,
  navigateBaiduOauthWindow,
  openBaiduOauthWindow,
} from "../src/lib/baidu-oauth-window"

test("OAuth popup opens synchronously, drops opener, then navigates", () => {
  const navigations: string[] = []
  const popup = {
    opener: { unsafe: true },
    closed: false,
    location: { replace: (url: string) => navigations.push(url) },
    close: () => {},
  }
  const opened = openBaiduOauthWindow({
    open: (url, target) => {
      expect(url).toBe("about:blank")
      expect(target).toBe("houkago-baidu-oauth")
      return popup
    },
  })
  expect(opened).toBe(popup)
  expect(popup.opener).toBeNull()
  expect(baiduOauthWindowClosed(opened)).toBe(false)
  popup.closed = true
  expect(baiduOauthWindowClosed(opened)).toBe(true)
  if (opened) navigateBaiduOauthWindow(opened, "https://openapi.baidu.test/oauth")
  expect(navigations).toEqual(["https://openapi.baidu.test/oauth"])
})

test("OAuth popup reports a blocked window without navigation", () => {
  expect(openBaiduOauthWindow({ open: () => null })).toBeNull()
})
