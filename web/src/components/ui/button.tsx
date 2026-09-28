import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Styles from DESIGN.md: primary = WG neon "Learn more", secondary = WG "Contact",
// ghost = WG nav links, round = WG black icon circle.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border border-transparent text-base leading-none font-medium whitespace-nowrap transition-all duration-100 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "rounded-2xl bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "rounded-sm border-white/10 bg-gradient-to-br from-black/30 to-neutral-700/30 text-foreground hover:-translate-y-px hover:to-neutral-800/50 active:translate-y-0",
        ghost: "rounded-sm text-foreground hover:text-primary",
        round: "rounded-full bg-black text-foreground hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[42px] px-6",
        sm: "h-9 px-4 text-sm",
        icon: "size-12",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
