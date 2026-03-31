"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import {
  type DashboardMotionPreset,
  useResolvedDashboardMotionPreset,
} from "@/lib/dashboard-motion"
import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

interface DialogOverlayProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
  motionPreset?: DashboardMotionPreset
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DialogOverlayProps
>(({ className, motionPreset, ...props }, ref) => {
  const resolvedMotionPreset = useResolvedDashboardMotionPreset(motionPreset)

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        resolvedMotionPreset === "dashboard-premium"
          ? "dashboard-premium-overlay fixed inset-0 z-50"
          : "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  motionPreset?: DashboardMotionPreset
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, motionPreset, ...props }, ref) => {
  const resolvedMotionPreset = useResolvedDashboardMotionPreset(motionPreset)

  return (
    <DialogPortal>
      <DialogOverlay motionPreset={resolvedMotionPreset} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          resolvedMotionPreset === "dashboard-premium"
            ? "dashboard-premium-dialog fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain border border-[color:var(--border-subtle)] bg-[var(--bg-surface-1)] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[var(--text-primary)] shadow-[var(--shadow-card-strong)] sm:w-full sm:rounded-[1.5rem]"
            : "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain border border-[color:var(--border-subtle)] bg-[var(--bg-surface-1)] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-[var(--text-primary)] shadow-[var(--shadow-card-strong)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:w-full sm:rounded-[1.25rem]",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/14 bg-[linear-gradient(180deg,#17326B_0%,#10214A_100%)] text-white opacity-100 shadow-[0_16px_30px_-20px_rgba(2,6,23,0.48)] ring-offset-background transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-white/20 hover:bg-[linear-gradient(180deg,#22479B_0%,#17326B_100%)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)] focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4 text-white" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
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
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-[var(--text-secondary)]", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
