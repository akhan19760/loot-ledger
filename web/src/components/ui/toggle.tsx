"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Toggle as TogglePrimitive } from "radix-ui"

// Chamfered chips: a tone step off the page; pressed = solid lime with ink type, in either theme.
const toggleVariants = cva(
  "group/toggle chamfer-sm inline-flex items-center justify-center gap-1.5 bg-secondary text-sm leading-none font-semibold whitespace-nowrap text-secondary-foreground transition-colors duration-200 outline-none hover:bg-foreground/15 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-ink data-[state=on]:hover:bg-primary-hover [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
