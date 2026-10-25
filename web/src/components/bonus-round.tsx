import { AnimatePresence, animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "cn"
import type { GameSummary } from "@lootledger/shared"
import { CoverArt } from "@/components/cover-art"
import { RollText } from "@/components/motion/roll-text"
import { Button } from "@/components/ui/button"
import { unlock } from "@/hooks/use-achievements"
import { formatPrice } from "@/lib/format"
import { ease } from "@/lib/motion"
import { play as playSound } from "@/lib/sfx"

const BEST_KEY = "lootledger-bonus-best"

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

/** A shuffled copy (Fisher–Yates), so each round deals a fresh order. */
function shuffled<T>(items: readonly T[]) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

type Phase = "guess" | "right" | "wrong"

/**
 * The bonus round (DESIGN.md, "Bonus round"): Higher or Lower with today's real prices. One
 * game shows its cheapest price; guess whether the next is dearer or cheaper. Right, and the
 * revealed game becomes the one to beat; wrong ends the streak. The best streak is kept in
 * this browser. A tie counts as right.
 */
export function BonusRound({ games, storeNames }: { games: readonly GameSummary[]; storeNames: Map<string, string> }) {
  const pool = useMemo(() => games.filter((g) => g.image && g.best.in_stock), [games])
  const [deck, setDeck] = useState<GameSummary[]>([])
  const [at, setAt] = useState(0)
  const [phase, setPhase] = useState<Phase>("guess")
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(readBest)

  // Deal once the games are in (and again on a new game)
  const deal = () => {
    setDeck(shuffled(pool))
    setAt(0)
    setPhase("guess")
    setStreak(0)
  }
  if (!deck.length && pool.length >= 2) setDeck(shuffled(pool))

  const known = deck[at]
  const hidden = deck[at + 1]
  if (!known || !hidden) return null

  const guess = (higher: boolean) => {
    if (phase !== "guess") return
    const right = higher ? hidden.best.price >= known.best.price : hidden.best.price <= known.best.price
    setPhase(right ? "right" : "wrong")
    playSound(right ? "on" : "off")
    if (right) {
      const next = streak + 1
      setStreak(next)
      if (next >= 5) unlock("streak-5")
      if (next > best) {
        setBest(next)
        try {
          localStorage.setItem(BEST_KEY, String(next))
        } catch {
          // Storage blocked: the best lasts for this visit.
        }
      }
    }
  }
  // The revealed game becomes the one to beat; at the end of the deck, a fresh shuffle behind it.
  const next = () => {
    if (at + 2 < deck.length) setAt(at + 1)
    else {
      setDeck([hidden, ...shuffled(pool.filter((g) => g.id !== hidden.id))])
      setAt(0)
    }
    setPhase("guess")
  }

  return (
    <section id="bonus" aria-labelledby="bonus-title" className="relative overflow-hidden px-4 py-20 md:px-8 md:py-32">
      <div className="grid gap-10 md:gap-14">
        <header className="grid gap-4 md:grid-cols-12 md:items-end">
          <div className="grid gap-3 md:col-span-7">
            <span className="label-caps text-muted-foreground">Bonus round</span>
            <h2 id="bonus-title" className="font-display text-[clamp(2.4rem,6vw,5.75rem)] leading-[0.88] uppercase text-balance">
              Higher or lower?
            </h2>
          </div>
          <p className="max-w-md text-base text-muted-foreground md:col-span-5 md:justify-self-end md:text-lg">
            Today&rsquo;s real cheapest prices. Is the next game dearer or cheaper? A tie counts as a win.
          </p>
        </header>

        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-10">
          <Card game={known} store={storeNames.get(known.best.store) ?? known.best.store} revealed tone="known" />

          <div className="grid justify-items-center gap-4 md:order-none">
            <div className="flex gap-6 md:grid md:gap-3">
              <Stat label="Streak" value={streak} />
              <Stat label="Best" value={best} />
            </div>
            <span className="font-display text-3xl leading-none text-muted-foreground uppercase max-md:hidden">VS</span>
          </div>

          <div className="grid gap-4">
            <Card
              key={hidden.id}
              game={hidden}
              store={storeNames.get(hidden.best.store) ?? hidden.best.store}
              revealed={phase !== "guess"}
              tone={phase === "wrong" ? "wrong" : phase === "right" ? "right" : "hidden"}
            />
          </div>
        </div>

        <div className="flex min-h-14 flex-wrap items-center justify-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "guess" ? (
              <m.div key="guess" className="flex flex-wrap justify-center gap-3" {...swap}>
                <Button size="lg" onClick={() => guess(true)} className="pr-7">
                  <ArrowUp className="size-5" />
                  <RollText>Higher</RollText>
                </Button>
                <Button size="lg" variant="secondary" onClick={() => guess(false)} className="pr-7">
                  <ArrowDown className="size-5" />
                  <RollText>Lower</RollText>
                </Button>
              </m.div>
            ) : phase === "right" ? (
              <m.div key="right" className="flex flex-wrap items-center justify-center gap-4" {...swap}>
                <span className="font-display text-2xl uppercase md:text-3xl">Correct</span>
                <Button size="lg" onClick={next} className="pr-7">
                  <RollText>Next game</RollText>
                </Button>
              </m.div>
            ) : (
              <m.div key="wrong" className="flex flex-wrap items-center justify-center gap-4" {...swap}>
                <span className="font-display text-2xl uppercase md:text-3xl">Game over · streak {streak}</span>
                <Button size="lg" onClick={deal} className="pr-7">
                  <RotateCcw className="size-5" />
                  <RollText>Play again</RollText>
                </Button>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

const swap = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.45, ease: ease.cine },
} as const

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid justify-items-center gap-1">
      <span className="label-caps text-muted-foreground">{label}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={value}
          className="font-display text-4xl leading-none text-primary-ink"
          initial={{ y: "60%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-60%", opacity: 0 }}
          transition={{ duration: 0.5, ease: ease.cine }}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </div>
  )
}

/** A game card for the round: the cover, the name, and the price (counted up when it's revealed). */
function Card({ game, store, revealed, tone }: { game: GameSummary; store: string; revealed: boolean; tone: "known" | "hidden" | "right" | "wrong" }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] items-end gap-5 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-7">
      <div
        className={cn(
          "chamfer-lg relative aspect-[4/5] overflow-hidden bg-raised p-0 transition-[padding,background-color] duration-500",
          tone === "right" && "bg-primary p-2",
          tone === "wrong" && "bg-destructive p-2",
        )}
      >
        <div className="chamfer relative size-full overflow-hidden">
          <CoverArt src={game.image} title={game.title} width={400} />
        </div>
      </div>
      <div className="grid gap-2">
        <span className="line-clamp-2 text-base leading-tight font-bold uppercase md:text-lg">{game.title}</span>
        <span className="text-sm text-muted-foreground">at {store}</span>
        <Price value={game.best.price} revealed={revealed} counting={tone !== "known"} />
      </div>
    </div>
  )
}

function Price({ value, revealed, counting }: { value: number; revealed: boolean; counting: boolean }) {
  const reduced = useReducedMotion()
  const shown = useMotionValue(counting ? 0 : value)
  const text = useTransform(shown, (v) => formatPrice(v))
  useEffect(() => {
    if (!revealed) return
    if (!counting || reduced) return shown.set(value)
    const controls = animate(shown, value, { duration: 0.9, ease: ease.cine })
    return () => controls.stop()
  }, [revealed, counting, reduced, value, shown])
  return revealed ? (
    <m.span className="font-display text-[clamp(1.75rem,3.4vw,3rem)] leading-none text-primary-ink">{text}</m.span>
  ) : (
    <span className="font-display text-[clamp(1.75rem,3.4vw,3rem)] leading-none text-muted-foreground">Rs ? ? ?</span>
  )
}
