import type { ReactNode } from "react"

export type PlayerIconName =
  | "play"
  | "pause"
  | "volume"
  | "muted"
  | "settings"
  | "cinema"
  | "web"
  | "fullscreen"
  | "exit"
  | "chat"
  | "danmaku"

const paths: Record<PlayerIconName, ReactNode> = {
  play: <path d="m9 5 11 7-11 7Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  volume: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4Z" />
      <path d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4Z" />
      <path d="m17 9 5 6m0-6-5 6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16M9 4v6m6 4v6" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  cinema: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <path d="M3 9h18M3 15h18" />
    </>
  ),
  web: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 8h18m-5 5 3-3m-3 0h3v3" />
    </>
  ),
  fullscreen: <path d="M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5" />,
  exit: <path d="M9 4v5H4m11-5v5h5M4 15h5v5m6 0v-5h5" />,
  chat: <path d="M4 5h16v12H9l-5 4Zm4 4h8m-8 4h5" />,
  danmaku: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h4m3 0h3M7 13h10" />
    </>
  ),
}

export function PlayerIcon({ name, struck = false }: { name: PlayerIconName; struck?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
      {struck && <path d="m3 21 18-18" />}
    </svg>
  )
}
