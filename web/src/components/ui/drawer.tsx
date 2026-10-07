import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog"

/**
 * Bottom sheet for phones: a dialog (same overlay, focus trap, Esc and outside click to
 * close) that rises from the bottom edge. A title and close button on top, a body that
 * scrolls, and an optional footer pinned under it for the sheet's actions.
 */
function DrawerContent({
  title,
  footer,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="drawer-content"
        aria-describedby={undefined}
        className={cn(
          // The dialog's WG glass, docked to the bottom with only its top corners rounded.
          // Rises with WG's ease; drops away quicker.
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-neutral-800/70 text-foreground outline-none supports-backdrop-filter:backdrop-blur-[37.5px] light:bg-white/90 data-open:animate-in data-open:slide-in-from-bottom data-open:duration-500 data-open:ease-[cubic-bezier(0.3,0,0.04,1)] data-closed:animate-out data-closed:slide-out-to-bottom data-closed:duration-300 data-closed:ease-[cubic-bezier(0.645,0.045,0.355,1)]",
          className,
        )}
        {...props}
      >
        {/* Grab handle: says "sheet", even though it isn't dragged */}
        <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/20" />
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 pt-2 pb-3">
          <DialogPrimitive.Title className="font-display text-3xl leading-none uppercase">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close asChild>
            {/* WG spinToClose: the close icon turns as you reach for it */}
            <Button variant="round" size="icon-sm" className="duration-500 hover:rotate-180">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        </div>
        <div data-slot="drawer-body" data-lenis-prevent className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain px-5 pt-2 pb-6">
          {children}
        </div>
        {footer && (
          <div data-slot="drawer-footer" className="flex shrink-0 items-center gap-3 border-t border-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export { DrawerContent }
