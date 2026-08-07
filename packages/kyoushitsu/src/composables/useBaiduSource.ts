import {
  createBaiduSource,
  deleteBaiduEnmoku,
  fetchBaiduStatus,
  listServerBaiduFiles,
  revokeBaiduConnection,
  startBaiduOauth,
} from "@/api/baidu"
import { detectAndPairBaiduAdapter } from "@/composables/baidu-adapter"
import { t } from "@/i18n"
import {
  type BaiduOauthWindow,
  navigateBaiduOauthWindow,
  openBaiduOauthWindow,
} from "@/lib/baidu-oauth-window"
import {
  type BaiduBrowserState,
  type BaiduClientState,
  isMobileBaiduClient,
} from "@/lib/baidu-provider"
import { permitCreatedUserHeldSource } from "@/lib/baidu-source-creation"
import { AdapterBridgeError, adapterCapabilityReady, houkagoAdapter } from "@/lib/houkago-adapter"
import { housouUrl } from "@/lib/housou-url"
import {
  type AdapterHello,
  BAIDU_ACCOUNT_USER_HELD_CAPABILITY,
  BAIDU_FILES_READ_CAPABILITY,
  BAIDU_MEDIA_HEADERS_CAPABILITY,
  type BaiduConnectionStatus,
  type BaiduDirectoryPage,
  type BaiduFileEntry,
  type BaiduRetentionMode,
  type Enmoku,
} from "houkago-kousoku"
import { onBeforeUnmount, ref } from "vue"

export function useBaiduSource(bushitsuId: string) {
  const status = ref<BaiduConnectionStatus | null>(null)
  const adapterHello = ref<AdapterHello | null>(null)
  const clientState = ref<BaiduClientState>(initialClientState())
  const connectionLoading = ref(false)
  const connectionError = ref("")
  const browserState = ref<BaiduBrowserState>("idle")
  const directoryPage = ref<BaiduDirectoryPage | null>(null)
  const directoryPath = ref("/")
  const selectedFile = ref<BaiduFileEntry | null>(null)
  const browserError = ref("")
  const adding = ref(false)
  let oauthWindow: BaiduOauthWindow | null = null
  let pendingOauthMode: BaiduRetentionMode | null = null
  let waitingForOauthReturn = false

  async function detectAdapterInternal(): Promise<void> {
    if (clientState.value === "mobile") return
    const detection = await detectAndPairBaiduAdapter()
    adapterHello.value = detection.hello
    clientState.value = detection.state
    if (detection.pairingFailed) connectionError.value = t("baiduPairingFailed")
  }

  async function detectAdapter(): Promise<void> {
    connectionLoading.value = true
    connectionError.value = ""
    await detectAdapterInternal()
    connectionLoading.value = false
  }

  async function refreshStatus(): Promise<boolean> {
    connectionError.value = ""
    try {
      const { data } = await fetchBaiduStatus()
      status.value = data ?? null
      return data !== null
    } catch {
      connectionError.value = t("baiduDirectoryError")
      return false
    }
  }

  async function refresh(): Promise<void> {
    connectionLoading.value = true
    connectionError.value = ""
    await Promise.all([detectAdapterInternal(), refreshStatus()])
    connectionLoading.value = false
  }

  async function authorize(mode: BaiduRetentionMode): Promise<void> {
    oauthWindow?.close()
    const popup = openBaiduOauthWindow(window)
    if (!popup) {
      connectionError.value = t("baiduPopupBlocked")
      return
    }
    oauthWindow = popup
    connectionLoading.value = true
    connectionError.value = ""
    try {
      const deviceId = mode === "user-held" ? adapterHello.value?.deviceId : undefined
      if (mode === "user-held" && !userHeldCapabilitiesReady(adapterHello.value)) {
        connectionError.value = t("baiduAdapterIncompatible")
        popup.close()
        oauthWindow = null
        return
      }
      const { data } = await startBaiduOauth(mode, deviceId)
      if (!data) {
        connectionError.value = t("baiduDirectoryError")
        popup.close()
        oauthWindow = null
        return
      }
      pendingOauthMode = mode
      navigateBaiduOauthWindow(popup, data.authorizationUrl)
      waitingForOauthReturn = true
      window.removeEventListener("focus", finishAuthorization)
      window.addEventListener("focus", finishAuthorization)
    } catch {
      connectionError.value = t("baiduDirectoryError")
      popup.close()
      oauthWindow = null
    } finally {
      connectionLoading.value = false
    }
  }

  async function finishAuthorization(): Promise<void> {
    if (!waitingForOauthReturn) return
    waitingForOauthReturn = false
    window.removeEventListener("focus", finishAuthorization)
    oauthWindow = null
    if (pendingOauthMode === "user-held") {
      try {
        await houkagoAdapter.redeemOauthHandoff(housouUrl())
      } catch {
        connectionError.value = t("baiduDirectoryError")
      }
    }
    pendingOauthMode = null
    await refreshStatus()
  }

  async function revoke(): Promise<void> {
    connectionLoading.value = true
    connectionError.value = ""
    try {
      const { error } = await revokeBaiduConnection()
      if (error) {
        connectionError.value = t("baiduRevokeFailed")
        return
      }

      const adapterWasReady = clientState.value === "ready"
      browserState.value = "disconnected"
      directoryPage.value = null
      directoryPath.value = "/"
      selectedFile.value = null
      browserError.value = ""

      let localCleanupFailed = false
      if (adapterWasReady) {
        try {
          await houkagoAdapter.revokeBaidu()
        } catch {
          localCleanupFailed = true
        }
        adapterHello.value = null
        clientState.value = initialClientState()
        await detectAdapterInternal()
      }
      status.value = {
        enabled: status.value?.enabled ?? true,
        serverSavedEnabled: status.value?.serverSavedEnabled ?? false,
        connected: false,
        adaptorOnline: false,
      }
      await refreshStatus()
      if (localCleanupFailed && clientState.value !== "ready") {
        connectionError.value = t("baiduLocalCleanupFailed")
      }
    } catch {
      connectionError.value = t("baiduRevokeFailed")
    } finally {
      connectionLoading.value = false
    }
  }

  async function loadDirectory(path = directoryPath.value): Promise<void> {
    directoryPath.value = path
    selectedFile.value = null
    browserState.value = "loading"
    browserError.value = ""
    try {
      const connection = status.value
      if (!connection?.connected) {
        browserState.value =
          connection?.reason === "reconnect-required" ? "expired" : "disconnected"
        return
      }
      let page: BaiduDirectoryPage | null = null
      if (connection.retentionMode === "user-held") {
        if (!userHeldCapabilitiesReady(adapterHello.value)) {
          browserState.value = "disconnected"
          return
        }
        page = await houkagoAdapter.listBaiduFiles(path)
      } else {
        const response = await listServerBaiduFiles(path)
        page = response.data ?? null
      }
      if (!page) {
        browserState.value = "error"
        browserError.value = t("baiduDirectoryError")
        return
      }
      directoryPage.value = page
      directoryPath.value = page.path
      browserState.value = "ready"
    } catch (error) {
      browserState.value =
        error instanceof AdapterBridgeError && error.code === "ADAPTER_TIMEOUT"
          ? "disconnected"
          : "error"
      browserError.value = t("baiduDirectoryError")
    }
  }

  function selectFile(entry: BaiduFileEntry): void {
    if (!entry.isDirectory && entry.mediaType === "video") selectedFile.value = entry
  }

  async function addSelected(): Promise<Enmoku | null> {
    const entry = selectedFile.value
    if (!entry || adding.value) return null
    adding.value = true
    browserError.value = ""
    try {
      const userHeld = status.value?.retentionMode === "user-held"
      const { data } = await createBaiduSource(bushitsuId, entry, userHeld ? entry.id : undefined)
      if (!data || data.provider?.kind !== "baidu") {
        browserState.value = "error"
        browserError.value = t("sourceAddFailed")
        return null
      }
      if (userHeld) {
        await permitCreatedUserHeldSource(data, bushitsuId, entry.id, {
          permit: (sourceId, roomId, upstreamHandle) =>
            houkagoAdapter.permitBaiduSource(sourceId, roomId, upstreamHandle),
          rollback: (enmokuId) => deleteBaiduEnmoku(bushitsuId, enmokuId),
        })
      }
      browserState.value = "success"
      return data
    } catch {
      browserState.value = "error"
      browserError.value = t("sourceAddFailed")
      return null
    } finally {
      adding.value = false
    }
  }

  onBeforeUnmount(() => {
    waitingForOauthReturn = false
    window.removeEventListener("focus", finishAuthorization)
    oauthWindow?.close()
  })

  return {
    status,
    adapterHello,
    clientState,
    connectionLoading,
    connectionError,
    browserState,
    directoryPage,
    directoryPath,
    selectedFile,
    browserError,
    adding,
    refresh,
    detectAdapter,
    refreshStatus,
    authorize,
    revoke,
    loadDirectory,
    selectFile,
    addSelected,
  }
}

function initialClientState(): BaiduClientState {
  if (typeof navigator === "undefined") return "missing"
  return isMobileBaiduClient(navigator.userAgent, navigator.maxTouchPoints) ? "mobile" : "missing"
}

function userHeldCapabilitiesReady(hello: AdapterHello | null): boolean {
  return (
    adapterCapabilityReady(hello, BAIDU_ACCOUNT_USER_HELD_CAPABILITY) &&
    adapterCapabilityReady(hello, BAIDU_FILES_READ_CAPABILITY) &&
    adapterCapabilityReady(hello, BAIDU_MEDIA_HEADERS_CAPABILITY)
  )
}
