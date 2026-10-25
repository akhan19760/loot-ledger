import { ArrowUp, ArrowUpRight } from "lucide-react"
import type { FiltersResponse } from "@lootledger/shared"
import { Reveal } from "@/components/motion/reveal"
import { RollText } from "@/components/motion/roll-text"
import { SplitText } from "@/components/motion/split-text"
import { Button, ButtonCircle } from "@/components/ui/button"
import { formatCount, timeAgo } from "@/lib/format"

const domain = (url: string) => new URL(url).hostname.replace(/^www\./, "")

/**
 * The end credits (DESIGN.md, "Footer: end credits"): the page ends like a game. On ink, the
 * shops roll up under "Prices by" (each a link to its own site), then the rest of the credits,
 * role and name either side of a centre line. Then a lime block: "Thanks for playing", the small
 * print, and Return to title.
 */
export function SiteFooter({ meta, onTitle }: { meta: FiltersResponse; onTitle: () => void }) {
  const credits: [string, string][] = [
    ["Games tracked", formatCount(meta.totals.games)],
    ["Offers compared", formatCount(meta.totals.offers)],
    ["Prices last checked", meta.generated ? timeAgo(meta.generated) : "Not yet"],
    ["Cover art and prices", "Each shop's own listings"],
    ["Built for", "Players in Pakistan"],
    ["Special thanks", "You, for shopping around"],
  ]
  return (
    <footer id="stores" aria-labelledby="credits-title" className="dark bg-background text-foreground">
      <div className="mx-auto grid max-w-5xl justify-items-center gap-24 px-4 pt-32 pb-28 text-center md:gap-32 md:px-8 md:pt-48 md:pb-40">
        <Reveal className="grid justify-items-center gap-4">
          <span className="label-caps text-muted-foreground">Credits</span>
          <h2 id="credits-title" className="font-display text-[clamp(2.6rem,7vw,6.5rem)] leading-[0.86] uppercase">
            Loot<span className="text-neon">Ledger</span>
          </h2>
          <p className="max-w-[30ch] text-base text-muted-foreground md:text-lg">One price list for every game shop in Pakistan, new and used, cheapest first.</p>
        </Reveal>

        <div className="grid justify-items-center gap-8">
          <Reveal>
            <span className="label-caps text-muted-foreground">Prices by</span>
          </Reveal>
          <ul className="grid justify-items-center gap-5 md:gap-6">
            {meta.stores.map((s) => (
              <li key={s.id}>
                <Reveal y={40}>
                <a href={s.base} target="_blank" rel="noopener" className="group/shop grid justify-items-center gap-1.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-current">
                  <span className="flex items-center gap-3 font-display text-[clamp(1.6rem,3.8vw,3.25rem)] leading-none uppercase transition-colors duration-300 group-hover/shop:text-primary-ink">
                    {s.name}
                    <ArrowUpRight className="size-[0.6em] -translate-x-1 opacity-0 transition-[opacity,translate] duration-500 group-hover/shop:translate-x-0 group-hover/shop:opacity-100" />
                  </span>
                  <span className="label-caps text-muted-foreground">{domain(s.base)}</span>
                </a>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        {/* Role and name either side of a centre gutter, like a film's credits */}
        <dl className="grid w-full max-w-3xl gap-y-5 md:grid-cols-2 md:gap-x-12">
          {credits.map(([role, name]) => (
            <Reveal key={role} y={30} className="grid gap-y-1 md:col-span-2 md:grid-cols-subgrid md:items-baseline md:gap-x-12">
              <dt className="label-caps text-muted-foreground md:text-right">{role}</dt>
              <dd className="text-lg font-semibold md:text-left md:text-xl">{name}</dd>
            </Reveal>
          ))}
        </dl>
      </div>

      <div className="on-lime">
        <div className="grid gap-14 px-4 pt-20 pb-8 md:gap-20 md:px-8 md:pt-28 md:pb-10">
          <p className="font-display text-[clamp(3.25rem,13.5vw,16rem)] leading-[0.82] uppercase">
            <SplitText text="Thanks for playing" stagger={0.09} />
          </p>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="grid max-w-xl gap-3 text-sm">
              <p>
                Prices are copied from each shop&rsquo;s website and may have changed since; the shop&rsquo;s own page is the final word. Not affiliated with any of the
                listed shops. Product names and images belong to their owners.
              </p>
              <p className="font-semibold">LootLedger · for personal use</p>
            </div>
            <Button size="lg" onClick={onTitle} className="bg-ink text-lime hover:bg-graphite">
              <RollText>Return to title</RollText>
              <ButtonCircle icon={ArrowUp} className="bg-lime text-ink" />
            </Button>
          </div>
        </div>
      </div>
    </footer>
  )
}
