import { AnimatePresence, animate, useIsPresent, useMotionTemplate, useMotionValue, useTransform, type MotionValue } from "motion/react"
// The full <motion.*> elements (the rest of the app uses the slim <m.*> ones): this screen
// is a lazy chunk of its own, so their features don't add to the page's first load.
// Not `motion` from "motion/react", which would pull them into that first load.
import * as motion from "motion/react-client"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { cn } from "cn"
import type { FiltersResponse } from "@lootledger/shared"
import type { TitleEntrance } from "@/components/hero"
import { CountUp } from "@/components/motion/count-up"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { useImagePreload } from "@/hooks/use-image-preload"
import { ease } from "@/lib/motion"
import { playOnGesture } from "@/lib/sfx"

// Nothing on this screen is faked: each loading step resolves only once that part of
// the page has really loaded. The steps are paced so that even a fast load reads as a
// sequence, and the screen never holds the page longer than GIVE_UP_MS. Kept short:
// most visitors arrive on a phone from a link and want a price, not a show.
const FIRST_LINE_MS = 250
const NEXT_LINE_MS = 150
const ART_WAIT_MS = 1200 // once the cover list is known; then go on without the stragglers
const GIVE_UP_MS = 3500
const FULL_HOLD_MS = 250 // the bar rests full a moment before it turns into START
const EXIT_S = 1.2
// START: each letter flies into the hero's title, one after another.
const FLY_S = 1.1
const FLY_STAGGER = 0.04
const LANDED_S = FLY_S + 9 * FLY_STAGGER + 0.15 // the last letter down, with a frame or two to measure

const FONTS = ["1em Anton", "1em 'Urbanist Variable'"]
const LETTERS = [..."LootLedger"]

// Keys that never count as "any key".
const NOT_ANY_KEY = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "NumLock", "ScrollLock", "ContextMenu"])

interface Step {
  /** What the screen says while this step runs. */
  busy: string
  /** Share of the bar, out of 100. */
  weight: number
  done: boolean
  /** 0–1 done while running, when known. */
  fraction?: number
}

export interface LoadingScreenProps {
  meta: FiltersResponse | undefined
  metaFailed: boolean
  /** Games matching the current filters, once the first page is in. */
  matches: number | undefined
  matchesFailed: boolean
  /** Images the page shows first (the hero's covers), once known. */
  art: readonly string[] | undefined
  artFailed: boolean
  /** Called when the reader presses START (or skips); the screen then fades away. */
  onContinue: () => void
  /** On START once loaded, the letters fly into the hero's title: hide it, then show it once they land. */
  onTitle: (entrance: Exclude<TitleEntrance, "slide">) => void
}

/**
 * WG's loader, shown on a first visit to the home page until the library is ready: the
 * name's letters sharpen into neon over their underlines and a pill bar fills as the
 * page really loads, then the bar turns into a START button. START, any key, a tap or
 * a click continues (or skips, before then). Loaded on demand by <LoadingScreen>
 * (intro.tsx), which decides whether to show it at all.
 */
export function Screen({ meta, metaFailed, matches, matchesFailed, art: artUrls, artFailed, onContinue, onTitle }: LoadingScreenProps) {
  const root = useRef<HTMLDivElement>(null)
  const start = useRef<HTMLButtonElement>(null)
  const present = useIsPresent()
  const touch = useMemo(() => matchMedia("(hover: none)").matches, [])

  // ---- what's loading
  const [fontsDone, setFontsDone] = useState(false)
  useEffect(() => {
    let cancelled = false
    Promise.all(FONTS.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .catch(() => undefined)
      .then(() => !cancelled && setFontsDone(true))
    return () => {
      cancelled = true
    }
  }, [])

  const art = useImagePreload(artUrls ?? [])
  const artKnown = artUrls !== undefined
  const [artDeadline, setArtDeadline] = useState(false)
  useEffect(() => {
    if (!artKnown) return
    const t = setTimeout(() => setArtDeadline(true), ART_WAIT_MS)
    return () => clearTimeout(t)
  }, [artKnown])

  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(t)
  }, [])

  const steps: Step[] = [
    { busy: "Loading fonts", weight: 10, done: fontsDone },
    { busy: "Opening the ledger", weight: 25, done: meta !== undefined || metaFailed },
    { busy: "Checking in stores", weight: 15, done: meta !== undefined || metaFailed },
    { busy: "Sorting the library", weight: 25, done: matches !== undefined || matchesFailed },
    {
      busy: "Loading cover art",
      weight: 25,
      fraction: art.total ? art.settled / art.total : undefined,
      done: artFailed || (artKnown && (art.settled === art.total || artDeadline)),
    },
  ].map((s): Step => ({ ...s, done: s.done || gaveUp }))

  // ---- pacing: finish one step at a time
  const [shown, setShown] = useState(0)
  const nextFinished = steps[shown]?.done === true
  useEffect(() => {
    if (!nextFinished) return
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? FIRST_LINE_MS : NEXT_LINE_MS)
    return () => clearTimeout(t)
  }, [nextFinished, shown])
  const loaded = shown === steps.length
  const current = steps[shown]

  // ---- progress: finished steps, plus a creep into the one running
  const progress = useMotionValue(0)
  const doneWeight = steps.slice(0, shown).reduce((sum, s) => sum + s.weight, 0)
  const running = current ? current.weight * 0.9 * (current.done ? 1 : (current.fraction ?? 0.5)) : 0
  const target = loaded ? 100 : doneWeight + running
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    const controls = animate(progress, target, { duration: 0.9, ease: ease.wg, onComplete: () => setFilled(target === 100) })
    return () => controls.stop()
  }, [progress, target])

  // Ready once the bar has visibly filled and rested a moment, not the moment loading ends.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!filled) return
    const t = setTimeout(() => setReady(true), FULL_HOLD_MS)
    return () => clearTimeout(t)
  }, [filled])

  // START takes the focus, so Enter and Space press it.
  useEffect(() => {
    if (ready) start.current?.focus({ preventScroll: true })
  }, [ready])

  // ---- continue: START, any key or any tap once ready; a tap, a click or Esc skips before
  const left = useRef(false)
  const [handoff, setHandoff] = useState(false)
  const scrollTo = useScrollTo()
  const go = () => {
    if (left.current) return
    left.current = true
    playOnGesture("start") // the first gesture browsers allow audio on
    // Once loaded, the letters become the hero's title; a skip before then spreads them away.
    if (ready && document.getElementById("hero-title")) {
      scrollTo(0, { instant: true }) // the title must be where the letters are measured to land
      setHandoff(true)
      onTitle("flying")
    }
    onContinue()
  }

  // ---- the hand-off: once the hero has laid its title out (hidden), measure each letter
  const letters = useRef<HTMLDivElement>(null)
  const [flights, setFlights] = useState<Flight[] | null>(null)
  useEffect(() => {
    if (!handoff) return
    let tries = 0
    let raf = requestAnimationFrame(function measure() {
      const to = document.querySelectorAll<HTMLElement>("#hero-title [data-part]")
      const from = letters.current?.querySelectorAll<HTMLElement>("[data-letter]")
      if (to.length === LETTERS.length && from?.length === LETTERS.length) return setFlights([...to].map((el, i) => flight(from[i]!, el)))
      if (++tries < 30) raf = requestAnimationFrame(measure)
      else onTitle("landed") // no title to fly into: show it as it is
    })
    return () => cancelAnimationFrame(raf)
  }, [handoff, onTitle])

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || NOT_ANY_KEY.has(e.key)) return
    e.preventDefault() // no scrolling or typing into the page underneath
    if (ready || e.key === "Escape") go()
  })
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener("keydown", handler, { capture: true })
    return () => window.removeEventListener("keydown", handler, { capture: true })
  }, [])

  // The page underneath must not scroll (wheel and touch never reach Lenis).
  useEffect(() => {
    const el = root.current
    if (!el) return
    const block = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }
    el.addEventListener("wheel", block, { passive: false })
    el.addEventListener("touchmove", block, { passive: false })
    return () => {
      el.removeEventListener("wheel", block)
      el.removeEventListener("touchmove", block)
    }
  }, [])

  return (
    <motion.div
      ref={root}
      // Once leaving, the page fading in underneath takes the pointer; not while letters are
      // in flight, though, since scrolling then would move the title out from under them.
      className={cn("dark fixed inset-0 z-[100] flex flex-col overflow-hidden text-foreground select-none", !present && !handoff && "pointer-events-none")}
      // Its own exit keeps the screen mounted while the parts inside play theirs; after a
      // hand-off it fades off the flown letters only once the hero's own show beneath.
      exit={{ opacity: 0 }}
      transition={handoff ? { duration: 0.3, delay: LANDED_S } : { duration: 0.2, delay: EXIT_S - 0.2 }}
      // Any tap or click skips, loaded or not: the page underneath fills in as it arrives.
      onPointerDown={go}
    >
      <p className="sr-only" role="status">
        {ready ? "LootLedger is ready. Press Start to continue." : `Loading LootLedger: ${current?.busy ?? ""}`}
      </p>

      {/* The black fades to reveal the page's entrance behind the letters */}
      <motion.div aria-hidden className="absolute inset-0 bg-black" exit={{ opacity: 0 }} transition={{ duration: EXIT_S, ease: ease.wg }} />
      <div aria-hidden className="grain pointer-events-none absolute -inset-[50%] opacity-[0.05]" />

      {/* The wordmark sits where the header's will land */}
      <motion.div
        className="relative mx-2 mt-2 flex h-(--height-bar-mobile) shrink-0 items-center justify-center md:h-(--height-bar)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="font-display text-2xl leading-none uppercase md:text-4xl">
          <span>Loot</span>
          <span className="text-neon">Ledger</span>
        </p>
      </motion.div>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-[clamp(2.5rem,9vh,6rem)] px-4 pb-[calc(var(--height-bar-mobile)+0.5rem)] md:pb-[calc(var(--height-bar)+0.5rem)]">
        <motion.div
          className="grid justify-items-center gap-1 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.6, ease: ease.wg }}
        >
          <span className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Tracking</span>
          <Swap id={meta ? "meta" : metaFailed ? "offline" : "wait"} className="text-lg font-medium text-white/85 md:text-xl">
            {meta ? (
              <>
                <CountUp value={meta.totals.games} /> games · <CountUp value={meta.stores.length} /> stores
              </>
            ) : metaFailed ? (
              "Offline"
            ) : (
              "Connecting…"
            )}
          </Swap>
        </motion.div>

        <Letters ref={letters} progress={progress} ready={ready} handoff={handoff} flying={flights !== null} />

        <motion.div
          className="grid h-24 justify-items-center content-start gap-4"
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.7, ease: ease.wgInOut }}
        >
          <motion.span
            className="flex h-4 items-center text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase"
            animate={{ opacity: ready ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <Swap id={current?.busy ?? "loaded"}>{current?.busy ?? "Loaded"}</Swap>
          </motion.span>
          <Start ref={start} progress={progress} ready={ready} />
          <motion.span
            className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            initial={false}
            animate={{ opacity: ready ? 1 : 0 }}
            transition={{ duration: 0.5, delay: ready ? 0.6 : 0 }}
          >
            {touch ? "Tap to start" : "Or press any key"}
          </motion.span>
        </motion.div>
      </div>

      {flights && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {flights.map((f, i) => (
            <Flyer key={i} flight={f} index={i} onLanded={i === flights.length - 1 ? () => onTitle("landed") : undefined} />
          ))}
        </div>
      )}
    </motion.div>
  )
}

/** Text that rolls to its next value (INK slide) whenever `id` changes. */
function Swap({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          exit={{ y: "-110%" }}
          transition={{ duration: 0.5, ease: ease.inkRoll }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * WG's name entry: one underline per letter, each letter sharpening from a dim neon
 * blur as `progress` passes it, left to right; all of them glow once ready. On START
 * the letters fly off into the hero's title (<Flyer>); on a skip the row spreads large
 * and blurs away over the page.
 */
function Letters({
  ref,
  progress,
  ready,
  handoff,
  flying,
}: {
  ref: React.Ref<HTMLDivElement>
  progress: MotionValue<number>
  ready: boolean
  handoff: boolean
  /** The flyers have taken the letters' place. */
  flying: boolean
}) {
  return (
    <motion.div
      ref={ref}
      aria-hidden
      className={cn("grid w-full max-w-5xl grid-cols-10 gap-[clamp(0.375rem,2vw,2.5rem)]", flying && "[&_[data-letter]]:invisible")}
      exit={handoff ? undefined : { scale: 2.2, opacity: 0, filter: "blur(10px)" }}
      transition={{ duration: EXIT_S, ease: ease.wg }}
    >
      {LETTERS.map((ch, i) => (
        <span key={i} className="grid justify-items-center gap-2 md:gap-3">
          <Letter progress={progress} index={i} ready={ready}>
            {ch}
          </Letter>
          <motion.span className="h-px w-full bg-white/20" exit={{ opacity: 0 }} transition={{ duration: 0.3 }} />
        </span>
      ))}
    </motion.div>
  )
}

function Letter({ progress, index, ready, children }: { progress: MotionValue<number>; index: number; ready: boolean; children: string }) {
  // Staggered windows across the bar: the first letter from 0–40%, the last 54–94%.
  const from = index * 6
  const range = [from, from + 40]
  const blur = useTransform(progress, range, [14, 0])
  const filter = useMotionTemplate`blur(${blur}px)`
  const opacity = useTransform(progress, range, [0, 1])
  return (
    <motion.span
      data-letter
      className="font-sans text-[clamp(1.5rem,5.5vw,4rem)] leading-none font-semibold text-primary"
      style={{ filter, opacity }}
      animate={{ textShadow: ready ? "0 0 18px rgba(212,251,8,0.65)" : "0 0 0px rgba(212,251,8,0)" }}
      transition={{ duration: 0.8 }}
    >
      {children}
    </motion.span>
  )
}

interface Flight {
  /** The loader's letter, and the hero's (uppercase, in its own type and colours). */
  from: string
  to: string
  /** Where the hero's letter sits, and its type, copied so the flyer lands on it exactly. */
  box: { left: number; top: number; width: number; height: number }
  style: React.CSSProperties
  /** Start: the loader letter's centre relative to the hero letter's, and its size. */
  x: number
  y: number
  scale: number
}

function flight(from: HTMLElement, to: HTMLElement): Flight {
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  const cs = getComputedStyle(to)
  return {
    from: from.textContent ?? "",
    to: to.textContent ?? "",
    box: { left: b.left, top: b.top, width: b.width, height: b.height },
    style: {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform as React.CSSProperties["textTransform"],
      color: cs.color,
      // The neon letters' slice of the title's gradient
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition,
      backgroundClip: "text",
    },
    x: a.left + a.width / 2 - (b.left + b.width / 2),
    y: a.top + a.height / 2 - (b.top + b.height / 2),
    scale: parseFloat(getComputedStyle(from).fontSize) / parseFloat(cs.fontSize),
  }
}

/**
 * One letter's flight into the hero's title: from the loader letter's place and size to
 * the hero letter's, crossfading from the loader's neon glyph to the hero's on the way.
 * It lands on the hero's letter exactly, so the swap to the real title is invisible.
 */
function Flyer({ flight: f, index, onLanded }: { flight: Flight; index: number; onLanded?: () => void }) {
  const delay = index * FLY_STAGGER
  return (
    <motion.span
      className="absolute grid place-items-center text-left"
      style={f.box}
      initial={{ x: f.x, y: f.y, scale: f.scale }}
      animate={{ x: 0, y: 0, scale: 1 }}
      transition={{ duration: FLY_S, ease: ease.wgInOut, delay }}
      onAnimationComplete={onLanded}
    >
      <motion.span
        className="col-start-1 row-start-1 self-stretch justify-self-stretch"
        style={f.style}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: FLY_S * 0.5, delay: delay + FLY_S * 0.2 }}
      >
        {f.to}
      </motion.span>
      <motion.span
        className="col-start-1 row-start-1 font-sans leading-none font-semibold text-primary [text-shadow:0_0_18px_rgba(212,251,8,0.65)]"
        style={{ fontSize: f.style.fontSize }}
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: FLY_S * 0.45, delay: delay + FLY_S * 0.1 }}
      >
        {f.from}
      </motion.span>
    </motion.span>
  )
}

/** WG's pill bar, filling with striped neon, then turning into the START button. */
function Start({ ref, progress, ready }: { ref: React.Ref<HTMLButtonElement>; progress: MotionValue<number>; ready: boolean }) {
  const width = useTransform(progress, (v) => `${v}%`)
  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={!ready}
      aria-label={ready ? "Start" : "Loading"}
      className={cn(
        "relative grid place-items-center rounded-full border border-primary/25 bg-black p-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ready && "cursor-pointer glow-primary",
      )}
      initial={false}
      animate={{ width: ready ? 112 : 192, height: ready ? 44 : 20 }}
      whileHover={ready ? { scale: 1.06 } : undefined}
      whileTap={ready ? { scale: 0.96 } : undefined}
      transition={{ duration: 0.6, ease: ease.wg }}
    >
      <span className="absolute inset-[3px] overflow-hidden rounded-full">
        <motion.span className="relative block h-full rounded-full bg-primary" style={{ width }}>
          {/* WG's fine vertical stripes, gone once it's a button */}
          <motion.span
            className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_2px,rgb(0_0_0/0.28)_2px_3px)]"
            animate={{ opacity: ready ? 0 : 1 }}
            transition={{ duration: 0.4 }}
          />
        </motion.span>
      </span>
      <AnimatePresence>
        {ready && (
          <motion.span
            className="relative text-sm font-bold tracking-wider text-black uppercase"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: ease.wg }}
          >
            Start
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
