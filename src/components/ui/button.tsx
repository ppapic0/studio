import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-black tracking-[-0.02em] ring-offset-background transition-[transform,box-shadow,background-color,color,border-color,filter] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] will-change-transform",
  {
    variants: {
      variant: {
        default:
          "border border-[#213e7a] bg-[linear-gradient(180deg,#1f4a8f_0%,#14295f_52%,#0d1f49_100%)] text-white shadow-[0_16px_30px_rgba(20,41,95,0.22),0_6px_14px_rgba(20,41,95,0.12),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-[1.03] hover:shadow-[0_20px_34px_rgba(20,41,95,0.25),0_8px_18px_rgba(20,41,95,0.14),inset_0_1px_0_rgba(255,255,255,0.24)]",
        destructive:
          "border border-rose-300 bg-[linear-gradient(180deg,#ff8aa6_0%,#f25580_54%,#dd315f_100%)] text-white shadow-[0_16px_30px_rgba(242,85,128,0.22),0_6px_14px_rgba(242,85,128,0.12),inset_0_1px_0_rgba(255,255,255,0.22)] hover:brightness-[1.03]",
        outline:
          "border border-[#14295F]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,249,255,0.98)_100%)] text-[#14295F] shadow-[0_14px_28px_rgba(20,41,95,0.08),0_5px_12px_rgba(20,41,95,0.05),inset_0_1px_0_rgba(255,255,255,0.95)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(241,246,255,1)_100%)] hover:shadow-[0_18px_32px_rgba(20,41,95,0.10),0_7px_16px_rgba(20,41,95,0.06),inset_0_1px_0_rgba(255,255,255,0.96)]",
        secondary:
          "border border-[#ff9848] bg-[linear-gradient(180deg,#ff9a48_0%,#ff7a16_48%,#ea6400_100%)] text-white shadow-[0_16px_30px_rgba(255,122,22,0.22),0_6px_14px_rgba(255,122,22,0.12),inset_0_1px_0_rgba(255,255,255,0.4)] hover:brightness-[1.03]",
        ghost: "border border-transparent bg-white/70 text-[#14295F] shadow-sm hover:border-[#14295F]/10 hover:bg-white hover:text-[#14295F]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[0.95rem] px-3",
        lg: "h-11 rounded-[1.05rem] px-8",
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
