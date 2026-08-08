export type BaiduOauthWindow = {
  opener: unknown
  readonly closed: boolean
  location: { replace: (url: string) => void }
  close: () => void
}

type BaiduOauthWindowHost = {
  open: (url?: string, target?: string) => BaiduOauthWindow | null
}

export function openBaiduOauthWindow(host: BaiduOauthWindowHost): BaiduOauthWindow | null {
  const popup = host.open("about:blank", "houkago-baidu-oauth")
  if (!popup) return null
  popup.opener = null
  return popup
}

export function navigateBaiduOauthWindow(popup: BaiduOauthWindow, authorizationUrl: string): void {
  popup.location.replace(authorizationUrl)
}

export function baiduOauthWindowClosed(popup: BaiduOauthWindow | null): boolean {
  return popup?.closed === true
}
