import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"
export function Label({
  className,
  htmlFor,
  children,
  ...props
}: ComponentProps<"label"> & { htmlFor: string }) {
  return (
    <label
      htmlFor={htmlFor}
      data-slot="label"
      className={cn("block text-sm font-medium", className)}
      {...props}
    >
      {children}
    </label>
  )
}
