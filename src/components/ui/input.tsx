import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full min-w-0 rounded-xl border bg-[var(--surface-light-gradient)] px-3.5 py-2.5 text-[14px] font-medium text-[var(--text-primary)] ring-offset-background transition-[border-color,box-shadow,background-color] duration-150 ease-out",
          "border-[color:var(--border-subtle)] shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_1px_3px_rgba(20,41,95,0.04)]",
          "placeholder:text-[var(--text-muted)] placeholder:font-normal",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "focus-visible:outline-none focus-visible:border-[color:var(--border-strong)] focus-visible:shadow-[0_1px_0_0_rgba(255,255,255,0.95)_inset,0_0_0_3px_rgba(255,138,31,0.12),0_1px_3px_rgba(20,41,95,0.05)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#f5f7fb]",
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
