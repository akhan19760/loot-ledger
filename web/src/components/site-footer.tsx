import { m, useReducedMotion, useScroll, useTransform } from "motion/react"
import { ArrowUp, ArrowUpRight } from "lucide-react"
import { useRef } from "react"
import type { Store } from "@ugs/shared"
import { HazardBand } from "@/components/motion/hazard-band"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { Button } from "@/components/ui/button"
import { Eyebrow } from "@/components/ui/eyebrow"

/**
 * WG closing section: the sliding hazard band, then a full-width neon panel with a
 * giant black wordmark that rises into place as you reach the bottom of the page.
 */
export function SiteFooter({ stores }: { stores: Store[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const scrollTo = useScrollTo()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] })
  const y = useTransform(scrollYProgress, [0, 1], ["40%", "0%"])
  const scale = useTransform(scrollYProgress, [0, 1], [0.82, 1])

  return (
    <footer id="stores" className="grid gap-2">
      <HazardBand />

      <div ref={ref} className="relative grid gap-10 overflow-hidden rounded-2xl bg-primary p-6 text-black md:gap-14 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="grid max-w-3xl gap-4">
            <Eyebrow>Stores we compare</Eyebrow>
            <ul className="flex flex-wrap gap-2">
              {stores.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.base}
                    target="_blank"
                    rel="noopener"
                    className="group/roll inline-flex h-11 items-center gap-2 rounded-2xl bg-black px-4 text-sm leading-none font-medium text-white transition-[color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:text-primary hover:shadow-[0_12px_24px_-10px_rgb(0_0_0/0.6)] active:scale-95"
                  >
                    <RollText>{s.name}</RollText>
                    <ArrowUpRight className="size-4 transition-transform duration-500 ease-[cubic-bezier(0.645,0.045,0.355,1)] group-hover/roll:rotate-45" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <Button variant="round" size="icon" aria-label="Back to top" onClick={() => scrollTo(0)} className="group/top text-primary">
            <ArrowUp className="spin-on-hover size-5 group-hover/top:-rotate-[330deg]" />
          </Button>
        </div>

        <m.p
          aria-hidden
          style={reduced ? undefined : { y, scale, willChange: "transform" }}
          className="origin-bottom text-center font-display text-[clamp(4rem,19vw,21rem)] leading-[0.8] text-white uppercase"
        >
          <SplitText text="LootLedger" by="letter" stagger={0.04} />
        </m.p>

        <div className="flex flex-wrap items-end justify-between gap-4 text-sm text-black/70">
          <p className="max-w-xl">
            Prices are copied from each store's website and may have changed. The store's own page is the final word. Not affiliated with any of the
            listed stores; product data and images belong to their owners.
          </p>
          <p className="text-xs font-semibold tracking-wider uppercase">LootLedger · for personal use</p>
        </div>
      </div>
    </footer>
  )
}
