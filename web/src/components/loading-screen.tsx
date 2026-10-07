import { AnimatePresence, animate, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react"
// The full <motion.*> elements (the rest of the app uses the slim <m.*> ones): this screen
// is a lazy chunk of its own, so their features don't add to the page's first load.
// Not `motion` from "motion/react", which would pull them into that first load.
import * as motion from "motion/react-client"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { cn } from "cn"
import type { FiltersResponse } from "@ugs/shared"
import { CoverWall } from "@/components/motion/cover-wall"
import { Equalizer } from "@/components/motion/equalizer"
import { HazardBand } from "@/components/motion/hazard-band"
import { Odometer } from "@/components/motion/odometer"
import { RollText } from "@/components/motion/roll-text"
import { Eyebrow } from "@/components/ui/eyebrow"
import { Stat } from "@/components/ui/stat"
import { useImagePreload } from "@/hooks/use-image-preload"
import { formatCount, timeAgo } from "@/lib/format"
import { thumb } from "@/lib/images"
import { ease, pointerSpring } from "@/lib/motion"

// Nothing on this screen is faked: each boot-log line resolves only once that part of
// the page has really loaded. The lines are paced so that even a fast load reads as a
// sequence, and the screen never holds the page longer than GIVE_UP_MS. Kept short:
// most visitors arrive on a phone from a link and want a price, not a show.
const FIRST_LINE_MS = 250
const NEXT_LINE_MS = 150
const ART_WAIT_MS = 1200 // once the cover list is known; then go on without the stragglers
const GIVE_UP_MS = 3500
const AUTO_CONTINUE_MS = 700
const TIP_MS = 3600

const FONTS = ["1em Anton", "1em 'Urbanist Variable'"]

// Keys that never count as "any key".
const NOT_ANY_KEY = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "NumLock", "ScrollLock", "ContextMenu"])

const TIPS = [
  "Every card shows the cheapest in-stock offer. Open a game to compare every store.",
  "Your filters live in the address bar. Share the link and friends see exactly your list.",
  "Sort by Biggest price difference to find the games where shopping around pays off most.",
  "Hunting for a bargain? Set Condition to Used.",
  "Turn off In stock only to see offers that are sold out right now.",
  "Search skips accents and punctuation, so “spiderman” finds Spider-Man.",
  "Some stores only say PlayStation. Those offers show under PlayStation, not under PS5 or PS4.",
]

type Tone = "ok" | "fail" | "wait"
interface Step {
  label: string
  /** What the progress bar says while this step runs. */
  busy: string
  /** Share of the bar, out of 100. */
  weight: number
  result: { tone: Tone; text: string } | null
  /** Shown while the step runs, e.g. "12/30". */
  live?: string
  /** 0–1 done while running, when known. */
  fraction?: number
}

const ok = (text: string) => ({ tone: "ok" as const, text })
const fail = (text: string) => ({ tone: "fail" as const, text })
const pad = (n: number) => String(n).padStart(2, "0")

export interface LoadingScreenProps {
  meta: FiltersResponse | undefined
  metaFailed: boolean
  /** Games matching the current filters, once the first page is in. */
  matches: number | undefined
  matchesFailed: boolean
  /** Cover art for the wall, once known. */
  covers: readonly string[] | undefined
  coversFailed: boolean
  /** Images the page shows first (the hero's covers), loaded alongside. */
  warm: readonly string[]
  /** Called when the reader continues (or skips); the screen then wipes away. */
  onContinue: () => void
}

/**
 * A video-game loading screen, shown on a first visit to the home page until the library
 * is ready: a boot log of what's really loading, a rolling percentage, a segmented bar,
 * tips, and "press any key". Continues by itself shortly after; a tap, a click or Esc
 * skips it at any time. Loaded on demand by <LoadingScreen> (intro.tsx), which decides
 * whether to show it at all.
 */
export function Screen({ meta, metaFailed, matches, matchesFailed, covers, coversFailed, warm, onContinue }: LoadingScreenProps) {
  const root = useRef<HTMLDivElement>(null)
  const touch = useMemo(() => matchMedia("(hover: none)").matches, [])

  // ---- what's loading
  const [fontFaces, setFontFaces] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    Promise.all(FONTS.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .catch(() => undefined)
      .then(() => {
        let n = 0
        document.fonts.forEach((f) => {
          if (f.status === "loaded") n++
        })
        if (!cancelled) setFontFaces(n)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const wall = useMemo(() => covers?.map((u) => thumb(u, 400)) ?? [], [covers])
  const art = useImagePreload(useMemo(() => [...wall, ...warm], [wall, warm]))
  const coversKnown = covers !== undefined
  const [artDeadline, setArtDeadline] = useState(false)
  useEffect(() => {
    if (!coversKnown) return
    const t = setTimeout(() => setArtDeadline(true), ART_WAIT_MS)
    return () => clearTimeout(t)
  }, [coversKnown])

  const [gaveUp, setGaveUp] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(t)
  }, [])

  const artCount = art.total ? `${art.loaded.size}/${art.total}` : "None"
  const steps: Step[] = [
    { label: "Fonts", busy: "Loading fonts", weight: 10, result: fontFaces === null ? null : ok(`${fontFaces} faces`) },
    {
      label: "Ledger",
      busy: "Opening the ledger",
      weight: 25,
      result: meta ? ok(`${formatCount(meta.totals.games)} games`) : metaFailed ? fail("Offline") : null,
    },
    { label: "Stores", busy: "Checking in stores", weight: 15, result: meta ? ok(`${meta.stores.length} tracked`) : metaFailed ? fail("Offline") : null },
    {
      label: "Library",
      busy: "Sorting the library",
      weight: 25,
      result: matches !== undefined ? ok(`${formatCount(matches)} matches`) : matchesFailed ? fail("Failed") : null,
    },
    {
      label: "Cover art",
      busy: "Loading cover art",
      weight: 25,
      live: art.total ? artCount : undefined,
      fraction: art.total ? art.settled / art.total : undefined,
      result: coversFailed ? fail("Skipped") : coversKnown && (art.settled === art.total || artDeadline) ? ok(artCount) : null,
    },
  ].map((s): Step => (s.result || !gaveUp ? s : { ...s, result: { tone: "wait", text: "Still loading" } }))

  // ---- pacing: reveal one finished line at a time
  const [shown, setShown] = useState(0)
  const nextFinished = steps[shown]?.result != null
  useEffect(() => {
    if (!nextFinished) return
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? FIRST_LINE_MS : NEXT_LINE_MS)
    return () => clearTimeout(t)
  }, [nextFinished, shown])
  const ready = shown === steps.length
  const current = steps[shown]

  // ---- progress: finished lines, plus a creep into the one running
  const progress = useMotionValue(0)
  const doneWeight = steps.slice(0, shown).reduce((sum, s) => sum + s.weight, 0)
  const running = current ? current.weight * 0.9 * (current.result ? 1 : (current.fraction ?? 0.5)) : 0
  const target = ready ? 100 : Math.round(doneWeight + running) // whole, so the odometer rests on a digit
  useEffect(() => {
    const controls = animate(progress, target, { duration: 0.9, ease: ease.wg })
    return () => controls.stop()
  }, [progress, target])

  // ---- continue: by itself after a countdown, or on any key / click once ready
  const countdown = useMotionValue(0)
  const cont = useEffectEvent(() => onContinue())
  useEffect(() => {
    if (!ready) return
    const controls = animate(countdown, 1, { duration: AUTO_CONTINUE_MS / 1000, ease: "linear", onComplete: () => cont() })
    return () => controls.stop()
  }, [ready, countdown])

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key) || NOT_ANY_KEY.has(e.key)) return
    e.preventDefault() // no scrolling or typing into the page underneath
    if (ready || e.key === "Escape") onContinue()
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

  // The wall leans away from the pointer.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const shiftX = useSpring(useTransform(px, (v) => v * -40), pointerSpring)
  const shiftY = useSpring(useTransform(py, (v) => v * -30), pointerSpring)

  return (
    <motion.div
      ref={root}
      className="dark fixed inset-x-0 top-0 z-[100] flex text-foreground h-[calc(100dvh+var(--band))] flex-col select-none [--band:4rem] md:[--band:6rem]"
      exit={{ y: "-100%" }}
      transition={{ duration: 1.2, ease: ease.wgWipe }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return
        px.set(e.clientX / window.innerWidth - 0.5)
        py.set(e.clientY / window.innerHeight - 0.5)
      }}
      // Any tap or click skips, loaded or not: the page underneath fills in as it arrives.
      onPointerDown={() => onContinue()}
    >
      <p className="sr-only" role="status">
        {ready ? "LootLedger is ready. Press any key to continue." : `Loading LootLedger: ${current?.busy ?? ""}`}
      </p>

      <div className="relative isolate h-dvh shrink-0 overflow-hidden bg-black">
        <CoverWall images={wall} loaded={art.loaded} progress={progress} shiftX={shiftX} shiftY={shiftY} />
        {/* Keep the HUD legible: a vignette and a dark floor */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_0%,rgb(0_0_0/0.45)_55%,#000_100%)]" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-4/5 bg-linear-to-t from-black via-black/85 to-transparent" />
        {/* WG star glow, brightening once everything is in */}
        <motion.div
          aria-hidden
          className="absolute -bottom-56 -left-56 size-[40rem] rounded-full bg-primary blur-[160px]"
          animate={{ opacity: ready ? 0.35 : [0.12, 0.22, 0.12] }}
          transition={ready ? { duration: 0.8 } : { duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div aria-hidden className="grain pointer-events-none absolute -inset-[50%] opacity-[0.06]" />

        {/* The HUD sinks a little as the screen wipes up, so the two part ways */}
        <motion.div className="relative flex h-full flex-col" exit={{ y: "20vh" }} transition={{ duration: 1.2, ease: ease.wgWipe }}>
          <TopBar meta={meta} metaFailed={metaFailed} />

          <div className="mt-auto grid grid-cols-1 gap-5 p-4 compact:gap-3 md:gap-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-end">
            <Rise delay={0.15}>
              <Readout progress={progress} ready={ready} />
            </Rise>
            <Rise delay={0.25}>
              <BootLog steps={steps} shown={shown} stores={meta?.stores.map((s) => s.name)} />
            </Rise>
            <Rise delay={0.35} className="lg:col-span-2">
              <Bar label={ready ? "Loot secured" : (current?.busy ?? "")} ready={ready} progress={progress} />
            </Rise>
            <Rise delay={0.45} className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 lg:col-span-2">
              <Tips />
              <Prompt ready={ready} countdown={countdown} touch={touch} />
            </Rise>
          </div>
        </motion.div>
      </div>

      {/* WG's hazard stripes trail the wipe across the page */}
      <HazardBand className="h-(--band) shrink-0 rounded-none md:h-(--band)" />
    </motion.div>
  )
}

/** Entrance: rise 40px and fade in (WG blocks). */
function Rise({ delay, className, children }: { delay: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      className={cn("min-w-0", className)}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: ease.wg, delay }}
    >
      {children}
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

/** The step in progress: WG's live dot, pulsing. */
function LiveDot() {
  return <span aria-hidden className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary glow-primary" />
}

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-sans text-[10px] leading-none font-semibold text-white">{children}</kbd>
}

/** Same shape as the site header (WG bar), with a live FPS readout like WG's. */
function TopBar({ meta, metaFailed }: { meta: FiltersResponse | undefined; metaFailed: boolean }) {
  const online = meta !== undefined
  return (
    <motion.div
      className="relative mx-2 mt-2 flex h-(--height-bar-mobile) shrink-0 items-center justify-between gap-4 rounded-2xl bg-neutral-800/40 px-3 backdrop-blur-[16px] md:h-(--height-bar) md:px-4"
      initial={{ y: "-140%" }}
      animate={{ y: "0%" }}
      transition={{ duration: 0.8, ease: ease.wg }}
    >
      <div className="flex items-center gap-4 md:gap-5">
        <Equalizer live={online} />
        <Stat className="hidden sm:flex" dot={online ? "live" : "idle"} label={online ? "Online" : metaFailed ? "Offline" : "Connecting"} />
        <Stat className="hidden md:flex" value={<Fps />} label="FPS" />
      </div>
      <p className="absolute left-1/2 -translate-x-1/2 font-display text-2xl leading-none uppercase md:text-4xl">
        <span>Loot</span>
        <span className="text-neon">Ledger</span>
      </p>
      <Stat value={meta?.generated ? timeAgo(meta.generated) : "…"} label="Updated" />
    </motion.div>
  )
}

/** Frames drawn in the last half second, written straight to the DOM. */
function Fps() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let frames = 0
    let since = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      frames++
      if (now - since >= 500) {
        if (ref.current) ref.current.textContent = String(Math.round((frames * 1000) / (now - since)))
        frames = 0
        since = now
      }
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [])
  return <span ref={ref}>--</span>
}

/** Seconds since the browser started loading the page; stops once everything is in. */
function LoadClock({ stopped }: { stopped: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const write = () => {
      if (ref.current) ref.current.textContent = `${(performance.now() / 1000).toFixed(2)} s`
    }
    if (stopped) return write()
    let raf = requestAnimationFrame(function tick() {
      write()
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [stopped])
  return <span ref={ref} className="text-white tabular-nums" />
}

function Readout({ progress, ready }: { progress: MotionValue<number>; ready: boolean }) {
  return (
    <div className="grid justify-items-start gap-1">
      <Eyebrow className="text-primary">
        <Swap id={ready ? "ready" : "loading"}>{ready ? "Loot secured" : "Now loading"}</Swap>
      </Eyebrow>
      <motion.div
        className="flex items-start font-display text-[clamp(6.5rem,22vw,18rem)] leading-none text-primary compact:text-[5.5rem]"
        animate={{ filter: ready ? "drop-shadow(0px 0px 28px rgba(212,251,8,0.55))" : "drop-shadow(0px 0px 0px rgba(212,251,8,0))" }}
        transition={{ duration: 0.8 }}
      >
        <Odometer value={progress} />
        <span className="mt-[0.06em] ml-[0.04em] text-[0.3em] leading-none">%</span>
      </motion.div>
    </div>
  )
}

function BootLog({ steps, shown, stores }: { steps: Step[]; shown: number; stores: string[] | undefined }) {
  return (
    <section aria-label="Boot log" className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 backdrop-blur-[37.5px] compact:p-3 md:p-5">
      <div className="mb-2 flex items-center justify-between gap-4">
        <Eyebrow className="text-primary">Boot log</Eyebrow>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {pad(shown)}/{pad(steps.length)}
        </span>
      </div>
      <ol className="grid text-[11px] font-semibold tracking-wider uppercase md:text-xs">
        {steps.map((s, i) => {
          const state = i < shown ? "done" : i === shown ? "running" : "queued"
          return (
            <li
              key={s.label}
              className={cn(
                "-mx-2 grid grid-cols-[2ch_auto_minmax(1rem,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 transition-colors compact:py-1 duration-300",
                state === "running" && "sweep bg-white/5",
              )}
            >
              <span className="text-white/30 tabular-nums">{pad(i + 1)}</span>
              <span className={cn("transition-colors duration-300", state === "queued" ? "text-white/35" : "text-white")}>{s.label}</span>
              <span aria-hidden className="border-t border-dashed border-white/15" />
              <Swap id={state}>
                {state === "done" ? (
                  <span className={s.result!.tone === "ok" ? "text-primary" : s.result!.tone === "fail" ? "text-destructive" : "text-muted-foreground"}>
                    {s.result!.text}
                  </span>
                ) : state === "running" ? (
                  <>
                    <span className="text-muted-foreground tabular-nums">{s.live}</span>
                    <LiveDot />
                  </>
                ) : (
                  <span className="text-white/25">Queued</span>
                )}
              </Swap>
              {s.label === "Stores" && stores && <StoreChips names={stores} lit={i < shown} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** The stores check in one by one: WG chips turning neon. */
function StoreChips({ names, lit }: { names: string[]; lit: boolean }) {
  return (
    <motion.div
      className="col-span-4 overflow-hidden compact:hidden"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      transition={{ duration: 0.5, ease: ease.wg }}
    >
      <div className="flex flex-wrap gap-1 pt-2">
        {names.map((name, i) => (
          <motion.span
            key={name}
            className="rounded-2xl px-2 py-1 text-[10px] leading-none normal-case"
            initial={false}
            animate={
              lit
                ? { backgroundColor: "#d4fb08", color: "#253300", scale: [1, 1.12, 1] }
                : { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", scale: 1 }
            }
            transition={{ duration: 0.35, delay: lit ? i * 0.07 : 0 }}
          >
            {name}
          </motion.span>
        ))}
      </div>
    </motion.div>
  )
}

/** Segmented bar that lights one whole block at a time, with a spark at the edge. */
function Bar({ label, ready, progress }: { label: string; ready: boolean; progress: MotionValue<number> }) {
  const blocks = useTransform(progress, (v) => Math.ceil(v / 2.5)) // 40 blocks
  const scaleX = useTransform(blocks, (b) => b / 40)
  const edge = useTransform(blocks, (b) => `${b * 2.5}%`)

  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-4 text-[11px] font-semibold tracking-wider uppercase md:text-xs">
        <span className="flex min-w-0 items-center gap-2 text-white">
          {!ready && <LiveDot />}
          <Swap id={label}>{label}</Swap>
        </span>
        <span className="shrink-0 text-muted-foreground">
          Load time <LoadClock stopped={ready} />
        </span>
      </div>
      <div className={cn("relative h-3 transition-[filter] duration-700 md:h-4", ready && "glow-primary")}>
        <div className="segments absolute inset-0">
          <div className="absolute inset-0 bg-white/10" />
          <motion.div className="absolute inset-0 origin-left bg-primary" style={{ scaleX }} />
        </div>
        <motion.div
          aria-hidden
          className="absolute top-1/2 h-8 w-20 -translate-x-full -translate-y-1/2 rounded-full bg-primary/50 blur-xl"
          style={{ left: edge }}
          animate={{ opacity: ready ? 0 : 1 }}
        />
      </div>
    </div>
  )
}

/** Game-style tips; a random one first, then the next every few seconds. */
function Tips() {
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length))
  useEffect(() => {
    const t = setTimeout(() => setI((n) => (n + 1) % TIPS.length), TIP_MS)
    return () => clearTimeout(t)
  }, [i])

  return (
    <div className="grid max-w-xl min-w-0 flex-1 basis-80 gap-2">
      <div className="flex items-center gap-4">
        <Eyebrow className="text-primary">
          Tip {pad(i + 1)}/{pad(TIPS.length)}
        </Eyebrow>
        <button
          type="button"
          className="group/roll text-[11px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:text-white focus-visible:text-white"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setI((n) => (n + 1) % TIPS.length)}
        >
          <RollText>Next tip →</RollText>
        </button>
      </div>
      <p className="relative grid min-h-[3lh] overflow-hidden text-base text-white/85 compact:min-h-[2lh] compact:text-sm md:min-h-[2lh] md:text-lg">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={i}
            className="block"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "-60%", opacity: 0 }}
            transition={{ duration: 0.7, ease: ease.inkSlide }}
          >
            {TIPS[i]}
          </motion.span>
        </AnimatePresence>
      </p>
    </div>
  )
}

/** Spinning save icon, then "press any key" with the auto-continue countdown on its ring. */
function Prompt({ ready, countdown, touch }: { ready: boolean; countdown: MotionValue<number>; touch: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative grid size-14 shrink-0 place-items-center [perspective:200px]">
        <svg aria-hidden viewBox="0 0 56 56" className={cn("absolute inset-0 size-full -rotate-90", !ready && "animate-spin [animation-duration:1.4s]")}>
          <circle cx="28" cy="28" r="26" fill="none" strokeWidth="2" className="stroke-white/10" />
          {ready ? (
            <motion.circle cx="28" cy="28" r="26" fill="none" strokeWidth="2" strokeLinecap="round" className="stroke-primary" style={{ pathLength: countdown }} />
          ) : (
            <circle cx="28" cy="28" r="26" fill="none" strokeWidth="2" strokeLinecap="round" strokeDasharray="36 200" className="stroke-primary" />
          )}
        </svg>
        {/* The favicon's LL tile flips like a coin while loading */}
        <motion.span
          className="relative size-9 [transform-style:preserve-3d]"
          animate={ready ? { rotateY: 0 } : { rotateY: [0, 360] }}
          transition={ready ? { duration: 0.4 } : { duration: 1.2, repeat: Infinity, repeatDelay: 0.5, ease: ease.wgInOut }}
        >
          <LogoFace />
          <LogoFace back />
        </motion.span>
      </span>
      <div className="grid gap-1.5 text-[11px] font-semibold tracking-wider uppercase md:text-xs">
        <Swap id={ready ? "ready" : "loading"}>
          {ready ? (
            <motion.span className="inline-flex items-center gap-1.5 text-white" animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.1, repeat: Infinity }}>
              {touch ? (
                "Tap to continue"
              ) : (
                <>
                  Press <Key>any key</Key>
                </>
              )}
            </motion.span>
          ) : (
            <span className="text-white">Loading</span>
          )}
        </Swap>
        {!ready && !touch && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Key>Esc</Key> to skip
          </span>
        )}
      </div>
    </div>
  )
}

function LogoFace({ back = false }: { back?: boolean }) {
  return (
    <span
      className={cn(
        "absolute inset-0 grid place-items-center rounded-[10px] bg-primary font-display text-sm leading-none text-black [backface-visibility:hidden]",
        back && "[transform:rotateY(180deg)]",
      )}
    >
      LL
    </span>
  )
}
