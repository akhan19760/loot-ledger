import { m, useInView, useReducedMotion } from "motion/react"
import { memo, useRef } from "react"
import { cn } from "cn"
import type { GameSummary } from "@lootledger/shared"
import { CoverArt } from "@/components/cover-art"
import { capitalize, formatCount, formatPrice } from "@/lib/format"
import { thumb } from "@/lib/images"
import { ease } from "@/lib/motion"

/** The band across the top of a game case, in each console's own colours. */
function band(platform: string | null): { label: string; bg: string; fg: string } {
  if (platform === "PS5") return { label: "PS5", bg: "#f4f4f2", fg: "#0b0c0e" }
  if (platform === "PS4") return { label: "PS4", bg: "#003791", fg: "#ffffff" }
  if (platform === "PS3") return { label: "PS3", bg: "#0b0c0e", fg: "#ffffff" }
  if (platform?.startsWith("Switch")) return { label: platform === "Switch 2" ? "NS2" : "NS", bg: "#e60012", fg: "#ffffff" }
  if (platform?.startsWith("Xbox")) return { label: "XBOX", bg: "#107c10", fg: "#ffffff" }
  if (platform === "PC") return { label: "PC", bg: "#2a2c31", fg: "#ffffff" }
  return { label: "PS", bg: "#2a2c31", fg: "#ffffff" }
}

interface Props {
  games: readonly GameSummary[]
  storeNames: Map<string, string>
  onOpen: (id: string) => void
  className?: string
}

/**
 * The library as a shelf (DESIGN.md, "Library: shelf"): every game a case seen from the side,
 * its spine cut from a strip of its own cover, the console's band across the top (PS5
 * white, PS4 blue, Switch red, Xbox green) and its cheapest price on a lime foot. Reached for,
 * a spine slides up and its case turns out of the shelf to show the cover. Rows of spines sit
 * on ledges; the spines rise onto them as the shelf scrolls into view.
 */
export function ShelfView({ games, storeNames, onOpen, className }: Props) {
  const reduced = useReducedMotion()
  // Held as the shelf's own state (not whileInView), so spines added later by "Show more"
  // mount into "shown" and rise in too, rather than waiting at "hidden" for a cue that's passed.
  const ref = useRef<HTMLUListElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.05 })
  return (
    <m.ul
      ref={ref}
      aria-label="Games on the shelf"
      className={cn(
        "flex flex-wrap gap-x-1 gap-y-(--row-gap) pb-4 [--ledge:color-mix(in_oklab,var(--foreground)_16%,transparent)] [--row-gap:2.25rem] [--spine-h:15rem] [--spine-w:2.25rem] sm:[--spine-h:17.5rem] sm:[--spine-w:2.6rem] lg:[--spine-h:19.5rem] lg:[--spine-w:2.85rem]",
        "bg-[linear-gradient(to_bottom,transparent_var(--spine-h),var(--ledge)_var(--spine-h),var(--ledge)_calc(var(--spine-h)+6px),transparent_calc(var(--spine-h)+6px))] bg-size-[100%_calc(var(--spine-h)+var(--row-gap))]",
        className,
      )}
      initial={reduced ? false : "hidden"}
      animate={inView || reduced ? "shown" : "hidden"}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.012 } } }}
    >
      {games.map((g) => (
        <m.li
          key={g.id}
          className="relative"
          variants={{ hidden: { opacity: 0, transform: "translateY(32px)" }, shown: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.8, ease: ease.cine } } }}
        >
          <Spine game={g} storeName={storeNames.get(g.best.store) ?? g.best.store} onOpen={onOpen} />
        </m.li>
      ))}
    </m.ul>
  )
}

const Spine = memo(function Spine({ game, storeName, onOpen }: { game: GameSummary; storeName: string; onOpen: (id: string) => void }) {
  const { best } = game
  const b = band(best.platform)
  const version = [best.platform, best.condition && capitalize(best.condition)].filter(Boolean).join(" · ")
  return (
    <button
      type="button"
      data-game-card={game.id}
      aria-label={`${game.title}, ${version}: ${formatPrice(best.price)} at ${storeName}`}
      onClick={() => onOpen(game.id)}
      // The case turns out toward whichever side has room, so it never leaves the screen.
      onPointerEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.dataset.align = r.left < 140 ? "start" : r.right > innerWidth - 140 ? "end" : "center"
      }}
      className="group/spine relative block h-(--spine-h) w-(--spine-w) text-left outline-none hover:z-20 focus-visible:z-20"
    >
      <span className="absolute inset-0 overflow-hidden bg-graphite transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/spine:-translate-y-4 group-focus-visible/spine:-translate-y-4">
        {game.image && (
          <img
            src={thumb(game.image, 200)}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full object-cover object-[38%_center]"
          />
        )}
        <span className="absolute inset-0 bg-ink/45 transition-colors duration-300 group-hover/spine:bg-ink/20" />
        <span className="absolute inset-x-0 top-0 grid h-8 place-items-center text-[9px] font-extrabold tracking-[0.08em] sm:text-[10px]" style={{ background: b.bg, color: b.fg }}>
          {b.label}
        </span>
        <span className="absolute inset-x-0 top-10 bottom-[4.75rem] flex justify-center overflow-hidden">
          <span className="max-h-full overflow-hidden text-[11px] leading-none font-extrabold tracking-[0.04em] text-ellipsis whitespace-nowrap text-white uppercase [writing-mode:vertical-rl] sm:text-xs">
            {game.title}
          </span>
        </span>
        <span className={cn("absolute inset-x-0 bottom-0 flex h-[4.25rem] items-center justify-center", best.in_stock ? "bg-lime text-ink" : "bg-bone/80 text-ink")}>
          <span className="font-display text-[11px] leading-none [writing-mode:vertical-rl] sm:text-xs">{formatCount(best.price)}</span>
        </span>
        {/* The focus mark, inside the spine (nothing outside a button shows on a shelf this tight) */}
        <span className="absolute inset-0 hidden outline-2 -outline-offset-2 outline-lime group-focus-visible/spine:block" />
      </span>

      {/* Pulled out: the case turns to show its cover (pointer screens; a tap just opens the game) */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[calc(100%-2.5rem)] left-1/2 w-44 -translate-x-1/2 group-data-[align=end]/spine:right-0 group-data-[align=end]/spine:left-auto group-data-[align=end]/spine:translate-x-0 group-data-[align=start]/spine:left-0 group-data-[align=start]/spine:translate-x-0 [@media(hover:none)]:hidden lg:w-52"
      >
        <span className="block origin-bottom translate-y-3 opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] [transform:perspective(700px)_rotateY(70deg)] group-hover/spine:translate-y-0 group-hover/spine:opacity-100 group-hover/spine:[transform:perspective(700px)_rotateY(0deg)] group-focus-visible/spine:opacity-100 group-focus-visible/spine:[transform:perspective(700px)_rotateY(0deg)]">
          <span className="chamfer grid gap-3 bg-ink p-2.5 pb-3.5 text-bone">
            <span className="chamfer-sm relative block aspect-[4/5] overflow-hidden bg-graphite">
              <CoverArt src={game.image} title={game.title} width={400} />
            </span>
            <span className="grid gap-1.5 px-1">
              <span className="label-caps text-bone/60">{version}</span>
              <span className="line-clamp-2 text-[13px] leading-tight font-bold uppercase">{game.title}</span>
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg leading-none whitespace-nowrap text-lime">{formatPrice(best.price)}</span>
                <span className="truncate text-[11px] text-bone/60">{storeName}</span>
              </span>
            </span>
          </span>
        </span>
      </span>
    </button>
  )
})
