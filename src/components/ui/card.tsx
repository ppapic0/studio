import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(247,250,255,0.985)_100%)] text-card-foreground ring-1 ring-white/70 shadow-[0_28px_64px_rgba(20,41,95,0.12),0_10px_22px_rgba(20,41,95,0.05),inset_0_1px_0_rgba(255,255,255,0.96),inset_0_-1px_0_rgba(20,41,95,0.03)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_14%_0%,rgba(255,255,255,0.82),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_28%)] before:opacity-100 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_34px_74px_rgba(20,41,95,0.14),0_12px_24px_rgba(20,41,95,0.06),inset_0_1px_0_rgba(255,255,255,0.97),inset_0_-1px_0_rgba(20,41,95,0.03)]",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-body font-black leading-none tracking-[-0.03em]",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
