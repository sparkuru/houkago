import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig({
  input: "packages/kyoushitsu/openapi.json",
  output: "packages/kyoushitsu/src/api/generated",
  plugins: [
    { name: "@hey-api/client-fetch", throwOnError: false },
    { name: "@hey-api/sdk", client: "@hey-api/client-fetch", responseStyle: "fields" },
  ],
})
