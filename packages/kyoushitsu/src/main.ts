import { createPinia } from "pinia"
import { createApp } from "vue"
import App from "./App.vue"
import "./assets/theme.css"
import { applyTheme } from "./lib/theme"
import { router } from "./router"

applyTheme(document.documentElement)

createApp(App).use(createPinia()).use(router).mount("#app")
