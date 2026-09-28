import { cn } from "cn"

/** WG's neon hazard stripes, sliding endlessly (their join/footer stripe band). */
export function HazardBand({ className }: { className?: string }) {
  return <div aria-hidden className={cn("hazard-band h-16 rounded-2xl md:h-24", className)} />
}
