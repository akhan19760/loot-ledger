import { m, useReducedMotion } from "motion/react"
import { Check, Heart } from "lucide-react"
import { cn } from "cn"
import { RollText } from "@/components/motion/roll-text"
import { Button } from "@/components/ui/button"
import { setShelf, useShelf, type ShelfList } from "@/hooks/use-shelf"
import { ease } from "@/lib/motion"

interface ShelfGame {
  id: string
  title: string
  image: string | null
}

const ICONS = { wishlist: Heart, collection: Check } as const

function useShelfToggle(game: ShelfGame) {
  const current = useShelf()[game.id]?.list ?? null
  const toggle = (list: ShelfList) => setShelf(game, current === list ? null : list)
  return { current, toggle }
}

/** The icon, turning in when it switches on (cinematic ease, no overshoot). */
function ShelfIcon({ list, on }: { list: ShelfList; on: boolean }) {
  const reduced = useReducedMotion()
  const Icon = ICONS[list]
  return (
    <m.span
      key={String(on)}
      initial={reduced || !on ? false : { scale: 0.5, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 0.6, ease: ease.cine }}
      className="grid place-items-center"
    >
      <Icon className={cn("size-4", on && list === "wishlist" && "fill-current")} strokeWidth={list === "collection" ? 3 : 2} />
    </m.span>
  )
}

/**
 * Two chamfered ink squares over a cover: wishlist and owned. They appear on hover or focus
 * (always on touch screens), and stay once switched on (lime).
 */
export function ShelfCardButtons({ game, className }: { game: ShelfGame; className?: string }) {
  const { current, toggle } = useShelfToggle(game)
  const button = (list: ShelfList, label: string, activeLabel: string) => {
    const on = current === list
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `${activeLabel}: ${game.title}` : `${label}: ${game.title}`}
        title={on ? activeLabel : label}
        onClick={() => toggle(list)}
        className={cn(
          "chamfer-sm grid size-9 place-items-center bg-ink text-bone transition-[color,background-color,opacity,scale] duration-300 outline-none hover:text-lime focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-lime active:scale-90",
          on
            ? "bg-lime text-ink hover:text-ink"
            : "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100",
        )}
      >
        <ShelfIcon list={list} on={on} />
      </button>
    )
  }
  return (
    <div className={cn("flex gap-1.5", className)}>
      {button("wishlist", "Add to wishlist", "On your wishlist")}
      {button("collection", "Mark as owned", "In your collection")}
    </div>
  )
}

/** The same two choices as labelled buttons, for the game dialog. */
export function ShelfActions({ game }: { game: ShelfGame }) {
  const { current, toggle } = useShelfToggle(game)
  const action = (list: ShelfList, label: string, activeLabel: string) => {
    const on = current === list
    return (
      <Button variant={on ? "default" : "secondary"} size="sm" aria-pressed={on} onClick={() => toggle(list)}>
        <ShelfIcon list={list} on={on} />
        <RollText>{on ? activeLabel : label}</RollText>
      </Button>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {action("wishlist", "Add to wishlist", "On your wishlist")}
      {action("collection", "I own this", "In your collection")}
    </div>
  )
}
