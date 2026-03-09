import type { HTMLAttributes, TableHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

export function TableWrapper({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-3xl border border-border/70 bg-card/80", className)} {...props} />
}

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
}
