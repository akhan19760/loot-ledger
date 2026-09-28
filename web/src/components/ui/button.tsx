import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { ArrowUpRight } from "lucide-react"

// Styles from DESIGN.md: primary = WG neon "Learn more", secondary = WG "Contact",
// ghost = WG nav links, round = WG black icon circle. Every button is a `group/roll`,
// so a <RollText> label inside rolls on hover (INK).
const buttonVariants = cva(
  "group/button group/roll relative inline-flex shrink-0 items-center justify-center gap-2 border border-transparent text-base leading-none font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform,translate,scale] duration-200 ease-[cubic-bezier(0.3,0,0.04,1)] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // WG neon button + WG neon drop-shadow on hover
        default:
          "rounded-2xl bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-[0_0_25px_rgb(212_251_8/0.45)]",
        secondary:
          "rounded-sm border-white/10 bg-gradient-to-br from-black/30 to-neutral-700/30 text-foreground hover:-translate-y-px hover:border-white/25 hover:to-neutral-800/50 active:translate-y-0",
        ghost: "rounded-sm text-foreground hover:text-primary",
        round: "rounded-full border border-white/10 bg-black text-foreground hover:border-primary hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[42px] px-6",
        sm: "h-9 px-4 text-sm",
        lg: "h-14 gap-4 pr-2 pl-7 text-lg",
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

/**
 * WG "Play demo" icon: a black circle at the end of a big button; its icon spins
 * (WG fastSpin, to 330°) when the button is hovered.
 */
function ButtonCircle({ icon: Icon = ArrowUpRight, className }: { icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span className={cn("grid size-10 place-items-center rounded-full bg-black text-primary", className)}>
      <Icon className="spin-on-hover size-4 group-hover/button:rotate-[330deg]" />
    </span>
  )
}

export { Button, ButtonCircle, buttonVariants }
