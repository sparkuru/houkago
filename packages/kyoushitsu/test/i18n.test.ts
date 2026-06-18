import { expect, test } from "bun:test"
import { DEFAULT_LOCALE, t } from "../src/i18n"

test("default locale is Chinese", () => {
  expect(DEFAULT_LOCALE).toBe("zh-CN")
})

test("frontend labels are served from i18n", () => {
  expect(t("playbackControl")).toBe("播放控制")
  expect(t("playlistPermission")).toBe("片源选择")
  expect(t("allowed")).toBe("允许")
  expect(t("reject")).toBe("拒绝")
  expect(t("bangumiHeading")).toBe("番组表")
})
