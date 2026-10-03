import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig({
  input: "packages/kyoushitsu-core/openapi.json",
  output: "packages/kyoushitsu-core/src/api/generated",
  plugins: [
    { name: "@hey-api/client-fetch", throwOnError: false },
    { name: "@hey-api/sdk", client: "@hey-api/client-fetch", responseStyle: "fields" },
  ],
})
