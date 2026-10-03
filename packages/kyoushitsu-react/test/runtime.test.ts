import { describe, expect, test } from "bun:test"
import { createMemoryHistory } from "@tanstack/react-router"
import { DEFAULT_SITE_CONFIG } from "houkago-kousoku"
import { HoukagoHttpError, identityMeKey, siteConfigKey } from "houkago-kyoushitsu-core/http"
import { createAppRouter } from "../src/app/router"
import { AppRuntime, type RuntimeServices } from "../src/app/runtime"
const account = { id: "a", username: "alice", createdAt: 1 }
const unauthorized = () =>
  Promise.reject(new HoukagoHttpError("http", "Unauthorized", 401, "UNAUTHORIZED"))
function services(overrides: Partial<RuntimeServices> = {}): RuntimeServices {
  return {
    me: unauthorized,
    config: async () => DEFAULT_SITE_CONFIG,
    register: async () => account,
    signIn: async () => account,
    signOut: async () => ({ ok: true }),
    create: async (body) => ({ id: "room", name: body.name, buchouId: "a", createdAt: 1 }),
    ...overrides,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe("identity runtime", () => {
  test("UI cache subscription replay leaves root-owned requests alive and retains active identity until purge", async () => {
    const identity = deferred<typeof account>()
    const config = deferred<typeof DEFAULT_SITE_CONFIG>()
    let reads = 0
    let configs = 0
    let signal: AbortSignal | undefined
    const runtime = new AppRuntime(
      services({
        me: (options) => {
          reads++
          signal = options?.signal
          return identity.promise
        },
        config: () => {
          configs++
          return config.promise
        },
      }),
    )
    const boot = runtime.bootstrap()
    const unsubscribe = runtime.subscribeQueries(() => {})
    unsubscribe()
    const unsubscribeReplayed = runtime.subscribeQueries(() => {})
    unsubscribeReplayed()
    identity.resolve(account)
    config.resolve(DEFAULT_SITE_CONFIG)
    await boot
    expect(reads).toBe(1)
    expect(configs).toBe(1)
    expect(signal?.aborted).toBe(false)
    expect(runtime.identity()).toEqual(account)
    expect(runtime.getSnapshot().phase).toBe("ready")
    const key = runtime.identityKey()
    const query = runtime.queryClient.getQueryCache().find({ queryKey: key })
    expect(query?.getObserversCount()).toBe(0)
    expect(query?.gcTime).toBe(Number.POSITIVE_INFINITY)
    const publicConfig = runtime.queryClient.getQueryData<typeof DEFAULT_SITE_CONFIG>(
      siteConfigKey(),
    )
    await runtime.logout()
    expect(runtime.queryClient.getQueryData(key)).toBeUndefined()
    expect(runtime.queryClient.getQueryData<typeof DEFAULT_SITE_CONFIG>(siteConfigKey())).toBe(
      publicConfig,
    )
    runtime.dispose()
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
  test("actual lazy Router preload leaves history and all home/room work untouched", async () => {
    let reads = 0
    const runtime = new AppRuntime(
      services({
        me: async () => {
          reads++
          return account
        },
        config: async () => {
          reads++
          return DEFAULT_SITE_CONFIG
        },
      }),
    )
    const router = createAppRouter(runtime)
    const history = createMemoryHistory({ initialEntries: ["/"] })
    router.update({ history, context: { runtime } })
    const matches = await router.preloadRoute({
      to: "/bushitsu/$id",
      params: { id: "preloaded-room" },
    })
    expect(matches?.some((match) => match.routeId === "/bushitsu/$id")).toBe(true)
    expect(history.location.href).toBe("/")
    expect(reads).toBe(0)
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(runtime.getSnapshot().epoch).toBe(0)
    runtime.dispose()
  })
  test("StrictMode/repeated bootstrap shares config and identity; real 401 is anonymous", async () => {
    let reads = 0
    let configs = 0
    const runtime = new AppRuntime(
      services({
        me: () => {
          reads++
          return unauthorized()
        },
        config: async () => {
          configs++
          return DEFAULT_SITE_CONFIG
        },
      }),
    )
    expect(runtime.bootstrap()).toBe(runtime.bootstrap())
    await runtime.bootstrap()
    expect(reads).toBe(1)
    expect(configs).toBe(1)
    expect(runtime.identity()).toBeNull()
    expect(runtime.getSnapshot().phase).toBe("ready")
    runtime.dispose()
  })
  test("transient read retries once and exposes recoverable failure", async () => {
    let reads = 0
    const runtime = new AppRuntime(
      services({
        me: async () => {
          reads++
          throw new HoukagoHttpError("network", "Failed")
        },
      }),
    )
    await runtime.bootstrap()
    expect(reads).toBe(2)
    expect(runtime.identity()).toBeUndefined()
    expect(runtime.getSnapshot().phase).toBe("error")
    await runtime.restore()
    expect(reads).toBe(4)
    runtime.dispose()
  })
  test("auth is serialized, no replay or retained credentials; public cache survives", async () => {
    const pending = deferred<typeof account>()
    let calls = 0
    const runtime = new AppRuntime(
      services({
        signIn: async () => {
          calls++
          return pending.promise
        },
      }),
    )
    await runtime.bootstrap()
    const command = runtime.authenticate("sign-in", {
      username: "alice",
      password: "secret-password",
    })
    await Promise.resolve()
    await runtime.authenticate("sign-in", { username: "alice", password: "secret-password" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(1)
    expect(
      JSON.stringify(
        runtime.queryClient
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state.variables),
      ),
    ).not.toContain("secret-password")
    pending.resolve(account)
    await command
    expect(runtime.identity()).toEqual(account)
    expect(runtime.queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(runtime.queryClient.getQueryData<typeof DEFAULT_SITE_CONFIG>(siteConfigKey())).toEqual(
      DEFAULT_SITE_CONFIG,
    )
    runtime.dispose()
  })
  test("failed signout reconciles previous identity and reports failure, never success", async () => {
    let reads = 0
    let signouts = 0
    const runtime = new AppRuntime(
      services({
        me: async () => {
          reads++
          return account
        },
        signOut: async () => {
          signouts++
          throw new HoukagoHttpError("http", "Failed", 503)
        },
      }),
    )
    await runtime.bootstrap()
    await runtime.logout()
    expect(reads).toBe(2)
    expect(signouts).toBe(1)
    expect(runtime.identity()).toEqual(account)
    expect(runtime.getSnapshot().feedback).toBe("signOutFailed")
    expect(runtime.getSnapshot().epoch).toBe(1)
    expect(runtime.queryClient.getQueryData(identityMeKey("epoch:0"))).toBeUndefined()
    runtime.dispose()
  })
  test("failed registration keeps command ownership through delayed identity reconciliation", async () => {
    const pending = deferred<typeof account>()
    let reads = 0
    let registers = 0
    const runtime = new AppRuntime(
      services({
        me: () => (++reads === 1 ? unauthorized() : pending.promise),
        register: async () => {
          registers++
          throw new HoukagoHttpError("http", "Taken", 409, "USERNAME_TAKEN")
        },
      }),
    )
    await runtime.bootstrap()
    const command = runtime.authenticate("register", {
      username: "alice",
      password: "secret-password",
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(runtime.getSnapshot().command).toBe("auth")
    expect(runtime.getSnapshot().phase).toBe("restoring")
    await runtime.restore()
    await runtime.authenticate("register", { username: "alice", password: "secret-password" })
    expect(reads).toBe(2)
    expect(registers).toBe(1)
    pending.resolve(account)
    await command
    expect(runtime.getSnapshot().command).toBeNull()
    expect(runtime.getSnapshot().feedback).toBe("registerFailed")
    runtime.dispose()
  })
  test("uncertain signout can reconcile anonymous; failed reconciliation stays blocked", async () => {
    let reads = 0
    const runtime = new AppRuntime(
      services({
        me: async () => {
          if (++reads === 1) return account
          throw new HoukagoHttpError("http", "Forbidden", 403)
        },
        signOut: async () => {
          throw new HoukagoHttpError("network", "Uncertain")
        },
      }),
    )
    await runtime.bootstrap()
    await runtime.logout()
    expect(runtime.getSnapshot().phase).toBe("error")
    expect(runtime.identity()).toBeUndefined()
    await runtime.authenticate("sign-in", { username: "alice", password: "secret-password" })
    expect(runtime.identity()).toBeUndefined()
    runtime.dispose()
  })
  test("purges private data even if cancel rejects", async () => {
    const runtime = new AppRuntime(services({ me: async () => account }))
    await runtime.bootstrap()
    runtime.queryClient.setQueryData(["roomGet", "old", "r"], { private: true })
    runtime.queryClient.cancelQueries = async () => {
      throw new Error("cancel failed")
    }
    await runtime.logout()
    expect(runtime.identity()).toBeNull()
    expect(runtime.queryClient.getQueryData(["roomGet", "old", "r"])).toBeUndefined()
    expect(
      runtime.queryClient.getQueryData<typeof DEFAULT_SITE_CONFIG>(siteConfigKey()),
    ).toBeDefined()
    runtime.dispose()
  })
  test("late non-cancellable restore cannot resurrect disposed cache", async () => {
    const pending = deferred<typeof account>()
    const runtime = new AppRuntime(services({ me: () => pending.promise }))
    const boot = runtime.bootstrap()
    runtime.dispose()
    pending.resolve(account)
    await boot
    expect(runtime.queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
  test("late auth and create results after disposal cannot commit or navigate", async () => {
    const auth = deferred<typeof account>()
    const runtime = new AppRuntime(services({ signIn: () => auth.promise }))
    await runtime.bootstrap()
    const command = runtime.authenticate("sign-in", {
      username: "alice",
      password: "secret-password",
    })
    await new Promise((r) => setTimeout(r, 0))
    runtime.dispose()
    auth.resolve(account)
    await command
    expect(runtime.identity()).toBeUndefined()
    const room = deferred<{ id: string; name: string; buchouId: string; createdAt: number }>()
    const signedIn = new AppRuntime(
      services({ me: async () => account, create: () => room.promise }),
    )
    await signedIn.bootstrap()
    const create = signedIn.create("name")
    await new Promise((r) => setTimeout(r, 0))
    signedIn.dispose()
    room.resolve({ id: "late", name: "name", buchouId: "a", createdAt: 1 })
    expect(await create).toBeUndefined()
  })
  test("create cannot return a navigation target after its completion listener disposes runtime", async () => {
    const runtime = new AppRuntime(services({ me: async () => account }))
    await runtime.bootstrap()
    let creating = false
    runtime.subscribe(() => {
      if (runtime.getSnapshot().command === "create") creating = true
      else if (creating && runtime.getSnapshot().command === null) runtime.dispose()
    })
    expect(await runtime.create("name")).toBeUndefined()
    expect(runtime.identity()).toBeUndefined()
  })
  test("create cannot return a navigation target after its completion listener changes identity epoch", async () => {
    const runtime = new AppRuntime(services({ me: async () => account }))
    await runtime.bootstrap()
    let creating = false
    let logout: Promise<void> | undefined
    runtime.subscribe(() => {
      if (runtime.getSnapshot().command === "create") creating = true
      else if (creating && runtime.getSnapshot().command === null) {
        creating = false
        logout = runtime.logout()
      }
    })
    expect(await runtime.create("name")).toBeUndefined()
    await logout
    expect(runtime.identity()).toBeNull()
    runtime.dispose()
  })
})
