import type { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "muted" | "success" | "danger"

const badgeClasses: Record<BadgeVariant, string> = {
  default: "bg-primary/12 text-primary",
  muted: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/12 text-emerald-700",
  danger: "bg-rose-500/12 text-rose-700",
}

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", badgeClasses[variant], className)}
      {...props}
    />
  )
}
