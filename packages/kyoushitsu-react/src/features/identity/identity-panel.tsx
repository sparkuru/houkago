import { useIdentity } from "@/app/context"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "houkago-kyoushitsu-core/i18n"
import { useEffect, useRef, useState } from "react"

export function IdentityPanel() {
  const { runtime, state } = useIdentity()
  const [registering, setRegistering] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [revealed, setRevealed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const pending = state.command !== null
  useEffect(() => {
    if (state.phase === "ready" && !pending) input.current?.focus()
  }, [state.phase, pending])
  return (
    <Card className="entry-auth-card" aria-labelledby="auth-heading">
      <form
        className="entry-form grid gap-5"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault()
          if (pending) return
          const body = { username, password }
          setPassword("")
          setRevealed(false)
          void runtime.authenticate(registering ? "register" : "sign-in", body)
        }}
      >
        <header className="card-heading">
          <p className="card-kicker">{t("authDeskLabel")}</p>
          <h2 id="auth-heading">{t(registering ? "registerHeading" : "signInHeading")}</h2>
          <p>{t("authDeskHint")}</p>
        </header>
        <div className="grid gap-2">
          <Label htmlFor="username">{t("usernameLabel")}</Label>
          <Input
            ref={input}
            id="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            value={username}
            disabled={pending}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <div className="flex gap-2">
            <Input
              id="password"
              type={revealed ? "text" : "password"}
              autoComplete={registering ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={128}
              placeholder={t("passwordPlaceholder")}
              value={password}
              disabled={pending}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={pending}
              aria-label={t(revealed ? "hidePassword" : "showPassword")}
              aria-pressed={revealed}
              onClick={() => setRevealed(!revealed)}
            >
              {t(revealed ? "hide" : "show")}
            </Button>
          </div>
        </div>
        <Button className="entry-primary-action" type="submit" disabled={pending}>
          {t(
            pending ? "authProcessing" : registering ? "registerAndContinue" : "signInAndContinue",
          )}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setRegistering(!registering)
            setPassword("")
            setUsername("")
            setRevealed(false)
            input.current?.focus()
          }}
        >
          {t(registering ? "switchToSignIn" : "switchToRegister")}
        </Button>
      </form>
    </Card>
  )
}
