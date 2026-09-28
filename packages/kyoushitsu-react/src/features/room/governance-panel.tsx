import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Kengen, NyuushitsuMode } from "houkago-kousoku"
import { t } from "houkago-kyoushitsu/i18n"
import { useEffect, useState } from "react"
import type { RoomRuntime, RoomState } from "./room-runtime"

export function GovernancePanel({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const [modeDraft, setModeDraft] = useState<NyuushitsuMode>(state.mode)
  const [password, setPassword] = useState("")
  useEffect(() => setModeDraft(state.mode), [state.mode])
  const busy = state.command !== null
  if (!room.isHost) return null
  return (
    <Card>
      <h2>{t("roomInfoHeading")}</h2>
      <div className="room-form">
        <Label htmlFor="admission-mode">{t("nyuushitsuModeHeading")}</Label>
        <select
          id="admission-mode"
          value={modeDraft}
          disabled={busy}
          onChange={(event) => setModeDraft(event.target.value as NyuushitsuMode)}
        >
          <option value="open">{t("nyuushitsuModeOpen")}</option>
          <option value="approval">{t("nyuushitsuModeApproval")}</option>
          <option value="closed">{t("nyuushitsuModeClosed")}</option>
          <option value="password">{t("nyuushitsuModePassword")}</option>
        </select>
        {modeDraft === "password" && (
          <>
            <Label htmlFor="admission-password">{t("nyuushitsuPasswordLabel")}</Label>
            <Input
              id="admission-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
            <p>{t("nyuushitsuModePasswordHint")}</p>
          </>
        )}
        <Button
          disabled={busy || (modeDraft === "password" && !password.trim())}
          onClick={() => {
            room.setAdmission(modeDraft, modeDraft === "password" ? password : undefined)
            setPassword("")
          }}
        >
          保存入室方式
        </Button>
        <h3>{t("kengenPolicyCurrent")}</h3>
        {(["chat", "playlist", "playback"] as const).map((key) => (
          <label key={key} className="room-check">
            <input
              type="checkbox"
              checked={state.permissions[key]}
              disabled={busy}
              onChange={(event) =>
                room.setPermissions({
                  ...state.permissions,
                  [key]: event.target.checked,
                } as Kengen)
              }
            />
            {key === "chat"
              ? t("chatPermission")
              : key === "playlist"
                ? "选片"
                : t("playbackControl")}
          </label>
        ))}
        {state.pending.length > 0 && (
          <>
            <h3>{t("roomInfoPending")}</h3>
            {state.pending.map((request) => (
              <div key={request.senderId} className="room-row">
                <span>{request.nickname}</span>
                <div className="room-actions">
                  <Button disabled={busy} onClick={() => room.decide(request.senderId, true)}>
                    承认
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => room.decide(request.senderId, false)}
                  >
                    {t("reject")}
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
        <h3>{t("durableMembersHeading")}</h3>
        {state.meibo.map((member) => (
          <div key={member.id} className="room-row">
            <span>{member.username}</span>
            {member.id !== room.identityId && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t("removeMemberTitle"))) void room.removeMember(member.id)
                }}
              >
                {t("removeMember")}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
