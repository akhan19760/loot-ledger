import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Small chamfered tags: a tone step off the page, or solid lime; `outline` = a pale lime
// tint with lime text (ink on a light page); `destructive` = a pale tint of the error red.
// Tints, not outlines: a 1px box around every tag is noise in a row of them.
const badgeVariants = cva(
  "chamfer-xs inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden px-2 text-[11px] leading-none font-semibold tracking-[0.08em] whitespace-nowrap uppercase [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-ink",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "bg-primary/15 text-primary-ink light:bg-primary/40",
        destructive: "bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
)

function Badge({
  className,
  variant = "secondary",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
