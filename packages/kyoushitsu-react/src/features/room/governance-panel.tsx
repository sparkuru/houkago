import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Kengen, NyuushitsuMode } from "houkago-kousoku"
import { t } from "houkago-kyoushitsu-core/i18n"
import {
  KENGEN_PRESETS,
  type KengenPresetId,
  kengenPresetId,
} from "houkago-kyoushitsu-core/kengen-policy"
import { useEffect, useState } from "react"
import type { RoomRuntime, RoomState } from "./room-runtime"

export function GovernancePanel({ room, state }: { room: RoomRuntime; state: RoomState }) {
  const [modeDraft, setModeDraft] = useState<NyuushitsuMode>(state.mode)
  const [password, setPassword] = useState("")
  useEffect(() => setModeDraft(state.mode), [state.mode])
  const busy = state.command !== null
  const selectedPreset = kengenPresetId(state.permissions)
  if (!room.isHost) return null
  return (
    <Card className="room-controls-governance" aria-labelledby="room-controls-governance-heading">
      <div className="room-controls-section-heading">
        <h3 id="room-controls-governance-heading">{t("roomControlHeading")}</h3>
        <span className="room-controls-governance-badge">{t("buchouRole")}</span>
      </div>
      <fieldset className="room-controls-governance-section room-controls-admission room-form">
        <legend>{t("nyuushitsuSettingGroupAria")}</legend>
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
            <p className="room-controls-help">{t("nyuushitsuModePasswordHint")}</p>
          </>
        )}
        <Button
          className="room-controls-save-button"
          disabled={busy || (modeDraft === "password" && !password.trim())}
          onClick={() => {
            room.setAdmission(modeDraft, modeDraft === "password" ? password : undefined)
            setPassword("")
          }}
        >
          保存入室方式
        </Button>
      </fieldset>
      <section
        className="room-controls-governance-section room-controls-permission-management"
        aria-labelledby="room-controls-permission-form-heading"
      >
        <div className="room-controls-subsection-heading room-controls-permission-heading">
          <h4 id="room-controls-permission-form-heading">{t("guestKengenGroupAria")}</h4>
          <span
            className="room-controls-permission-current"
            data-state={selectedPreset === null ? "custom" : "preset"}
          >
            {presetLabel(selectedPreset)}
          </span>
        </div>
        <fieldset className="room-controls-preset-fieldset">
          <legend>{t("kengenPresetGroupAria")}</legend>
          <div className="room-controls-preset-segmented">
            {KENGEN_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                className="room-controls-preset-option"
                type="button"
                variant="secondary"
                aria-pressed={selectedPreset === preset.id}
                disabled={busy}
                onClick={() => {
                  if (selectedPreset !== preset.id) room.setPermissions({ ...preset.kengen })
                }}
              >
                {presetLabel(preset.id)}
              </Button>
            ))}
          </div>
        </fieldset>
        {selectedPreset === null && (
          <p className="room-controls-help">{t("kengenPolicyCustomNotice")}</p>
        )}
        <fieldset className="room-controls-permission-fieldset">
          <legend>{t("kengenPermissionDetails")}</legend>
          <div className="room-controls-permission-checks">
            {(["chat", "playlist", "playback"] as const).map((key) => (
              <label
                key={key}
                className="room-controls-permission-row"
                data-state={state.permissions[key] ? "allowed" : "blocked"}
              >
                <span className="room-controls-permission-copy">
                  <span className="room-controls-permission-name">
                    {key === "chat"
                      ? t("chatPermission")
                      : key === "playlist"
                        ? t("playlistPermission")
                        : t("playbackControl")}
                  </span>
                  <span className="room-controls-permission-state" aria-hidden="true">
                    {state.permissions[key] ? t("allowed") : t("blocked")}
                  </span>
                </span>
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
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      {state.pending.length > 0 && (
        <section
          className="room-controls-governance-section"
          aria-labelledby="room-controls-pending-heading"
        >
          <div className="room-controls-subsection-heading">
            <h4 id="room-controls-pending-heading">{t("roomInfoPending")}</h4>
            <span>{state.pending.length}</span>
          </div>
          <div className="room-controls-governance-list">
            {state.pending.map((request) => (
              <div key={request.senderId} className="room-controls-governance-row">
                <span className="room-controls-governance-name">{request.nickname}</span>
                <div className="room-actions">
                  <Button disabled={busy} onClick={() => room.decide(request.senderId, true)}>
                    {t("approve")}
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
          </div>
        </section>
      )}
      <section
        className="room-controls-governance-section"
        aria-labelledby="room-controls-roster-heading"
      >
        <div className="room-controls-subsection-heading">
          <h4 id="room-controls-roster-heading">{t("durableMembersHeading")}</h4>
          <span>{state.meibo.length}</span>
        </div>
        {state.meibo.length === 0 ? (
          <p className="room-controls-empty">{t("noDurableMembers")}</p>
        ) : (
          <div className="room-controls-governance-list">
            {state.meibo.map((member) => (
              <div key={member.id} className="room-controls-governance-row">
                <span className="room-controls-governance-name">{member.username}</span>
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
        )}
      </section>
    </Card>
  )
}

export function PermissionSummary({ permissions }: { permissions: Kengen }) {
  return (
    <p className="room-controls-permission-summary">
      {t("kengenPolicyCurrent")}：<strong>{presetLabel(kengenPresetId(permissions))}</strong>
    </p>
  )
}

function presetLabel(id: KengenPresetId | null): string {
  switch (id) {
    case "chat":
      return t("kengenPresetChat")
    case "playback":
      return t("kengenPresetPlayback")
    case "playlist":
      return t("kengenPresetPlaylist")
    default:
      return t("kengenPresetCustom")
  }
}
