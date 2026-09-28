import * as React from "react"
import { cn } from "cn"

/**
 * WG header status: a small neon value (or a dot) above an uppercase grey label,
 * like "● ONLINE" and "61 FPS".
 */
function Stat({
  value,
  label,
  dot,
  className,
  ...props
}: React.ComponentProps<"div"> & { value?: React.ReactNode; label: string; dot?: "live" | "idle" }) {
  return (
    <div data-slot="stat" className={cn("flex flex-col items-center gap-1 leading-none", className)} {...props}>
      {dot ? (
        <span aria-hidden className={cn("my-0.5 size-1.5 rounded-full", dot === "live" ? "bg-primary glow-primary" : "bg-foreground")} />
      ) : (
        <span className="text-xs font-medium text-primary-ink tabular-nums">{value}</span>
      )}
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
    </div>
  )
}

export { Stat }
