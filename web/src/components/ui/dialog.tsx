import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        // A dim, without blur: the panel stands out by tone, not glass
        // (lighter in light theme, so the pale panel stays pale)
        "fixed inset-0 isolate z-50 bg-ink/80 light:bg-ink/45 duration-500 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-200",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  bodyClassName,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  bodyClassName?: string
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // A chamfered block, opaque and one tone step off the page.
          // Height capped; the body scrolls inside it, the close button stays put.
          // Opens with the cinematic ease: rises 2rem while scaling up; closes quicker.
          "chamfer-lg fixed top-1/2 left-1/2 z-50 flex max-h-[min(calc(100dvh-2rem),44rem)] w-full max-w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden bg-raised text-foreground outline-none sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-90 data-open:slide-in-from-bottom-8 data-open:duration-700 data-open:ease-[cubic-bezier(0.16,1,0.3,1)] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:duration-200",
          className
        )}
        {...props}
      >
        <div
          data-slot="dialog-body"
          data-lenis-prevent
          className={cn(
            // The scrollbar's track stops short of the cut corners; on desktop its gutter
            // is reserved and taken out of the right padding, so both sides stay 32px.
            "grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain p-5 sm:p-8 sm:pr-[18px] sm:[scrollbar-gutter:stable] [&::-webkit-scrollbar-track]:my-4",
            bodyClassName
          )}
        >
          {children}
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="round"
              className="absolute top-3 right-3 sm:top-4 sm:right-4"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="secondary">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        // The display face: uppercase, tight
        "font-display text-2xl leading-[0.95] uppercase sm:text-3xl",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-base text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
