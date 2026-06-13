import { treaty } from "@elysiajs/eden"
import type { App } from "houkago-housou"

// Eden Treaty client against housou's exported App type — REST is typed
// end-to-end at compile time (type-safety spec). Components never bare-fetch;
// they go through this client. A backend contract change becomes a compile
// error here.
const HOUSOU_URL = import.meta.env.VITE_HOUSOU_URL ?? "http://localhost:3000"

export const housou = treaty<App>(HOUSOU_URL)
