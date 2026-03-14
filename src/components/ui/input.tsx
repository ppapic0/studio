import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(249,251,255,0.99)_100%)] px-3.5 py-2.5 text-[14px] font-medium text-[#1a2d4a] ring-offset-background transition-[border-color,box-shadow] duration-150 ease-out",
          "border-[rgba(20,41,95,0.12)] shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_1px_3px_rgba(20,41,95,0.04)]",
          "placeholder:text-[#9aadbe] placeholder:font-normal",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:border-[rgba(20,41,95,0.35)] focus-visible:shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_0_0_3px_rgba(20,41,95,0.08),0_1px_3px_rgba(20,41,95,0.05)]",
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-[#f5f7fb]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
