import { cn } from "@/lib/utils"
import { type VariantProps, cva } from "class-variance-authority"
import type { ComponentProps } from "react"
const buttonVariants = cva(
  "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-md px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[var(--color-accent-strong)]",
        secondary: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
)
export function Button({
  className,
  variant,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}
