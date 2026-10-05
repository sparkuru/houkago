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
import { detectBaiduAdapter } from "houkago-kyoushitsu-core/baidu-adapter-detection"
import { redeemBaiduOauthHandoffWithRetry } from "houkago-kyoushitsu-core/baidu-oauth-handoff"
import {
  type BaiduOauthWindow,
  baiduOauthWindowClosed,
  navigateBaiduOauthWindow,
  openBaiduOauthWindow,
} from "houkago-kyoushitsu-core/baidu-oauth-window"
import {
  type BaiduBrowserState,
  type BaiduClientState,
  baiduBreadcrumbs,
  baiduParentPath,
  formatBaiduFileSize,
  isMobileBaiduClient,
} from "houkago-kyoushitsu-core/baidu-provider"
import { permitCreatedUserHeldSource } from "houkago-kyoushitsu-core/baidu-source-creation"
import {
  AdapterBridgeError,
  adapterCapabilityReady,
  houkagoAdapter,
} from "houkago-kyoushitsu-core/houkago-adapter"
import { housouUrl } from "houkago-kyoushitsu-core/housou-url"
import {
  createBaiduSource,
  deleteRoomEnmoku,
  fetchBaiduFiles,
  fetchBaiduStatus,
  requestBaiduAdapterPairing,
  revokeBaiduConnection,
  startBaiduOauth,
} from "houkago-kyoushitsu-core/http"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useCallback, useEffect, useRef, useState } from "react"
import "./baidu-panel.css"

type DialogKind = "connection" | "files" | null
type Step = "adapter" | "retention" | "authorization"

export function BaiduPanel({
  roomId,
  canPlaylist,
  onAdded,
}: {
  roomId: string
  canPlaylist: boolean
  onAdded?: (enmoku: Enmoku) => void
}) {
  const initialClientState: BaiduClientState = isMobileBaiduClient(
    navigator.userAgent,
    navigator.maxTouchPoints,
  )
    ? "mobile"
    : "missing"
  const [clientState, setClientState] = useState<BaiduClientState>(initialClientState)
  const [hello, setHello] = useState<AdapterHello | null>(null)
  const [status, setStatus] = useState<BaiduConnectionStatus | null>(null)
  const [connectionBusy, setConnectionBusy] = useState(false)
  const [connectionError, setConnectionError] = useState("")
  const [step, setStep] = useState<Step>("adapter")
  const [mode, setMode] = useState<BaiduRetentionMode | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [browserState, setBrowserState] = useState<BaiduBrowserState>("idle")
  const [page, setPage] = useState<BaiduDirectoryPage | null>(null)
  const [path, setPath] = useState("/")
  const [selected, setSelected] = useState<BaiduFileEntry | null>(null)
  const [browserError, setBrowserError] = useState("")
  const [adding, setAdding] = useState(false)
  const connectionDialog = useRef<HTMLDialogElement>(null)
  const fileDialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const suppressCloseFocus = useRef<DialogKind>(null)
  const generation = useRef(0)
  const requestAbort = useRef<AbortController | null>(null)
  const statusRequest = useRef(0)
  const browseRequest = useRef(0)
  const oauthFlow = useRef(0)
  const oauth = useRef<{
    popup: BaiduOauthWindow
    mode: BaiduRetentionMode
    controller: AbortController
    redeeming: boolean
  } | null>(null)
  const focusListener = useRef<(() => void) | null>(null)

  const active = (scope: number) =>
    scope === generation.current && !requestAbort.current?.signal.aborted
  const userHeldReady = (value: AdapterHello | null) =>
    adapterCapabilityReady(value, BAIDU_ACCOUNT_USER_HELD_CAPABILITY) &&
    adapterCapabilityReady(value, BAIDU_FILES_READ_CAPABILITY) &&
    adapterCapabilityReady(value, BAIDU_MEDIA_HEADERS_CAPABILITY)

  const cancelOauth = useCallback((): void => {
    oauthFlow.current += 1
    if (focusListener.current) window.removeEventListener("focus", focusListener.current)
    focusListener.current = null
    oauth.current?.controller.abort()
    oauth.current?.popup.close()
    oauth.current = null
  }, [])

  useEffect(() => {
    if (!roomId) return
    const scope = ++generation.current
    const controller = new AbortController()
    requestAbort.current = controller
    // Strict Mode's cleanup cancels this timer before a duplicate pairing read.
    const timer = setTimeout(() => void refresh(scope), 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
      generation.current += 1
      statusRequest.current += 1
      browseRequest.current += 1
      cancelOauth()
    }
  }, [roomId, cancelOauth])

  useEffect(() => {
    if (canPlaylist) return
    browseRequest.current += 1
    setPage(null)
    setSelected(null)
    setPath("/")
    fileDialog.current?.close()
  }, [canPlaylist])

  async function detect(scope = generation.current): Promise<void> {
    if (clientState === "mobile") return
    const result = await detectBaiduAdapter({
      hello: () => houkagoAdapter.hello(),
      pair: (base, code) => houkagoAdapter.pair(base, code),
      requestPairing: async (deviceId, localPaired) => ({
        data: await requestBaiduAdapterPairing(deviceId, localPaired, {
          signal: requestAbort.current?.signal,
        }),
      }),
      serverBase: housouUrl,
    })
    if (!active(scope)) return
    setHello(result.hello)
    setClientState(result.state)
    if (result.pairingFailed) setConnectionError(t("baiduPairingFailed"))
  }

  async function refreshStatus(scope = generation.current): Promise<void> {
    const sequence = ++statusRequest.current
    try {
      const result = await fetchBaiduStatus({ signal: requestAbort.current?.signal })
      if (!active(scope) || sequence !== statusRequest.current) return
      setStatus(result)
      setStep(
        result.connected && result.reason !== "reconnect-required"
          ? "authorization"
          : clientState === "ready"
            ? "retention"
            : "adapter",
      )
    } catch {
      if (active(scope) && sequence === statusRequest.current)
        setConnectionError(t("baiduDirectoryError"))
    }
  }

  async function refresh(scope = generation.current): Promise<void> {
    setConnectionBusy(true)
    setConnectionError("")
    await Promise.all([detect(scope), refreshStatus(scope)])
    if (active(scope)) setConnectionBusy(false)
  }

  function openDialog(kind: DialogKind, preserveFocus = false): void {
    if (!preserveFocus)
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = kind === "connection" ? connectionDialog.current : fileDialog.current
    dialog?.showModal()
    queueMicrotask(() =>
      dialog?.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled)")?.focus(),
    )
  }

  function closeDialog(kind: DialogKind): void {
    const dialog = kind === "connection" ? connectionDialog.current : fileDialog.current
    dialog?.close()
  }

  function restoreFocus(): void {
    returnFocus.current?.focus()
    returnFocus.current = null
  }

  function onDialogClose(kind: DialogKind): void {
    if (suppressCloseFocus.current === kind) {
      suppressCloseFocus.current = null
      return
    }
    restoreFocus()
  }

  async function authorize(nextMode: BaiduRetentionMode): Promise<void> {
    cancelOauth()
    const flow = oauthFlow.current
    const popup = openBaiduOauthWindow(window)
    if (!popup) {
      setConnectionError(t("baiduPopupBlocked"))
      return
    }
    if (nextMode === "user-held" && !userHeldReady(hello)) {
      popup.close()
      setConnectionError(t("baiduAdapterIncompatible"))
      return
    }
    const controller = new AbortController()
    oauth.current = { popup, mode: nextMode, controller, redeeming: false }
    const scope = generation.current
    setConnectionBusy(true)
    setConnectionError("")
    try {
      const result = await startBaiduOauth(
        nextMode,
        nextMode === "user-held" ? hello?.deviceId : undefined,
        { signal: requestAbort.current?.signal },
      )
      if (!active(scope) || flow !== oauthFlow.current) return
      navigateBaiduOauthWindow(popup, result.authorizationUrl)
      const listener = () => void finishAuthorization(scope, flow)
      focusListener.current = listener
      window.addEventListener("focus", listener)
    } catch {
      if (active(scope) && flow === oauthFlow.current) {
        setConnectionError(t("baiduDirectoryError"))
        cancelOauth()
        setConnectionBusy(false)
      }
    } finally {
      if (active(scope) && flow === oauthFlow.current) setConnectionBusy(false)
    }
  }

  async function finishAuthorization(scope: number, flow: number): Promise<void> {
    const pending = oauth.current
    if (
      !pending ||
      !active(scope) ||
      flow !== oauthFlow.current ||
      pending.redeeming ||
      !baiduOauthWindowClosed(pending.popup)
    )
      return
    pending.redeeming = true
    setConnectionBusy(true)
    setConnectionError("")
    try {
      const redeemed =
        pending.mode !== "user-held" ||
        (await redeemBaiduOauthHandoffWithRetry(
          () => houkagoAdapter.redeemOauthHandoff(housouUrl()),
          {
            active: () => active(scope) && flow === oauthFlow.current,
            signal: pending.controller.signal,
            retryable: (error) =>
              error instanceof AdapterBridgeError && error.code === "ADAPTER_ERROR",
          },
        ))
      if (!active(scope) || flow !== oauthFlow.current) return
      if (!redeemed) {
        setConnectionError(t("baiduDirectoryError"))
        cancelOauth()
        return
      }
      cancelOauth()
      await refreshStatus(scope)
    } catch {
      if (active(scope) && flow === oauthFlow.current) {
        setConnectionError(t("baiduDirectoryError"))
        cancelOauth()
      }
    } finally {
      if (oauth.current === pending) pending.redeeming = false
      if (active(scope)) setConnectionBusy(false)
    }
  }

  async function revoke(): Promise<void> {
    const scope = generation.current
    cancelOauth()
    setConnectionBusy(true)
    setConnectionError("")
    try {
      await revokeBaiduConnection({ signal: requestAbort.current?.signal })
      if (!active(scope)) return
      statusRequest.current += 1
      browseRequest.current += 1
      setStatus((previous) => previous && { ...previous, connected: false, adaptorOnline: false })
      setPage(null)
      setPath("/")
      setSelected(null)
      setBrowserState("disconnected")
      setConfirmRevoke(false)
      setMode(null)
      setStep("retention")
      if (clientState === "ready") {
        try {
          await houkagoAdapter.revokeBaidu()
        } catch {
          if (active(scope)) setConnectionError(t("baiduLocalCleanupFailed"))
        }
        if (active(scope)) {
          setHello(null)
          setClientState(initialClientState)
          await detect(scope)
        }
      }
      if (active(scope)) await refreshStatus(scope)
    } catch {
      if (active(scope)) setConnectionError(t("baiduRevokeFailed"))
    } finally {
      if (active(scope)) setConnectionBusy(false)
    }
  }

  async function loadDirectory(nextPath: string, cursor?: string): Promise<void> {
    if (!canPlaylist) return
    const scope = generation.current
    const sequence = ++browseRequest.current
    if (!cursor) {
      setPath(nextPath)
      setSelected(null)
    }
    setBrowserState("loading")
    setBrowserError("")
    try {
      if (!status?.connected || status.reason === "reconnect-required") {
        setBrowserState(status?.reason === "reconnect-required" ? "expired" : "disconnected")
        return
      }
      const next =
        status.retentionMode === "user-held"
          ? userHeldReady(hello)
            ? await houkagoAdapter.listBaiduFiles(nextPath, cursor)
            : null
          : await fetchBaiduFiles(nextPath, cursor, { signal: requestAbort.current?.signal })
      if (!active(scope) || sequence !== browseRequest.current) return
      if (!next) {
        setBrowserState("disconnected")
        return
      }
      setPage((previous) =>
        cursor && previous?.path === next.path
          ? { ...next, entries: [...previous.entries, ...next.entries] }
          : next,
      )
      setPath(next.path)
      setBrowserState("ready")
    } catch (error) {
      if (!active(scope) || sequence !== browseRequest.current) return
      setBrowserState(
        error instanceof AdapterBridgeError && error.code === "ADAPTER_TIMEOUT"
          ? "disconnected"
          : "error",
      )
      setBrowserError(t("baiduDirectoryError"))
    }
  }

  async function addSelected(): Promise<void> {
    if (
      !canPlaylist ||
      !selected ||
      adding ||
      selected.isDirectory ||
      selected.mediaType !== "video"
    )
      return
    const scope = generation.current
    setAdding(true)
    setBrowserError("")
    try {
      const userHeld = status?.retentionMode === "user-held"
      const created = await createBaiduSource(
        {
          bushitsuId: roomId,
          fileId: selected.id,
          fileName: selected.name,
          ...(selected.size === undefined ? {} : { size: selected.size }),
          ...(userHeld ? { upstreamHandle: selected.id } : {}),
        },
        { signal: requestAbort.current?.signal },
      )
      if (!active(scope)) return
      if (userHeld) {
        await permitCreatedUserHeldSource(created, roomId, selected.id, {
          permit: (sourceId, bushitsuId, upstreamHandle) =>
            houkagoAdapter.permitBaiduSource(sourceId, bushitsuId, upstreamHandle),
          rollback: (enmokuId) =>
            deleteRoomEnmoku(roomId, enmokuId, { signal: requestAbort.current?.signal }),
        })
      }
      if (!active(scope)) return
      setBrowserState("success")
      onAdded?.(created)
    } catch {
      if (active(scope)) {
        setBrowserState("error")
        setBrowserError(t("sourceAddFailed"))
      }
    } finally {
      if (active(scope)) setAdding(false)
    }
  }

  const connected = status?.connected === true
  const reconnectRequired = status?.reason === "reconnect-required"
  const readyConnection = connected && !reconnectRequired
  const breadcrumbs = baiduBreadcrumbs(path)
  const parentPath = baiduParentPath(path)

  return (
    <section className="baidu-panel" aria-label={t("baiduProvider")}>
      <h2>{t("baiduProvider")}</h2>
      <p>
        {reconnectRequired
          ? t("baiduReconnectRequired")
          : readyConnection
            ? t("baiduConnected")
            : status?.enabled === false
              ? t("baiduIntegrationUnavailable")
              : t("baiduConnect")}
      </p>
      <div className="baidu-panel-actions">
        <button
          type="button"
          onClick={() => {
            setStep(
              readyConnection ? "authorization" : clientState === "ready" ? "retention" : "adapter",
            )
            setMode(reconnectRequired ? (status?.retentionMode ?? null) : null)
            openDialog("connection")
          }}
        >
          {t("baiduManageConnection")}
        </button>
        {canPlaylist && (
          <button
            type="button"
            disabled={clientState === "mobile"}
            onClick={() => {
              openDialog("files")
              void loadDirectory(path)
            }}
          >
            {t("baiduFileBrowserTitle")}
          </button>
        )}
      </div>
      {clientState === "mobile" && <output>{t("baiduDesktopRequired")}</output>}

      <dialog
        ref={connectionDialog}
        className="baidu-dialog"
        onClose={() => onDialogClose("connection")}
        onCancel={(event) => {
          if (confirmRevoke) {
            event.preventDefault()
            setConfirmRevoke(false)
          }
        }}
        aria-labelledby="baidu-connection-title"
      >
        <div className="baidu-dialog-header">
          <h2 id="baidu-connection-title">{t("baiduConnectionTitle")}</h2>
          <button type="button" onClick={() => closeDialog("connection")}>
            {t("providerDialogClose")}
          </button>
        </div>
        <div className="baidu-dialog-body">
          {connectionError && <p role="alert">{connectionError}</p>}
          {readyConnection ? (
            <>
              <p>
                {t("baiduConnected")}
                {status?.accountName ? ` · ${status.accountName}` : ""}
              </p>
              <p>
                {status?.retentionMode === "user-held"
                  ? t("baiduRetentionUserHeld")
                  : t("baiduRetentionServerSaved")}
              </p>
              {status?.reason === "adaptor-offline" && <output>{t("baiduOwnerOffline")}</output>}
              {confirmRevoke ? (
                <>
                  <p role="alert">{t("baiduRevokeConfirmIntro")}</p>
                  <button type="button" onClick={() => setConfirmRevoke(false)}>
                    {t("cancel")}
                  </button>
                  <button type="button" disabled={connectionBusy} onClick={() => void revoke()}>
                    {t("baiduRevokeConfirm")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={connectionBusy}
                  onClick={() => setConfirmRevoke(true)}
                >
                  {t("baiduRevoke")}
                </button>
              )}
            </>
          ) : step === "adapter" ? (
            <>
              <output>
                {clientState === "mobile"
                  ? t("baiduDesktopRequired")
                  : clientState === "missing"
                    ? t("baiduAdapterMissing")
                    : clientState === "incompatible"
                      ? t("baiduAdapterIncompatible")
                      : t("baiduAdapterReady")}
              </output>
              {status?.enabled === false && <output>{t("baiduIntegrationUnavailable")}</output>}
              <button
                type="button"
                disabled={connectionBusy || clientState === "mobile"}
                onClick={() => void refresh()}
              >
                {t("baiduCheckAgain")}
              </button>
              <button
                type="button"
                disabled={connectionBusy || clientState !== "ready" || status?.enabled === false}
                onClick={() => setStep("retention")}
              >
                {t("baiduContinue")}
              </button>
            </>
          ) : step === "retention" ? (
            <>
              <fieldset>
                <legend>{t("baiduRetentionTitle")}</legend>
                <label>
                  <input
                    type="radio"
                    name="baidu-retention"
                    value="server-saved"
                    checked={mode === "server-saved"}
                    disabled={status?.serverSavedEnabled === false}
                    onChange={() => setMode("server-saved")}
                  />
                  {t("baiduRetentionServerSaved")} · {t("baiduRetentionServerSavedRisk")}
                </label>
                <label>
                  <input
                    type="radio"
                    name="baidu-retention"
                    value="user-held"
                    checked={mode === "user-held"}
                    onChange={() => setMode("user-held")}
                  />
                  {t("baiduRetentionUserHeld")} · {t("baiduRetentionUserHeldRisk")}
                </label>
              </fieldset>
              <button type="button" disabled={!mode} onClick={() => setStep("authorization")}>
                {t("baiduContinue")}
              </button>
            </>
          ) : (
            <>
              <p>{t("baiduAuthorizeNotice")}</p>
              {connectionBusy && <output>{t("baiduAuthorizationPending")}</output>}
              <button
                type="button"
                disabled={!mode || connectionBusy}
                onClick={() => mode && void authorize(mode)}
              >
                {t("baiduOpenAuthorization")}
              </button>
            </>
          )}
        </div>
      </dialog>

      <dialog
        ref={fileDialog}
        className="baidu-dialog"
        onClose={() => onDialogClose("files")}
        aria-labelledby="baidu-files-title"
      >
        <div className="baidu-dialog-header">
          <h2 id="baidu-files-title">{t("baiduFileBrowserTitle")}</h2>
          <button type="button" disabled={adding} onClick={() => closeDialog("files")}>
            {t("providerDialogClose")}
          </button>
        </div>
        <div className="baidu-dialog-body">
          <nav aria-label={t("baiduBreadcrumbAria")} className="baidu-breadcrumbs">
            <button
              type="button"
              disabled={!parentPath || browserState === "loading"}
              onClick={() => parentPath && void loadDirectory(parentPath)}
            >
              {t("baiduBack")}
            </button>
            {breadcrumbs.map((crumb) => (
              <button
                key={crumb.path}
                type="button"
                disabled={crumb.path === path || browserState === "loading"}
                onClick={() => void loadDirectory(crumb.path)}
              >
                {crumb.label}
              </button>
            ))}
          </nav>
          {browserState === "loading" && <output>{t("baiduDirectoryLoading")}</output>}
          {(browserState === "disconnected" || browserState === "expired") && (
            <output>
              {browserState === "expired"
                ? t("baiduReconnectRequired")
                : t("baiduAdapterDisconnected")}
            </output>
          )}
          {browserState === "error" && (
            <p role="alert">{browserError || t("baiduDirectoryError")}</p>
          )}
          {browserState === "success" && <output>{t("baiduFileAdded")}</output>}
          {browserState === "ready" && page?.entries.length === 0 && (
            <output>{t("baiduDirectoryEmpty")}</output>
          )}
          {browserState === "ready" && (
            <ul className="baidu-file-list" aria-label={t("baiduDirectoryEntries")}>
              {page?.entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    className="baidu-file-row"
                    type="button"
                    disabled={!entry.isDirectory && entry.mediaType !== "video"}
                    aria-pressed={!entry.isDirectory ? selected?.id === entry.id : undefined}
                    onClick={() =>
                      entry.isDirectory ? void loadDirectory(entry.path) : setSelected(entry)
                    }
                  >
                    <span>{entry.isDirectory ? "▸" : "▶"}</span>
                    <span>{entry.name}</span>
                    <small>
                      {formatBaiduFileSize(entry.size)}
                      {!entry.isDirectory && entry.mediaType !== "video"
                        ? ` · ${t("baiduUnsupportedFile")}`
                        : ""}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {browserState === "ready" && page?.cursor && (
            <button type="button" onClick={() => void loadDirectory(path, page.cursor)}>
              {t("baiduContinue")}
            </button>
          )}
        </div>
        <div className="baidu-dialog-actions">
          <button
            type="button"
            onClick={() => {
              suppressCloseFocus.current = "files"
              closeDialog("files")
              queueMicrotask(() => openDialog("connection", true))
            }}
          >
            {t("baiduManageConnection")}
          </button>
          <span>
            {selected ? `${t("baiduSelectedFile")}: ${selected.name}` : t("baiduNoFileSelected")}
          </span>
          <button
            type="button"
            disabled={!selected || adding || browserState !== "ready"}
            onClick={() => void addSelected()}
          >
            {adding ? t("sourceAdding") : t("baiduAddSelected")}
          </button>
        </div>
      </dialog>
    </section>
  )
}
