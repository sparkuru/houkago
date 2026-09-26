import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
export function Alert({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-subtle)] p-4 text-destructive",
        className,
      )}
      {...props}
    />
  )
}
export function Status(props: ComponentProps<"div">) {
  return <div role="status" aria-live="polite" {...props} />
}
