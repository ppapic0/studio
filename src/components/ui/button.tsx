import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold tracking-[-0.015em] ring-offset-background transition-[transform,box-shadow,background-color,color,border-color,filter] duration-100 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97] active:brightness-[0.97] will-change-transform select-none",
  {
    variants: {
      variant: {
        /* 네이비 주요 버튼 - Toss 스타일 입체감 */
        default:
          "border border-[#1a3570] bg-[linear-gradient(180deg,#1e4898_0%,#14295f_55%,#0c1d49_100%)] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.20)_inset,0_-2px_0_0_rgba(0,0,0,0.18)_inset,0_2px_6px_rgba(20,41,95,0.22),0_8px_20px_-4px_rgba(20,41,95,0.20)] hover:brightness-[1.04] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_-2px_0_0_rgba(0,0,0,0.18)_inset,0_4px_10px_rgba(20,41,95,0.26),0_12px_24px_-4px_rgba(20,41,95,0.22)]",
        /* 삭제/위험 버튼 */
        destructive:
          "border border-rose-500/60 bg-[linear-gradient(180deg,#ff758f_0%,#f14070_55%,#d92d5c_100%)] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_-2px_0_0_rgba(0,0,0,0.14)_inset,0_2px_6px_rgba(217,45,92,0.22),0_8px_18px_-4px_rgba(217,45,92,0.18)] hover:brightness-[1.04]",
        /* 화이트/아웃라인 버튼 - Toss 서피스 버튼 느낌 */
        outline:
          "border border-[rgba(20,41,95,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(246,249,255,0.99)_100%)] text-[#14295F] shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_-1px_0_0_rgba(20,41,95,0.05)_inset,0_1px_3px_rgba(20,41,95,0.05),0_4px_12px_-2px_rgba(20,41,95,0.08)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(240,246,255,1)_100%)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.97)_inset,0_-1px_0_0_rgba(20,41,95,0.06)_inset,0_2px_6px_rgba(20,41,95,0.07),0_6px_16px_-2px_rgba(20,41,95,0.10)]",
        /* 오렌지 강조 버튼 */
        secondary:
          "border border-[#e87010] bg-[linear-gradient(180deg,#ff9a48_0%,#ff7a16_52%,#e86800_100%)] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.38)_inset,0_-2px_0_0_rgba(0,0,0,0.12)_inset,0_2px_6px_rgba(255,122,22,0.24),0_8px_20px_-4px_rgba(255,122,22,0.20)] hover:brightness-[1.04]",
        /* 고스트 버튼 - 텍스트만 + 호버 배경 */
        ghost: "border border-transparent bg-transparent text-[#14295F] hover:border-[rgba(20,41,95,0.09)] hover:bg-[rgba(20,41,95,0.05)] hover:shadow-[0_1px_3px_rgba(20,41,95,0.04)]",
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
