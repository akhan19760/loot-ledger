"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Toggle as TogglePrimitive } from "radix-ui"

// WG tag chips: white/10 fill; pressed = the neon chip variant, or black with neon text
// on a light page (neon fill there strains the eye).
const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1.5 rounded-2xl bg-secondary text-sm leading-none font-medium whitespace-nowrap text-secondary-foreground transition-colors duration-100 outline-none hover:bg-foreground/20 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-primary data-[state=on]:text-black data-[state=on]:hover:bg-primary-hover light:data-[state=on]:bg-black light:data-[state=on]:text-primary light:data-[state=on]:hover:bg-neutral-800 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "",
      },
      size: {
        default: "h-[42px] px-4",
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
