import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card"
    className={cn(
      "relative overflow-hidden rounded-[1.5rem] border border-[#d7e0f0] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(248,250,255,0.995)_100%)] text-card-foreground shadow-[0_24px_56px_rgba(20,41,95,0.11),0_8px_20px_rgba(20,41,95,0.05),inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(20,41,95,0.04)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_16%_0%,rgba(255,255,255,0.62),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_24%)] before:opacity-100 transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-[1px] hover:border-[#c8d5ea] hover:shadow-[0_30px_68px_rgba(20,41,95,0.14),0_10px_22px_rgba(20,41,95,0.06),inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(20,41,95,0.04)]",
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
    data-slot="card-header"
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
    data-slot="card-title"
    className={cn(
      "text-2xl font-body font-black leading-none tracking-[-0.03em] text-[#14295f]",
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
    data-slot="card-description"
    className={cn("text-sm text-[#64748b]", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
