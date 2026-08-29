import { createPinia } from "pinia"
import { createApp } from "vue"
import App from "./App.vue"
import { housou } from "./api"
import "./assets/theme.css"
import { SITE_CONFIG_KEY, applySiteConfigTitle, createSiteConfigLoader } from "./lib/site-config"
import { applyTheme } from "./lib/theme"
import { router } from "./router"

const loadSiteConfig = createSiteConfigLoader(() => housou["site-config"].get())

async function bootstrap(): Promise<void> {
  applyTheme(document.documentElement)
  const siteConfig = await loadSiteConfig()
  applySiteConfigTitle(siteConfig)
  createApp(App).provide(SITE_CONFIG_KEY, siteConfig).use(createPinia()).use(router).mount("#app")
}

void bootstrap()
