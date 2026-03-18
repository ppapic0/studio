import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[11.5px] font-bold tracking-[-0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(20,41,95,0.18)] bg-white text-[#14295F] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_2px_6px_rgba(20,41,95,0.08)]",
        secondary:
          "border-[#e87010]/60 bg-[linear-gradient(180deg,#ff9a48,#ff7a16)] text-white shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_2px_6px_rgba(255,122,22,0.22)]",
        destructive:
          "border-rose-400/60 bg-[linear-gradient(180deg,#ff758f,#f14070)] text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset]",
        outline: "border-[rgba(20,41,95,0.16)] bg-[rgba(20,41,95,0.05)] text-[#14295F]",
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
