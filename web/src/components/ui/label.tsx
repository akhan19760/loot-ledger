import * as React from "react"
import { cn } from "cn"

/** A small label over a value or a group of controls: sentence case, readable size, grey by default. */
function Label({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="label" className={cn("text-[13px] leading-tight font-medium text-muted-foreground", className)} {...props} />
}

export { Label }
