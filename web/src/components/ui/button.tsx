import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { ArrowUpRight } from "lucide-react"

// Styles from DESIGN.md ("Title Screen"): every button is a chamfered block, never rounded.
// primary = solid lime with ink type, secondary = a flat tone step off the page, ghost = type
// alone, round = a small chamfered square for an icon. Every button is a `group/roll`, so a
// <RollText> label inside rolls on hover. Focus is an inset outline: the chamfer clips anything
// drawn outside the box.
const buttonVariants = cva(
  "group/button group/roll relative inline-flex shrink-0 items-center justify-center gap-2.5 text-[15px] leading-none font-semibold whitespace-nowrap transition-[background-color,color,transform,translate,scale] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none select-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "chamfer bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "chamfer bg-secondary text-foreground hover:bg-foreground/15",
        ghost: "text-foreground hover:text-primary-ink",
        // A chamfered square for one icon, in the page's colours; lime once reached for
        round: "chamfer-sm bg-secondary text-foreground hover:bg-primary hover:text-ink",
        link: "text-primary-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 gap-4 pr-2 pl-7 text-base uppercase tracking-[0.08em]",
        icon: "size-12",
        "icon-sm": "size-10",
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

/**
 * The square at the end of a big button: ink with a lime icon on a lime button (lime with an
 * ink icon on any other). Its arrow nudges out the way it points when the button is hovered.
 */
function ButtonCircle({ icon: Icon = ArrowUpRight, className }: { icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span
      className={cn(
        "chamfer-sm grid size-10 place-items-center bg-ink text-lime group-data-[variant=secondary]/button:bg-primary group-data-[variant=secondary]/button:text-ink",
        className,
      )}
    >
      <Icon className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
    </span>
  )
}

export { Button, ButtonCircle, buttonVariants }
