import { expect, test } from "bun:test"
import {
  WS_AUTHORITY_FIELDS,
  baiduAvailabilityKey,
  bangumiBootstrapKey,
  danmakuCandidatesKey,
  danmakuSearchKey,
  grantWorkflowKey,
  identityMeKey,
  isPrivateResourceKey,
  isWsAuthorityField,
  isWsAuthorityKey,
  providerFilesKey,
  providerStatusKey,
  purgePrivateResourceKeys,
  purgePrivateResources,
  roomBootstrapKey,
  roomCommandInvalidations,
  siteConfigKey,
} from "../src/api/resources/keys"
import { RESOURCE_POLICIES, isReplayableResource, shouldRetry } from "../src/api/resources/policy"

test("resource keys include identity and search dimensions without secret material", () => {
  const first = danmakuCandidatesKey({
    sessionScope: "session-1",
    roomId: "room-1",
    enmokuId: "enmoku-1",
    sourceId: "source-1",
    releaseId: "release-1",
    duration: 123,
    fingerprint: "fingerprint-1",
    fingerprintBytes: 64,
    query: "  My   Search ",
    cursor: "cursor-1",
  })
  const normalized = danmakuCandidatesKey({
    sessionScope: "session-1",
    roomId: "room-1",
    enmokuId: "enmoku-1",
    sourceId: "source-1",
    releaseId: "release-1",
    duration: 123,
    fingerprint: "fingerprint-1",
    fingerprintBytes: 64,
    query: "my search",
    cursor: "cursor-1",
  })

  expect(first).toEqual(normalized)
  expect(first).not.toEqual(
    danmakuCandidatesKey({
      sessionScope: "session-1",
      roomId: "room-2",
      enmokuId: "enmoku-1",
      sourceId: "source-1",
      query: "my search",
    }),
  )
  expect(first).not.toEqual(
    danmakuCandidatesKey({
      sessionScope: "session-1",
      roomId: "room-1",
      enmokuId: "enmoku-1",
      sourceId: "source-2",
      query: "my search",
    }),
  )
  expect(JSON.stringify(first)).not.toContain("access-token")
  expect(providerFilesKey("baidu", "session-1", "docs", "cursor-2")).toEqual([
    "baiduFilesList",
    "baidu",
    "session-1",
    "docs",
    "cursor-2",
  ])
})

test("private resource purge leaves public config and identifies every private family", () => {
  const publicKey = siteConfigKey()
  const privateKeys = [
    identityMeKey("session-1"),
    roomBootstrapKey("session-1", "room-1"),
    bangumiBootstrapKey("session-1", "room-1", "generation-1"),
    providerStatusKey("baidu", "session-1"),
    baiduAvailabilityKey("session-1", "room-1", "source-1"),
    grantWorkflowKey("session-1", "room-1", "source-1", "workflow-1"),
  ]

  expect(privateKeys.every(isPrivateResourceKey)).toBe(true)
  expect(purgePrivateResourceKeys([publicKey, ...privateKeys])).toEqual([publicKey])
})

test("WebSocket-owned room authority is separate from HTTP resource policies", () => {
  expect(WS_AUTHORITY_FIELDS).toEqual([
    "admission",
    "permissions",
    "roster",
    "currentPlayback",
    "liveQueue",
  ])
  expect(isWsAuthorityKey(["ws-authority", "room-1", "liveQueue"])).toBe(true)
  expect(isWsAuthorityKey(roomBootstrapKey("session-1", "room-1"))).toBe(false)
  expect(isWsAuthorityField("liveQueue")).toBe(true)
  expect(isWsAuthorityField("bangumi")).toBe(false)
  expect(RESOURCE_POLICIES.roomLiveAuthority.authority).toBe("ws")
  expect(isReplayableResource("roomLiveAuthority")).toBe(false)
})

test("resource policies make auth and command retries explicit", () => {
  expect(RESOURCE_POLICIES.siteConfig).toMatchObject({
    authority: "http",
    staleTimeMs: Number.POSITIVE_INFINITY,
    refetchOnFocus: false,
    refetchOnReconnect: false,
  })
  expect(RESOURCE_POLICIES.providerFiles).toMatchObject({
    enabledWhen: "active-panel",
    abortOnDisable: true,
    purgeOnLogout: true,
  })
  expect(RESOURCE_POLICIES.grantWorkflow).toMatchObject({
    enabledWhen: "preparation",
    cacheable: false,
    replayable: false,
  })

  expect(shouldRetry("identityMe", { status: 401 }, 0)).toBe(false)
  expect(shouldRetry("identityMe", { status: 403 }, 0)).toBe(false)
  expect(shouldRetry("identityMe", { status: 422 }, 0)).toBe(false)
  expect(shouldRetry("identityMe", { status: 503 }, 0)).toBe(true)
  expect(shouldRetry("identityMe", { status: 503 }, 1)).toBe(false)
  expect(shouldRetry("grantWorkflow", { status: 503 }, 0)).toBe(false)
  expect(shouldRetry("identityMe", { kind: "aborted" }, 0)).toBe(false)
  expect(shouldRetry("identityMe", { kind: "protocol" }, 0)).toBe(false)
  expect(shouldRetry("identityMe", { kind: "network" }, 0)).toBe(true)
  expect(shouldRetry("command", { status: 503 }, 0)).toBe(false)
  expect(RESOURCE_POLICIES.identityMe.enabledWhen).toBe("always")
  expect(RESOURCE_POLICIES.identityCommand.enabledWhen).toBe("always")
  expect(shouldRetry("identityCommand", { kind: "network" }, 0)).toBe(false)
})

test("bootstrap keys isolate accounts and generations, while provider paths stay distinct", () => {
  expect(roomBootstrapKey("session-1", "room-1")).not.toEqual(
    roomBootstrapKey("session-2", "room-1"),
  )
  expect(bangumiBootstrapKey("session-1", "room-1", "1")).not.toEqual(
    bangumiBootstrapKey("session-1", "room-1", "2"),
  )
  expect(providerFilesKey("baidu", "session-1", "/docs ")).not.toEqual(
    providerFilesKey("baidu", "session-1", "/docs"),
  )
  expect(danmakuSearchKey("session-1", "  My   Search ")).toEqual(
    danmakuSearchKey("session-1", "my search"),
  )
  expect(roomCommandInvalidations("session-1", "room-1", "1")).toEqual([
    roomBootstrapKey("session-1", "room-1"),
    bangumiBootstrapKey("session-1", "room-1", "1"),
  ])
})

test("logout cancels private requests before removing private cache state", async () => {
  const steps: string[] = []
  const identity = identityMeKey("session-1")
  const config = siteConfigKey()
  await purgePrivateResources({
    async cancel(matches) {
      expect(matches(identity)).toBe(true)
      expect(matches(config)).toBe(false)
      steps.push("cancel")
    },
    remove(matches) {
      expect(matches(identity)).toBe(true)
      expect(matches(config)).toBe(false)
      steps.push("remove")
    },
  })
  expect(steps).toEqual(["cancel", "remove"])
})
