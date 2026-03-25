import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex touch-manipulation items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold tracking-[-0.015em] ring-offset-background transition-[transform,filter,background-color,border-color,opacity] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97] active:brightness-[0.93] will-change-transform select-none",
  {
    variants: {
      variant: {
        default:
          "border border-[rgba(20,41,95,0.18)] bg-white text-[#14295F] hover:bg-[#f4f7ff] shadow-sm",
        destructive:
          "bg-rose-500 text-white border border-rose-600 hover:bg-rose-600 shadow-sm",
        outline:
          "border border-[rgba(20,41,95,0.18)] bg-white text-[#14295F] hover:bg-[#f0f4ff] shadow-sm",
        secondary:
          "bg-[#FF7A16] text-white border border-[#d96000] hover:bg-[#e86800] shadow-sm",
        ghost:
          "border border-transparent bg-transparent text-[#14295F] hover:bg-[rgba(20,41,95,0.06)]",
        link: "text-primary underline-offset-4 hover:underline",
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
