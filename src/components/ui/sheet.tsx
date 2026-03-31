"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import {
  type DashboardMotionPreset,
  useResolvedDashboardMotionPreset,
} from "@/lib/dashboard-motion"
import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

interface SheetOverlayProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay> {
  motionPreset?: DashboardMotionPreset
}

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  SheetOverlayProps
>(({ className, motionPreset, ...props }, ref) => {
  const resolvedMotionPreset = useResolvedDashboardMotionPreset(motionPreset)

  return (
    <SheetPrimitive.Overlay
      className={cn(
        resolvedMotionPreset === "dashboard-premium"
          ? "dashboard-premium-overlay fixed inset-0 z-50"
          : "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
      ref={ref}
    />
  )
})
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 border border-[color:var(--border-subtle)] bg-[var(--bg-surface-1)] p-6 text-[var(--text-primary)] shadow-[var(--shadow-card-strong)] transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  motionPreset?: DashboardMotionPreset
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, motionPreset, ...props }, ref) => {
  const resolvedMotionPreset = useResolvedDashboardMotionPreset(motionPreset)

  return (
    <SheetPortal>
      <SheetOverlay motionPreset={resolvedMotionPreset} />
      <SheetPrimitive.Content
        ref={ref}
        data-motion-side={side}
        className={cn(
          resolvedMotionPreset === "dashboard-premium"
            ? "dashboard-premium-sheet fixed z-50 gap-4 bg-background p-6 shadow-lg border"
            : sheetVariants({ side }),
          resolvedMotionPreset === "dashboard-premium" && side === "top" && "inset-x-0 top-0 border-b",
          resolvedMotionPreset === "dashboard-premium" && side === "bottom" && "inset-x-0 bottom-0 border-t",
          resolvedMotionPreset === "dashboard-premium" && side === "left" && "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          resolvedMotionPreset === "dashboard-premium" && side === "right" && "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-[var(--surface-primary-gradient)] text-[var(--text-on-dark)] opacity-95 shadow-[var(--shadow-card-strong)] ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)] focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4 text-white" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
