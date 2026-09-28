import { cn } from "cn"

/**
 * WG's header audio control: a round black badge with small neon bars that bounce.
 * Here it shows the API is live; the bars rest when it's offline.
 */
export function Equalizer({ live, className }: { live: boolean; className?: string }) {
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
            style={{ height: `${h * 100}%`, animationDelay: `${i * -0.23}s`, animationPlayState: live ? "running" : "paused" }}
          />
        ))}
      </span>
    </span>
  )
}
