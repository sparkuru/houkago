import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useCallback, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { RoomRuntime, RoomState } from "./room-runtime"

export function ChatPanel({
  room,
  state,
  composerContainer,
}: { room: RoomRuntime; state: RoomState; composerContainer?: HTMLElement | null }) {
  const [message, setMessage] = useState("")
  const [sendError, setSendError] = useState("")
  const composing = useRef(false)
  const resetComposition = useCallback(() => {
    composing.current = false
  }, [])

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

  const composer = (
    <form
      className="room-chat-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!composing.current) send(message.trim(), "chat")
      }}
    >
      <Label htmlFor="chat-message">{t("oshaberiLabel")}</Label>
      <Input
        ref={resetComposition}
        id="chat-message"
        value={message}
        disabled={!room.can("chat") || state.command !== null}
        onChange={(event) => setMessage(event.target.value)}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.nativeEvent.isComposing || composing.current)) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
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
  )

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
      {composerContainer ? createPortal(composer, composerContainer) : composer}
    </Card>
  )
}
