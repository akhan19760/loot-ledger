import * as React from "react"
import { cn } from "cn"

/**
 * WG header status: a small value (or a dot, neon while live) above a grey label,
 * like WG's "● Online" and "61 FPS", in sentence case at a readable size.
 */
function Stat({
  value,
  label,
  dot,
  className,
  ...props
}: React.ComponentProps<"div"> & { value?: React.ReactNode; label: string; dot?: "live" | "idle" }) {
  return (
    <div data-slot="stat" className={cn("flex flex-col items-center gap-1 text-[13px] leading-none font-medium", className)} {...props}>
      {dot ? (
        <span aria-hidden className={cn("my-1 size-1.5 rounded-full", dot === "live" ? "bg-primary-ink" : "bg-foreground")} />
      ) : (
        <span className="text-foreground">{value}</span>
      )}
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

export { Stat }
