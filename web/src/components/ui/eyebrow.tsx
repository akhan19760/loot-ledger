import * as React from "react"
import { cn } from "cn"

/** INK "■ LABEL": a small square, then uppercase mono text. */
function Eyebrow({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="eyebrow"
      className={cn("inline-flex items-center gap-2 font-mono text-xs font-medium tracking-wide uppercase", className)}
      {...props}
    >
      <span aria-hidden className="size-1.5 shrink-0 bg-current" />
      {children}
    </span>
  )
}

export { Eyebrow }
