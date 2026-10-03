// housou (control plane) base URL. Explicit `VITE_HOUSOU_URL` wins; otherwise
// derive from the host the SPA was actually loaded from and the preview port.
// This makes localhost AND LAN-IP access both reach housou without a rebuild —
// the control plane is a separate origin from 教室 (design §2), so a hardcoded
// "localhost" would point a LAN visitor's browser at its own machine.
export function housouUrl(): string {
  return (
    import.meta.env.VITE_HOUSOU_URL ??
    `http://${location.hostname}:${import.meta.env.VITE_HOUSOU_PORT ?? 3000}`
  )
}
