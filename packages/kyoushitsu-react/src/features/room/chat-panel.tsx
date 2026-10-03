import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useState } from "react"
import type { RoomRuntime, RoomState } from "./room-runtime"

export function ChatPanel({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const [message, setMessage] = useState("")
  const [sendError, setSendError] = useState("")

  function send(content: string, kind: "chat" | "danmaku"): void {
    if (!content || !room.can("chat") || state.command !== null) return
    if (kind === "danmaku" && content.length > 500) {
      setSendError("弹幕最多500字。")
      return
    }
    const sent = kind === "danmaku" ? room.danmaku(content) : room.chat(content)
    if (sent) {
      setMessage("")
      setSendError("")
    } else {
      setSendError("房间连接不可用，请重试。")
    }
  }

  return (
    <Card className="room-chat-panel">
      <h2>聊天室</h2>
      <ol className="room-feed" aria-label="聊天室消息">
        {state.chat.map((line, index) => (
          <li key={`${line.ts}:${line.senderId}:${index}`}>
            {line.kind === "danmaku" && (
              <>
                <small>[{t("chatDanmakuBadge")}]</small>{" "}
              </>
            )}
            <strong>{state.names[line.senderId] ?? line.senderId}</strong>：{line.content}
          </li>
        ))}
      </ol>
      <form
        className="room-chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          send(message.trim(), "chat")
        }}
      >
        <Label htmlFor="chat-message">{t("oshaberiLabel")}</Label>
        <Input
          id="chat-message"
          value={message}
          disabled={!room.can("chat") || state.command !== null}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t("messagePlaceholder")}
        />
        <div className="room-chat-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={!room.can("chat") || state.command !== null || !message.trim()}
            onClick={() => send(message.trim(), "danmaku")}
          >
            弹幕
          </Button>
          <Button
            type="submit"
            disabled={!room.can("chat") || state.command !== null || !message.trim()}
          >
            {t("send")}
          </Button>
        </div>
        {sendError && (
          <p className="room-chat-send-error" role="alert">
            {sendError}
          </p>
        )}
      </form>
    </Card>
  )
}
