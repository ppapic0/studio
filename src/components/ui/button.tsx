import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex touch-manipulation items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold tracking-[-0.015em] ring-offset-background transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] will-change-transform select-none",
  {
    variants: {
      variant: {
        default:
          "border border-[color:var(--border-subtle)] bg-[var(--bg-surface-1)] text-[var(--text-on-light)] shadow-[var(--shadow-card-soft)] hover:border-[color:var(--border-strong)] hover:bg-[var(--bg-surface-2)]",
        destructive:
          "border border-[rgba(241,93,114,0.45)] bg-[var(--danger)] text-white shadow-[0_12px_24px_-16px_rgba(241,93,114,0.55)] hover:brightness-105",
        outline:
          "border border-[color:var(--border-strong)] bg-transparent text-[var(--text-on-light)] hover:bg-[rgba(20,41,95,0.06)]",
        secondary:
          "border border-[rgba(255,138,31,0.35)] bg-[var(--accent-orange)] text-[var(--text-on-accent)] shadow-[var(--shadow-accent)] hover:brightness-[1.06]",
        dark:
          "border border-white/12 bg-[var(--surface-primary-gradient)] text-[var(--text-on-dark)] shadow-[var(--shadow-card-strong)] hover:bg-[var(--surface-secondary-gradient)]",
        ghost:
          "border border-transparent bg-transparent text-[var(--text-on-light)] hover:bg-[rgba(20,41,95,0.06)]",
        link: "text-[var(--accent-orange)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[0.8rem] px-3 text-xs",
        lg: "h-12 rounded-[1rem] px-8 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
