import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--border-subtle)] bg-[var(--bg-surface-1)] text-[var(--text-on-light)] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_6px_rgba(20,41,95,0.08)]",
        secondary:
          "border-[rgba(255,138,31,0.4)] bg-[var(--surface-highlight-gradient)] text-[var(--text-on-accent)] shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_8px_18px_-12px_rgba(255,138,31,0.4)]",
        destructive:
          "border-[rgba(241,93,114,0.4)] bg-[linear-gradient(180deg,#ff758f,#f14070)] text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset]",
        outline: "border-[color:var(--border-subtle)] bg-[rgba(20,41,95,0.05)] text-[var(--text-secondary)]",
        dark: "border-white/12 bg-[rgba(255,255,255,0.08)] text-[var(--text-on-dark)] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
