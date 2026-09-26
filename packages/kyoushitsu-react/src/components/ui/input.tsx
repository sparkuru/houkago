import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "min-h-[44px] w-full min-w-0 rounded-md border border-input bg-[var(--entry-field-surface)] px-3 py-2 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}
