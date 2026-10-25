import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react"
import { useRef, useState } from "react"
import { cn } from "cn"
import type { DealsResponse, GapDeal } from "@lootledger/shared"
import { CoverArt } from "@/components/cover-art"
import { RollText } from "@/components/motion/roll-text"
import { Button, ButtonCircle } from "@/components/ui/button"
import { capitalize, formatCount, formatPrice } from "@/lib/format"
import { ease } from "@/lib/motion"
import { play as playSound } from "@/lib/sfx"

const ROUNDS = 3

interface Props {
  deals: DealsResponse | undefined
  storeNames: Map<string, string>
  onOpen: (id: string) => void
  onAllDeals: () => void
}

const version = (d: GapDeal) => [d.high.platform, capitalize(d.high.condition)].filter(Boolean).join(" · ")

/**
 * "Shop around" (DESIGN.md, "Versus"): today's biggest price gaps as fights. The same game and
 * version at two shops face off across a split screen, ink against lime, with a fighting game's
 * health bars along the top. Pinned while it plays: scrolling lands the blows, the dearer shop's
 * bar drains as the damage (the rupees saved) counts up, and it ends in a K.O. Three rounds, then
 * the page moves on. Without motion, the rounds sit one under another, already decided.
 */
export function Versus({ deals, storeNames, onOpen, onAllDeals }: Props) {
  const reduced = useReducedMotion()
  const fights = (deals?.gaps ?? []).slice(0, ROUNDS)
  const name = (id: string) => storeNames.get(id) ?? id
  if (!deals) return <div id="versus" className="h-svh" aria-hidden />
  if (!fights.length) return null
  if (reduced) {
    return (
      <section id="versus" aria-labelledby="versus-title" className="grid gap-2">
        <h2 id="versus-title" className="sr-only">
          Shop around: the biggest price gaps today
        </h2>
        {fights.map((f, i) => (
          <div key={f.game.id} className="relative h-[min(100svh,56rem)] overflow-hidden">
            <Stage fight={f} round={i} rounds={fights.length} name={name} onOpen={onOpen} onAllDeals={onAllDeals} />
          </div>
        ))}
      </section>
    )
  }
  return <Pinned fights={fights} name={name} onOpen={onOpen} onAllDeals={onAllDeals} />
}

function Pinned({ fights, name, onOpen, onAllDeals }: { fights: GapDeal[]; name: (id: string) => string; onOpen: (id: string) => void; onAllDeals: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const n = fights.length
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const [round, setRound] = useState(0)
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const r = Math.min(n - 1, Math.floor(p * n))
    if (r !== round) {
      setRound(r)
      playSound("tick")
    }
  })
  // How far into its own round the scroll is, 0..1
  const local = useTransform(scrollYProgress, (p) => {
    const x = p * n
    return Math.min(1, Math.max(0, x - Math.min(n - 1, Math.floor(x))))
  })

  return (
    <section ref={ref} id="versus" aria-labelledby="versus-title" className="relative" style={{ height: `${n * 100 + 100}svh` }}>
      <h2 id="versus-title" className="sr-only">
        Shop around: the biggest price gaps today
      </h2>
      <div className="sticky top-0 h-svh overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <m.div
            key={round}
            className="absolute inset-0"
            initial={{ clipPath: "inset(0% 0% 0% 100%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            exit={{ clipPath: "inset(0% 100% 0% 0%)", transition: { duration: 0.7, ease: ease.cineInOut } }}
            transition={{ duration: 0.8, ease: ease.cineInOut }}
          >
            <Stage fight={fights[round]!} round={round} rounds={n} name={name} local={local} onOpen={onOpen} onAllDeals={onAllDeals} />
          </m.div>
        </AnimatePresence>
      </div>
    </section>
  )
}

/**
 * One round. `local` (0..1, the scroll through this round) drives the blows; without it the
 * round shows its outcome.
 */
function Stage({
  fight,
  round,
  rounds,
  name,
  local,
  onOpen,
  onAllDeals,
}: {
  fight: GapDeal
  round: number
  rounds: number
  name: (id: string) => string
  local?: MotionValue<number>
  onOpen: (id: string) => void
  onAllDeals: () => void
}) {
  const { game, high, gap } = fight
  const low = game.best
  const still = useTransform(() => 1)
  const t = local ?? still
  // The blows land over the middle of the round; the K.O. holds at its end.
  const health = useTransform(t, [0.12, 0.72], [1, 0])
  const damage = useTransform(t, [0.12, 0.72], [0, gap])
  const damageText = useTransform(damage, (v) => `−${formatPrice(v)}`)
  const damageShown = useTransform(t, [0.1, 0.16], [0, 1])
  const ko = useTransform(t, [0.7, 0.8], [0, 1])
  const koScale = useTransform(t, [0.7, 0.8], [1.6, 1])

  return (
    <div className="dark relative size-full bg-background text-foreground">
      {/* The lime half: the dearer shop's corner */}
      <div aria-hidden className="absolute inset-0 bg-primary [clip-path:polygon(0_56%,100%_44%,100%_100%,0_100%)] md:[clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]" />

      {/* The HUD: round, health bars, damage */}
      <div className="absolute inset-x-4 top-[calc(var(--height-bar-mobile)+0.75rem)] grid grid-cols-[1fr_auto_1fr] items-start gap-3 md:inset-x-8 md:top-[calc(var(--height-bar)+0.75rem)] md:gap-5">
        <Fighter side="left" shop={name(low.store)} health={still} />
        <div className="grid justify-items-center gap-1 pt-5">
          <span className="chamfer-sm bg-foreground px-3 py-1.5 font-display text-sm leading-none text-background md:text-base">
            R{round + 1}
          </span>
          <span className="label-caps text-muted-foreground max-md:hidden">
            {round + 1} / {rounds}
          </span>
        </div>
        <Fighter side="right" shop={name(high.store)} health={health} damage={damageText} damageShown={damageShown} />
      </div>

      {/* What this is, in the empty corner of the ink side */}
      <div className="absolute top-[32%] left-8 hidden max-w-[24%] gap-4 md:grid">
        <span className="label-caps text-muted-foreground">Shop around</span>
        <p className="font-display text-[clamp(1.75rem,3vw,3.25rem)] leading-[0.92] uppercase">Same game. Two shops.</p>
        <p className="text-base text-muted-foreground">The same version, priced today.{local ? " Scroll to settle it." : ""}</p>
      </div>

      {/* The prices, each in its own corner */}
      <div className="absolute top-[calc(var(--height-bar-mobile)+7rem)] left-4 grid gap-2 md:top-auto md:bottom-10 md:left-8">
        <span className="label-caps text-muted-foreground">Cheapest at {name(low.store)}</span>
        <Price value={low.price} className="text-primary-ink" />
        <span className="text-sm text-muted-foreground md:text-base">{version(fight)}</span>
      </div>
      <div className="on-lime absolute right-4 bottom-8 grid justify-items-end gap-2 bg-transparent text-right md:right-8 md:bottom-10">
        <span className="label-caps text-muted-foreground">Dearest at {name(high.store)}</span>
        <Price value={high.price} />
        <span className="text-sm text-muted-foreground md:text-base">{version(fight)}</span>
      </div>

      {/* The game, centre stage */}
      <div className="absolute top-1/2 left-1/2 grid w-[min(36vw,10rem)] -translate-x-1/2 -translate-y-[40%] justify-items-center gap-3 md:w-[min(22vw,19rem)] md:-translate-y-[52%] md:gap-4">
        <button
          type="button"
          data-game-card={game.id}
          onClick={() => onOpen(game.id)}
          aria-label={`${game.title}: see all prices`}
          className="group/cover relative block aspect-[4/5] w-full rotate-[-3deg] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
        >
          <span className="chamfer-lg absolute -inset-2 bg-background md:-inset-3" />
          <span className="chamfer-lg absolute inset-0 overflow-hidden bg-raised">
            <CoverArt src={game.image} title={game.title} width={600} className="transition-transform duration-[1.4s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/cover:scale-[1.05]" />
          </span>
        </button>
        <p className="chamfer-sm max-w-[18rem] bg-background px-4 py-2.5 text-center font-display text-sm leading-tight text-foreground uppercase md:text-lg">
          {game.title}
        </p>
      </div>

      {/* K.O. */}
      <m.div
        aria-hidden
        style={{ opacity: ko, scale: koScale }}
        className="pointer-events-none absolute bottom-[21%] left-5 font-display text-[clamp(3.5rem,12vw,12rem)] leading-none text-ink rotate-[-8deg] md:right-[8%] md:bottom-[34%] md:left-auto"
      >
        K.O.
      </m.div>
      <m.div style={{ opacity: ko }} className="absolute bottom-10 left-1/2 hidden -translate-x-1/2 md:block">
        <Button size="lg" className="bg-ink text-lime hover:bg-graphite" onClick={round + 1 === rounds ? onAllDeals : () => onOpen(game.id)}>
          <RollText>{round + 1 === rounds ? "All of today's deals" : `Save ${formatPrice(gap)}`}</RollText>
          <ButtonCircle className="bg-lime text-ink" />
        </Button>
      </m.div>
      <p className="sr-only">
        {game.title}, {version(fight)}: {formatPrice(low.price)} at {name(low.store)}, {formatPrice(high.price)} at {name(high.store)}. Save {formatPrice(gap)}.
      </p>
    </div>
  )
}

/** A price in the display face, its "Rs" small and raised, so the figure itself can run huge on one line. */
function Price({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-start font-display text-[clamp(2.5rem,6.4vw,7rem)] leading-[0.85] whitespace-nowrap", className)}>
      <span className="mt-[0.1em] mr-[0.12em] text-[0.38em]">Rs</span>
      {formatCount(value)}
    </span>
  )
}

/** A fighter's name over a health bar; the right one's bar empties from the centre outwards. */
function Fighter({
  side,
  shop,
  health,
  damage,
  damageShown,
}: {
  side: "left" | "right"
  shop: string
  health: MotionValue<number>
  damage?: MotionValue<string>
  damageShown?: MotionValue<number>
}) {
  const right = side === "right"
  return (
    <div className={cn("grid min-w-0 gap-2", right && "justify-items-end text-right md:text-ink")}>
      <span className="max-w-full truncate font-display text-base leading-none uppercase md:text-2xl">{shop}</span>
      <div className={cn("relative h-3 w-full -skew-x-[20deg] bg-foreground/15 md:h-4", right && "md:bg-ink/15")}>
        <m.div style={{ scaleX: health }} className={cn("absolute inset-0", right ? "origin-right bg-foreground md:bg-ink" : "origin-left bg-primary")} />
      </div>
      {damage && (
        <m.span style={{ opacity: damageShown }} className="font-display text-sm leading-none text-primary-ink md:text-lg md:text-ink">
          {damage}
        </m.span>
      )}
    </div>
  )
}
