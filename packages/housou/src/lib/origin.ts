import { Forbidden } from "./errors"

const DEFAULT_ORIGIN = "http://127.0.0.1:5173"

export function allowedOrigin(): string {
  return process.env.HOUKAGO_CORS_ORIGIN ?? DEFAULT_ORIGIN
}

export function isOpenDevelopmentOrigin(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.HOUKAGO_CORS_ORIGIN
}

export function corsOrigin(): string | true {
  return isOpenDevelopmentOrigin() ? true : allowedOrigin()
}

export function isTrustedOrigin(origin: string | null | undefined): boolean {
  return isOpenDevelopmentOrigin() || origin === allowedOrigin()
}

export function requireTrustedOrigin(origin: string | null | undefined): void {
  if (!isTrustedOrigin(origin)) {
    throw new Forbidden("untrusted request origin")
  }
}
