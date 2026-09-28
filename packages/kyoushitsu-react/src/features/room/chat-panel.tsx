import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "houkago-kyoushitsu/i18n"
import { useState } from "react"
import type { RoomRuntime, RoomState } from "./room-runtime"

export function ChatPanel({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const [message, setMessage] = useState("")
  return (
    <Card>
      <h2>聊天室</h2>
      <ol className="room-feed" aria-label="聊天室消息">
        {state.chat.map((line, index) => (
          <li key={`${line.ts}:${line.senderId}:${index}`}>
            <strong>{state.names[line.senderId] ?? line.senderId}</strong>{" "}
            {line.kind === "danmaku" && <small>{t("chatDanmakuBadge")}</small>}
            <p>{line.content}</p>
          </li>
        ))}
      </ol>
      <form
        className="room-chat-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (room.chat(message.trim())) setMessage("")
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
        <Button
          type="submit"
          disabled={!room.can("chat") || state.command !== null || !message.trim()}
        >
          {t("send")}
        </Button>
      </form>
    </Card>
  )
}
