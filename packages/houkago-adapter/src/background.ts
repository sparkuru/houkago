import { firefoxDlinkResolver } from "./dlink-exchange"
import { MediaGrantRegistry } from "./grants"
import { configuredServerOrigin, extensionOriginPattern } from "./host-policy"
import { installFirefoxNetworkPort } from "./network/firefox"
import { createAdapterRuntime } from "./runtime"
import { browserStorage } from "./storage"
import type { FirefoxBrowser } from "./types"

declare const browser: FirefoxBrowser

const deploymentServerOrigin = configuredServerOrigin()
const initialSentinelUrls = deploymentServerOrigin
  ? [extensionOriginPattern(deploymentServerOrigin)]
  : ["http://*/*", "https://*/*"]
const storage = browserStorage(browser)
const grants = new MediaGrantRegistry()
let stopNetwork = installFirefoxNetworkPort(browser, grants, initialSentinelUrls)
const runtime = createAdapterRuntime({
  browser: "firefox",
  storage,
  async requestServerOrigin(pattern) {
    if (await browser.permissions.contains({ origins: [pattern] })) return true
    return browser.permissions.request({ origins: [pattern] })
  },
  onPaired(serverBase) {
    stopNetwork()
    stopNetwork = installFirefoxNetworkPort(browser, grants, [extensionOriginPattern(serverBase)])
  },
  installGrant(grant) {
    grants.install(grant)
  },
  revokeGrants() {
    grants.clear()
  },
  resolveDlink: firefoxDlinkResolver(browser),
})

browser.runtime.onMessage.addListener((message, sender) =>
  runtime.handle(message, sender.url, sender.tab?.id),
)

setInterval(() => {
  void runtime.poll().catch(() => {
    console.warn("houkago-adapter: pending Baidu request check failed")
  })
}, 3_000)
