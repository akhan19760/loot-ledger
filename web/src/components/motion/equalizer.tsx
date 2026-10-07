import { cn } from "cn"

/**
 * WG's header audio control: a round black badge with small neon bars that bounce.
 * The bars are neon while the API is live (grey when it's offline) and bounce while
 * `playing` (in the header: while sound effects are on; by default, while live).
 */
export function Equalizer({ live, playing = live, className }: { live: boolean; playing?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid size-10 place-items-center rounded-full border border-white/10 bg-black md:size-11", className)}
    >
      <span className="flex h-3.5 items-end gap-[2px]">
        {[0.9, 0.5, 1, 0.7, 0.4].map((h, i) => (
          <span
            key={i}
            className={cn("equalizer-bar w-[2px] rounded-full", live ? "bg-primary" : "bg-white/40")}
            style={{ height: `${h * 100}%`, animationDelay: `${i * -0.23}s`, animationPlayState: playing ? "running" : "paused" }}
          />
        ))}
      </span>
    </span>
  )
}
