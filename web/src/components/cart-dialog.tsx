import { useQueries } from "@tanstack/react-query"
import { m, useReducedMotion } from "motion/react"
import { ArrowUpRight, Check, Heart, ShoppingBag, X } from "lucide-react"
import { cn } from "cn"
import { PLATFORM_FILTERS, planCart, wantMatches, type CartLine, type CartPlans, type CartWant, type Game, type Plan, type Store, type Zone } from "@ugs/shared"
import { CoverArt } from "@/components/cover-art"
import { RollText } from "@/components/motion/roll-text"
import { useScrollLock } from "@/components/motion/smooth-scroll"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eyebrow } from "@/components/ui/eyebrow"
import { PillToggle } from "@/components/ui/pill-toggle"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { addToCart, clearCart, removeFromCart, setCartWant, setCartZone, useCart, type CartItem } from "@/hooks/use-cart"
import { api } from "@/lib/api"
import { formatPrice, versionLabel } from "@/lib/format"
import { ease } from "@/lib/motion"

const ZONES: [Zone, string][] = [
  ["karachi", "Karachi"],
  ["elsewhere", "Elsewhere in Pakistan"],
]

// Radix select items can't have an empty value, so "any" is spelled ANY here.
const ANY = "any"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  stores: Store[] | undefined
  /** Wishlist games, offered as a quick way to fill the cart. */
  wishlist: { id: string; title: string; image: string | null }[]
  /** What a game added from here should accept (the library's platform and condition filters). */
  defaultWant: CartWant
}

/**
 * The cart optimizer: the reader lists games they want to buy together, and it finds the
 * cheapest way to buy them all, delivery included (shared/src/cart.ts). Also shows the
 * cheapest single store and buying each game where it's cheapest, for comparison.
 */
export function CartDialog({ open, onOpenChange, stores, wishlist, defaultWant }: Props) {
  const cart = useCart()
  useScrollLock(open)

  const games = useQueries({
    queries: cart.items.map((i) => ({ queryKey: ["game", i.gameId], queryFn: () => api.game(i.gameId), enabled: open, retry: false })),
  })
  const loading = games.some((g) => g.isPending)
  const byId = new Map(games.flatMap((g) => (g.data ? [[g.data.id, g.data] as const] : [])))

  // Planning takes milliseconds even for a big cart, so it simply runs on every render.
  const lines: CartLine[] = cart.items.flatMap((i) => {
    const game = byId.get(i.gameId)
    return game ? [{ gameId: i.gameId, want: i.want, listings: game.listings }] : []
  })
  const plans = loading || !stores ? null : planCart(lines, stores, cart.zone)

  const storeName = (id: string) => stores?.find((s) => s.id === id)?.name ?? id
  const titleOf = (id: string) => cart.items.find((i) => i.gameId === id)?.title ?? id
  const missingWishlist = wishlist.filter((w) => !cart.items.some((i) => i.gameId === w.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader className="pr-10 text-left">
          <Eyebrow className="text-primary-ink">Cart optimizer</Eyebrow>
          <DialogTitle>Your cart</DialogTitle>
          <DialogDescription>Add the games you want and it finds the cheapest way to buy them all, delivery included.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Eyebrow className="text-muted-foreground">Delivering to</Eyebrow>
          <PillToggle label="Delivering to" value={cart.zone} options={ZONES} onChange={setCartZone} />
        </div>

        {cart.items.length === 0 ? (
          <div className="grid justify-items-start gap-4 rounded-2xl bg-surface p-6">
            <p className="text-muted-foreground">Your cart is empty. Open any game and press “Add to cart”, or start from your wishlist.</p>
            {missingWishlist.length > 0 && (
              <Button onClick={() => addToCart(missingWishlist, defaultWant)}>
                <Heart />
                <RollText>Add my wishlist ({missingWishlist.length})</RollText>
              </Button>
            )}
          </div>
        ) : (
          <>
            <section className="grid min-w-0 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Eyebrow className="text-muted-foreground">
                  {cart.items.length} {cart.items.length === 1 ? "game" : "games"}
                </Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {missingWishlist.length > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => addToCart(missingWishlist, defaultWant)}>
                      <Heart />
                      <RollText>Add wishlist ({missingWishlist.length})</RollText>
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={clearCart}>
                    <RollText>Empty cart</RollText>
                  </Button>
                </div>
              </div>
              <ul className="grid min-w-0 gap-2">
                {cart.items.map((item, i) => (
                  <CartRow key={item.gameId} item={item} index={i} game={byId.get(item.gameId)} failed={games[i]?.isError ?? false} plans={plans} storeName={storeName} />
                ))}
              </ul>
            </section>

            {loading || !plans ? (
              <Skeleton className="h-64" />
            ) : plans.best ? (
              <PlanSection plans={plans} stores={stores ?? []} storeName={storeName} titleOf={titleOf} />
            ) : (
              <p className="rounded-2xl bg-surface p-6 text-muted-foreground">None of these games are in stock in the versions you picked. Try “Any” on a line.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** "Add to cart" for the game dialog; once added, a way back out and a way to the cart. */
export function AddToCartButton({ game, want, onOpenCart }: { game: { id: string; title: string; image: string | null }; want: CartWant; onOpenCart: () => void }) {
  const inCart = useCart().items.some((i) => i.gameId === game.id)
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={inCart ? "default" : "secondary"} size="sm" aria-pressed={inCart} onClick={() => (inCart ? removeFromCart(game.id) : addToCart([game], want))}>
        {inCart ? <Check /> : <ShoppingBag />}
        <RollText>{inCart ? "In your cart" : "Add to cart"}</RollText>
      </Button>
      {inCart && (
        <Button variant="ghost" size="sm" className="px-2" onClick={onOpenCart}>
          <RollText>View cart ↗</RollText>
        </Button>
      )}
    </div>
  )
}

/** Platforms a game is actually sold on, as the filter values the cart understands. */
function platformOptions(game: Game | undefined): [string, string][] {
  const present = new Set(game?.listings.map((l) => l.platform))
  const options: [string, string][] = [[ANY, "Any platform"]]
  if ([...present].some((p) => p && /^(PS[345]|PlayStation)$/.test(p))) options.push(["PS", "Any PlayStation"])
  for (const p of PLATFORM_FILTERS) if (p !== "PS" && p !== "Xbox" && present.has(p)) options.push([p, p])
  return options
}

function CartRow({
  item,
  index,
  game,
  failed,
  plans,
  storeName,
}: {
  item: CartItem
  index: number
  game: Game | undefined
  failed: boolean
  plans: CartPlans | null
  storeName: (id: string) => string
}) {
  const reduced = useReducedMotion()
  const matching = game?.listings.filter((l) => l.in_stock && wantMatches(l, item.want)) ?? []
  const assigned = plans?.best?.orders.flatMap((o) => o.lines).find((l) => l.gameId === item.gameId)
  const platforms = platformOptions(game)
  // A platform picked earlier stays listed even if no store sells it any more.
  if (item.want.platform && !platforms.some(([v]) => v === item.want.platform)) platforms.push([item.want.platform, item.want.platform])

  return (
    <m.li
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: ease.wg, delay: Math.min(index * 0.04, 0.6) }}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 rounded-2xl bg-surface p-3 sm:gap-x-4"
    >
      <div className="aspect-[4/5] w-12 overflow-hidden rounded-sm bg-surface sm:w-14">
        <CoverArt src={item.image} title={item.title} width={56} />
      </div>
      <div className="grid min-w-0 gap-1">
        <p className="truncate font-semibold">{item.title}</p>
        <p className={cn("text-sm", failed || (game && !matching.length) ? "text-destructive" : "text-muted-foreground")}>
          {failed
            ? "No store lists this game any more"
            : !game
              ? "Checking prices…"
              : !matching.length
                ? "Not in stock in this version"
                : assigned
                  ? `${storeName(assigned.listing.store)} · ${formatPrice(assigned.listing.price)} · ${versionLabel(assigned.listing)}`
                  : `From ${formatPrice(Math.min(...matching.map((l) => l.price)))}`}
        </p>
      </div>

      {/* Remove sits at the end of this row, clear of the dialog's pinned close button. */}
      <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-2">
        <WantSelect label="Platform" value={item.want.platform} options={platforms} onChange={(platform) => setCartWant(item.gameId, { platform })} />
        <WantSelect
          label="Condition"
          value={item.want.condition}
          options={[[ANY, "New or used"], ["new", "New"], ["used", "Used"]]}
          onChange={(condition) => setCartWant(item.gameId, { condition: condition as CartWant["condition"] })}
        />
        <WantSelect
          label="Format"
          value={item.want.format}
          options={[[ANY, "Disc or digital"], ["disc", "Disc"], ["digital", "Digital"]]}
          onChange={(format) => setCartWant(item.gameId, { format: format as CartWant["format"] })}
        />
        <Button variant="round" size="icon-sm" className="ml-auto" aria-label={`Remove ${item.title} from the cart`} onClick={() => removeFromCart(item.gameId)}>
          <X />
        </Button>
      </div>
    </m.li>
  )
}

function WantSelect({ label, value, options, onChange }: { label: string; value: string | null; options: [string, string][]; onChange: (value: string | null) => void }) {
  return (
    <Select value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : v)}>
      <SelectTrigger aria-label={label} chosen={value !== null} className="h-9 px-3">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, text], i) => (
          <SelectItem key={v} value={v} style={{ animationDelay: `${i * 28}ms` }}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function PlanSection({ plans, stores, storeName, titleOf }: { plans: CartPlans; stores: Store[]; storeName: (id: string) => string; titleOf: (id: string) => string }) {
  const best = plans.best!
  const { singleStore, eachCheapest } = plans
  const vsEach = eachCheapest ? eachCheapest.total - best.total : 0
  const vsSingle = singleStore ? singleStore.total - best.total : 0
  const used = new Set(best.orders.map((o) => o.store))
  const notes = stores.filter((s) => used.has(s.id) && s.delivery?.note).map((s) => `${s.name}: ${s.delivery!.note}`)
  const checked = [...new Set(stores.flatMap((s) => (used.has(s.id) && s.delivery ? [s.delivery.checked] : [])))].sort()

  return (
    // min-w-0 all the way down: titles that don't wrap must not widen the grid past the dialog.
    <section className="grid min-w-0 gap-4">
      <Eyebrow className="text-muted-foreground">Cheapest way to buy {plural(best.orders.reduce((n, o) => n + o.lines.length, 0), "game")}</Eyebrow>

      <div className="grid min-w-0 gap-5 rounded-2xl border border-primary-ink bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="grid gap-1">
            <span className="font-display text-5xl leading-none text-primary-ink tabular-nums">{formatPrice(best.total)}</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatPrice(best.items)} games + {formatPrice(best.delivery)} delivery · {plural(best.orders.length, "order")}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {vsEach > 0 && <Saving>Saves {formatPrice(vsEach)} vs each game's cheapest store</Saving>}
            {singleStore && vsSingle > 0 && (
              <Saving>
                Saves {formatPrice(vsSingle)} vs all from {storeName(singleStore.orders[0]!.store)}
              </Saving>
            )}
          </div>
        </div>

        <ul className="grid min-w-0 gap-3">
          {best.orders.map((o) => (
            <li key={o.store} className="grid min-w-0 gap-2 rounded-xl bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-semibold">{storeName(o.store)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatPrice(o.subtotal)} + {o.delivery ? `${formatPrice(o.delivery)} delivery` : "free delivery"}
                </span>
              </div>
              <ul className="grid min-w-0 gap-1.5">
                {o.lines.map(({ gameId, listing }) => (
                  <li key={gameId} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {titleOf(gameId)} <span className="text-muted-foreground">· {versionLabel(listing)}</span>
                    </span>
                    <a
                      href={listing.url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary-ink tabular-nums hover:underline"
                      title={`${listing.raw_title} at ${storeName(o.store)}`}
                    >
                      {formatPrice(listing.price)}
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Alternative
          label="All from one store"
          plan={singleStore}
          best={best}
          describe={(p) => `${storeName(p.orders[0]!.store)}, ${formatPrice(p.delivery)} delivery`}
          none="No single store has every game"
        />
        <Alternative
          label="Each game's cheapest store"
          plan={eachCheapest}
          best={best}
          describe={(p) => `${plural(p.orders.length, "store")}, ${formatPrice(p.delivery)} delivery`}
          none=""
        />
      </dl>

      <div className="grid gap-1 text-xs text-muted-foreground">
        {plans.unavailable.length > 0 && <p className="text-destructive">Left out, not in stock in the version picked: {plans.unavailable.map(titleOf).join(", ")}.</p>}
        {plans.unknownDelivery.length > 0 && <p>Delivery unknown for {plans.unknownDelivery.map(storeName).join(", ")}; counted as free.</p>}
        {!plans.exact && <p>This cart is too big to check every combination; the plan shown is the best found.</p>}
        <p>
          Delivery fees were read from each store's checkout{checked.length ? ` on ${checked.map((d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })).join(", ")}` : ""}. Prices refresh
          every few hours; the store's checkout has the final word.
        </p>
        {notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </div>
    </section>
  )
}

function Saving({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-sm border border-primary-ink px-2 font-medium text-primary-ink">{children}</span>
}

function Alternative({ label, plan, best, describe, none }: { label: string; plan: Plan | null; best: Plan; describe: (p: Plan) => string; none: string }) {
  const extra = plan ? plan.total - best.total : 0
  return (
    <div className="grid content-start gap-1 rounded-2xl bg-surface p-4">
      <dt>
        <Eyebrow className="text-muted-foreground">{label}</Eyebrow>
      </dt>
      <dd className="grid gap-0.5">
        {plan ? (
          <>
            <span className="font-semibold tabular-nums">
              {formatPrice(plan.total)} <span className="text-sm font-normal text-muted-foreground">{extra > 0 ? `+${formatPrice(extra)}` : "same as best"}</span>
            </span>
            <span className="text-sm text-muted-foreground">{describe(plan)}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">{none}</span>
        )}
      </dd>
    </div>
  )
}
