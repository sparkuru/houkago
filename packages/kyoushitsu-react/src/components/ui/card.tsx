import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn(
        "rounded-lg border border-outline bg-card p-6 text-card-foreground shadow-[var(--entry-card-elevation)]",
        className,
      )}
      {...props}
    />
  )
}
