import { useWindowVirtualizer } from "@tanstack/react-virtual"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { cn } from "cn"
import type { GameSummary } from "@ugs/shared"
import { GameCard } from "@/components/game-card"
import { GRID_COLUMNS } from "@/components/game-grid"

const GAP = 8 // gap-2, as in GameGrid
const CARD_ASPECT = 5 / 4 // height over width: cards are 4:5

const columnsAt = (viewport: number) => GRID_COLUMNS.find(([min]) => viewport >= min)![1]

/** A new list that starts with the old one: "Show more" added a page. */
const isAppend = (prev: readonly GameSummary[], next: readonly GameSummary[]) =>
  prev.length > 0 && next.length >= prev.length && next[0]!.id === prev[0]!.id && next[prev.length - 1]!.id === prev[prev.length - 1]!.id

interface Props {
  games: readonly GameSummary[]
  storeNames: Map<string, string>
  onOpen: (id: string) => void
  className?: string
}

/**
 * The library's card grid, virtualized: only the rows near the viewport are in the DOM,
 * so a thousand games scroll like a dozen. Same columns and gap as GameGrid. Cards are
 * placed by transform, so when the list changes (a filter, a sort) the cards that stay
 * glide to their new place with a CSS transition.
 */
export function VirtualGameGrid({ games, storeNames, onOpen, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, top: 0, columns: 2 })

  // The grid's width, columns and distance from the top of the page. Content above it
  // (the summary panel, a filter bar that wraps differently) can move it.
  useLayoutEffect(() => {
    const el = ref.current!
    const measure = () => {
      const next = { width: el.clientWidth, top: el.getBoundingClientRect().top + window.scrollY, columns: columnsAt(window.innerWidth) }
      setBox((b) => (b.width === next.width && b.top === next.top && b.columns === next.columns ? b : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [])

  const { width, top, columns } = box
  const cardWidth = width ? (width - GAP * (columns - 1)) / columns : 0
  const rowHeight = cardWidth * CARD_ASPECT
  const virtualizer = useWindowVirtualizer({
    count: width ? Math.ceil(games.length / columns) : 0,
    estimateSize: () => rowHeight,
    gap: GAP,
    overscan: 2,
    scrollMargin: top,
  })
  // Every row is one card tall; when cards resize, so do the rows.
  useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, rowHeight])

  // A new list (adjusted during render, so the first frame of it already has the
  // transition): cards that stay glide for a moment, but not on resize, when every card
  // moves at once. Cards play their scroll-in once per list, not each time scrolling
  // brings them back into the DOM; "Show more" keeps the list going.
  const [list, setList] = useState(games)
  const [gliding, setGliding] = useState(false)
  const [seen, setSeen] = useState(() => new Set<string>())
  if (games !== list) {
    if (!isAppend(list, games)) {
      setSeen(new Set())
      setGliding(true)
    }
    setList(games)
  }
  useEffect(() => {
    if (!gliding) return
    const t = setTimeout(() => setGliding(false), 800)
    return () => clearTimeout(t)
  }, [gliding, list])
  const onAppear = useCallback((id: string) => void seen.add(id), [seen])

  const scrollMargin = virtualizer.options.scrollMargin
  return (
    <div ref={ref} className={cn("relative", className)} style={{ height: virtualizer.getTotalSize() }}>
      {cardWidth > 0 &&
        virtualizer.getVirtualItems().flatMap((row) =>
          games.slice(row.index * columns, (row.index + 1) * columns).map((game, column) => (
            <div
              key={game.id}
              className={cn("absolute top-0 left-0", gliding && "transition-transform duration-700 ease-[cubic-bezier(0.3,0,0.04,1)]")}
              style={{ width: cardWidth, transform: `translate(${column * (cardWidth + GAP)}px, ${row.start - scrollMargin}px)` }}
            >
              <GameCard
                game={game}
                index={column}
                storeName={storeNames.get(game.best.store) ?? game.best.store}
                onOpen={onOpen}
                appear={!seen.has(game.id)}
                onAppear={onAppear}
              />
            </div>
          )),
        )}
    </div>
  )
}
