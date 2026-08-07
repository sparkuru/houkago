export type WebRequestDetails = {
  requestId: string
  url: string
  tabId: number
  method?: string
  requestHeaders?: Array<{ name: string; value?: string }>
}

export type WebRequestRedirectDetails = WebRequestDetails & { redirectUrl: string }

export type WebRequestHeadersReceivedDetails = WebRequestDetails & {
  statusCode?: number
  responseHeaders?: Array<{ name: string; value?: string }>
}

export type WebRequestEvent<T, R> = {
  addListener(
    listener: (details: T) => R,
    filter: { urls: string[]; types?: string[] },
    extraInfoSpec?: string[],
  ): void
  removeListener(listener: (details: T) => R): void
}

export type FirefoxBrowser = {
  runtime: {
    getURL(path: string): string
    sendMessage(message: unknown): Promise<unknown>
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: { url?: string; tab?: { id?: number } },
        ) => Promise<unknown> | unknown,
      ): void
    }
  }
  storage: {
    local: {
      get(keys?: string | string[]): Promise<Record<string, unknown>>
      set(values: Record<string, unknown>): Promise<void>
      remove(keys: string | string[]): Promise<void>
    }
  }
  permissions: {
    contains(permissions: { origins: string[] }): Promise<boolean>
    request(permissions: { origins: string[] }): Promise<boolean>
  }
  webRequest: {
    onBeforeRequest: WebRequestEvent<
      WebRequestDetails,
      { redirectUrl?: string; cancel?: boolean } | undefined
    >
    onBeforeSendHeaders: WebRequestEvent<
      WebRequestDetails,
      { requestHeaders?: Array<{ name: string; value?: string }> } | undefined
    >
    onBeforeRedirect: WebRequestEvent<WebRequestRedirectDetails, undefined>
    onHeadersReceived: WebRequestEvent<
      WebRequestHeadersReceivedDetails,
      { cancel?: boolean } | undefined
    >
    onCompleted: WebRequestEvent<WebRequestDetails, undefined>
    onErrorOccurred: WebRequestEvent<WebRequestDetails, undefined>
  }
}

export type ChromiumBrowser = {
  declarativeNetRequest: {
    updateSessionRules(options: {
      removeRuleIds: number[]
      addRules?: Array<Record<string, unknown>>
    }): Promise<void>
  }
}

export type ChromiumDlinkBrowser = ChromiumBrowser & {
  webRequest: {
    onBeforeSendHeaders: WebRequestEvent<WebRequestDetails, undefined>
    onHeadersReceived: WebRequestEvent<WebRequestHeadersReceivedDetails, undefined>
  }
}

export type ChromiumAlarms = {
  create(name: string, alarmInfo: { periodInMinutes: number }): void
  onAlarm: {
    addListener(listener: (alarm: { name: string }) => void): void
  }
}

export type AdapterStorage = {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
}
