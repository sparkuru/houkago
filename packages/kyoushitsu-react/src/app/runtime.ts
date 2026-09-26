import type { QueryClient } from "@tanstack/react-query"
import type { SiteConfig } from "houkago-kousoku"
import {
  HoukagoHttpError,
  configureHousouHttpClient,
  createRoom,
  fetchIdentityMe,
  fetchSiteConfig,
  identityMeKey,
  purgePrivateResources,
  registerIdentity,
  signInIdentity,
  signOutIdentity,
  siteConfigKey,
} from "houkago-kyoushitsu/http"
import type { IdentityMeResponse, IdentitySignInData } from "houkago-kyoushitsu/http/generated"
import type { MessageKey } from "houkago-kyoushitsu/i18n"
import { createSiteConfigLoader } from "houkago-kyoushitsu/site-config"
import { createQueryClient, resourceQueryOptions } from "./query-client"

export type Identity = IdentityMeResponse | null
export type RuntimeState = {
  epoch: number
  phase: "restoring" | "ready" | "error"
  command: "auth" | "logout" | "create" | null
  feedback: MessageKey | null
}
export type RuntimeServices = {
  me: typeof fetchIdentityMe
  register: typeof registerIdentity
  signIn: typeof signInIdentity
  signOut: typeof signOutIdentity
  create: typeof createRoom
  config: typeof fetchSiteConfig
}
const defaultServices: RuntimeServices = {
  me: fetchIdentityMe,
  register: registerIdentity,
  signIn: signInIdentity,
  signOut: signOutIdentity,
  create: createRoom,
  config: fetchSiteConfig,
}

export function shouldFallbackConfig(error: unknown): boolean {
  return (
    error instanceof HoukagoHttpError &&
    (error.kind === "http" ||
      error.kind === "network" ||
      (error.kind === "protocol" && error.code === "EMPTY_RESPONSE"))
  )
}

export class AppRuntime {
  readonly queryClient: QueryClient
  private state: RuntimeState = { epoch: 0, phase: "restoring", command: null, feedback: null }
  private listeners = new Set<() => void>()
  private operations = new Set<AbortController>()
  private configController = new AbortController()
  private bootstrapPromise?: Promise<void>
  private disposed = false
  private configLoader: () => Promise<SiteConfig>

  constructor(
    private services: RuntimeServices = defaultServices,
    queryClient = createQueryClient(),
  ) {
    this.queryClient = queryClient
    this.configLoader = createSiteConfigLoader(
      async () => ({
        data: await services.config({ signal: this.configController.signal }),
        error: null,
      }),
      console.warn,
      { shouldFallbackOnFailure: shouldFallbackConfig },
    )
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  readonly getSnapshot = () => this.state
  readonly subscribeQueries = (listener: () => void) =>
    this.queryClient.getQueryCache().subscribe(listener)
  identityKey() {
    return identityMeKey(`epoch:${this.state.epoch}`)
  }
  identity(): Identity | undefined {
    return this.queryClient.getQueryData<Identity>(this.identityKey())
  }
  private update(next: Partial<RuntimeState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }
  private active(epoch: number, controller?: AbortController) {
    return !this.disposed && this.state.epoch === epoch && !controller?.signal.aborted
  }
  private assertActive(epoch: number, controller?: AbortController) {
    if (!this.active(epoch, controller))
      throw new HoukagoHttpError("aborted", "Operation belongs to an inactive identity epoch")
  }

  bootstrap(): Promise<void> {
    this.bootstrapPromise ??= Promise.allSettled([
      this.queryClient.fetchQuery({
        queryKey: siteConfigKey(),
        queryFn: () => this.configLoader(),
        ...resourceQueryOptions("siteConfig"),
      }),
      this.restore(),
    ]).then(() => undefined)
    return this.bootstrapPromise
  }

  async restore(): Promise<void> {
    if (this.disposed || this.state.command) return
    await this.restoreIdentity(this.state.epoch)
  }

  private async restoreIdentity(epoch: number): Promise<void> {
    if (!this.active(epoch)) return
    this.update({ phase: "restoring" })
    try {
      await this.queryClient.fetchQuery({
        queryKey: this.identityKey(),
        ...resourceQueryOptions("identityMe"),
        queryFn: async ({ signal }): Promise<Identity> => {
          try {
            const identity = await this.services.me({ signal })
            this.assertActive(epoch)
            return identity
          } catch (error) {
            this.assertActive(epoch)
            if (
              error instanceof HoukagoHttpError &&
              error.status === 401 &&
              error.code === "UNAUTHORIZED"
            )
              return null
            throw error
          }
        },
      })
      if (this.active(epoch)) this.update({ phase: "ready" })
    } catch {
      if (this.active(epoch)) this.update({ phase: "error", feedback: "sessionRestoreFailed" })
    }
  }

  private async fence(): Promise<number> {
    for (const controller of this.operations) controller.abort()
    this.operations.clear()
    this.update({ epoch: this.state.epoch + 1, phase: "restoring" })
    const epoch = this.state.epoch
    try {
      await purgePrivateResources({
        cancel: (matches) =>
          this.queryClient.cancelQueries({ predicate: (query) => matches(query.queryKey) }),
        remove: (matches) =>
          this.queryClient.removeQueries({ predicate: (query) => matches(query.queryKey) }),
      })
    } catch {
      // Epoch fencing and owned AbortControllers still prevent old completions.
    }
    return epoch
  }

  private async command<T>(
    name: string,
    epoch: number,
    execute: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController()
    this.operations.add(controller)
    const cache = this.queryClient.getMutationCache()
    const mutation = cache.build<T, unknown, { operation: string; epoch: number }, unknown>(
      this.queryClient,
      {
        mutationKey: [name, `epoch:${epoch}`],
        retry: false,
        gcTime: 0,
        mutationFn: async () => {
          this.assertActive(epoch, controller)
          const result = await execute(controller.signal)
          this.assertActive(epoch, controller)
          return result
        },
      },
    )
    try {
      return await mutation.execute({ operation: name, epoch })
    } finally {
      this.operations.delete(controller)
      cache.remove(mutation)
    }
  }

  async authenticate(
    mode: "register" | "sign-in",
    body: IdentitySignInData["body"],
  ): Promise<void> {
    if (this.state.command || this.state.phase !== "ready" || this.identity()) return
    this.update({ command: "auth", feedback: null })
    const epoch = await this.fence()
    try {
      const identity = await this.command(mode, epoch, (signal) =>
        this.services[mode === "register" ? "register" : "signIn"](body, { signal }),
      )
      this.assertActive(epoch)
      this.queryClient.setQueryData(this.identityKey(), identity)
      this.update({ phase: "ready" })
    } catch {
      if (this.active(epoch)) {
        await this.restoreIdentity(epoch)
        this.update({ feedback: mode === "register" ? "registerFailed" : "signInFailed" })
      }
    } finally {
      if (this.active(epoch)) this.update({ command: null })
    }
  }

  async logout(): Promise<void> {
    if (this.state.command || this.state.phase !== "ready" || !this.identity()) return
    this.update({ command: "logout", feedback: null })
    const epoch = await this.fence()
    try {
      await this.command("sign-out", epoch, (signal) => this.services.signOut({ signal }))
      this.assertActive(epoch)
      this.queryClient.setQueryData(this.identityKey(), null)
      this.update({ phase: "ready" })
    } catch {
      if (this.active(epoch)) {
        await this.restoreIdentity(epoch)
        this.update({ feedback: "signOutFailed" })
      }
    } finally {
      if (this.active(epoch)) this.update({ command: null })
    }
  }

  async create(name: string): Promise<string | undefined> {
    if (this.state.command || this.state.phase !== "ready" || !this.identity()) return
    const epoch = this.state.epoch
    this.update({ command: "create", feedback: null })
    let id: string | undefined
    try {
      id = (
        await this.command("room-create", epoch, (signal) =>
          this.services.create({ name }, { signal }),
        )
      ).id
    } catch {
      if (this.active(epoch)) this.update({ feedback: "createBushitsuFailed" })
    } finally {
      if (this.active(epoch)) this.update({ command: null })
    }
    return this.active(epoch) ? id : undefined
  }

  dispose(): void {
    this.disposed = true
    this.configController.abort()
    for (const operation of this.operations) operation.abort()
    this.operations.clear()
    void this.queryClient.cancelQueries().catch(() => undefined)
    this.queryClient.clear()
    this.listeners.clear()
  }
}

export function createAppRuntime(): AppRuntime {
  configureHousouHttpClient()
  return new AppRuntime()
}
