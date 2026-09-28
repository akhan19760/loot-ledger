import { motion, useReducedMotion } from "motion/react"
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

/** The icon, popping in when it switches on (INK roll ease). */
function ShelfIcon({ list, on }: { list: ShelfList; on: boolean }) {
  const reduced = useReducedMotion()
  const Icon = ICONS[list]
  return (
    <motion.span
      key={String(on)}
      initial={reduced || !on ? false : { scale: 0.3, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ duration: 0.5, ease: ease.inkRoll }}
      className="grid place-items-center"
    >
      <Icon className={cn("size-4", on && list === "wishlist" && "fill-current")} strokeWidth={list === "collection" ? 3 : 2} />
    </motion.span>
  )
}

/**
 * WG black circles over a card's art: wishlist and owned. They appear on hover or focus
 * (always on touch screens), and stay once switched on.
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
          "grid size-9 place-items-center rounded-full border border-white/10 bg-black text-white transition-[border-color,color,background-color,opacity,scale] duration-300 outline-none hover:border-primary hover:text-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary active:scale-90",
          on
            ? list === "collection"
              ? "border-primary bg-primary text-black hover:text-black"
              : "text-primary"
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
