import { m, useReducedMotion, useScroll, useTransform } from "motion/react"
import { ArrowUp, ArrowUpRight } from "lucide-react"
import { useRef } from "react"
import type { Store } from "@lootledger/shared"
import { FooterController } from "@/components/motion/footer-controller"
import { HazardBand } from "@/components/motion/hazard-band"
import { RollText } from "@/components/motion/roll-text"
import { useScrollTo } from "@/components/motion/smooth-scroll"
import { SplitText } from "@/components/motion/split-text"
import { Button } from "@/components/ui/button"

/**
 * WG closing section: the sliding hazard band, then a tall neon panel. As you scroll
 * through it, WG's 3D controller plays out in the middle of the screen, settling as you
 * reach the bottom of the page, where a giant black wordmark rises into place.
 */
export function SiteFooter({ stores }: { stores: Store[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const scrollTo = useScrollTo()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end end"] })
  const y = useTransform(scrollYProgress, [0, 1], ["40%", "0%"])
  const scale = useTransform(scrollYProgress, [0, 1], [0.82, 1])
  // The controller plays from the panel's top reaching 85% down the screen to the page's
  // end, as WG's does over its section ("top bottom-=15%" to "bottom bottom").
  const controller = useScroll({ target: ref, offset: ["start 0.85", "end end"] }).scrollYProgress

  return (
    <footer id="stores" className="grid gap-2">
      <HazardBand />

      {/* overflow-clip, not hidden: hidden would make the panel the controller's scroller and stop it sticking */}
      <div ref={ref} className="@container relative grid overflow-clip rounded-2xl bg-primary text-black">
        <div className="grid gap-10 p-6 md:gap-14 md:p-10">
          <div className="relative z-[1] col-start-1 row-start-1 flex flex-wrap items-start justify-between gap-6">
            <div className="grid max-w-3xl gap-4">
              <h2 className="text-lg font-semibold">Stores we compare</h2>
              <ul className="flex flex-wrap gap-2">
                {stores.map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.base}
                      target="_blank"
                      rel="noopener"
                      className="group/roll inline-flex h-11 items-center gap-2 rounded-2xl bg-black px-4 text-sm leading-none font-medium text-white transition-[color,transform] duration-300 hover:-translate-y-0.5 hover:text-primary active:scale-95"
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

          {/* The controller plays out in the room below the store list, edge to edge. Its stage
              runs a little way into the wordmark, so it comes to rest just above the letters. */}
          <FooterController
            progress={controller}
            className="pointer-events-none relative z-0 col-start-1 row-span-2 row-start-1 -mx-6 -mt-6 -mb-20 md:-mx-10 md:-mt-10 md:-mb-24"
          />
          <div aria-hidden className="col-start-1 row-start-2 h-[120svh] md:h-[150svh]" />

          <m.p
            aria-hidden
            style={reduced ? undefined : { y, scale, willChange: "transform" }}
            className="relative z-[1] col-start-1 row-start-3 origin-bottom text-center font-display text-[min(20cqw,21rem)] leading-[0.8] whitespace-nowrap text-black uppercase"
          >
            <SplitText text="LootLedger" by="letter" stagger={0.04} />
          </m.p>

          <div className="relative z-[1] col-start-1 row-start-4 flex flex-wrap items-end justify-between gap-4 text-sm text-black/70">
            <p className="max-w-xl">
              Prices are copied from each store's website and may have changed. The store's own page is the final word. Not affiliated with any of the
              listed stores; product data and images belong to their owners.
            </p>
            <p className="font-semibold">LootLedger · for personal use</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
