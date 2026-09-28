import * as React from "react"
import { cn } from "cn"

// WG contact-form field: no box, a white/10 underline, large text with -1px
// tracking, placeholder at white/70 that turns white on focus.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 border-b border-border bg-transparent pt-4 pb-[0.81rem] text-xl leading-none tracking-[-1px] text-foreground transition-colors outline-none placeholder:text-muted-foreground placeholder:transition-colors placeholder:duration-100 focus:border-white focus:placeholder:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:text-destructive md:text-2xl [&::-webkit-search-cancel-button]:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Input }
