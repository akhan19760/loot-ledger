import { byStockThenPrice } from "./filters.ts";
import type { Game } from "./types.ts";

// Share links: /g/<slug> is a small page with the game's price in its link-preview
// tags (WhatsApp and the like don't run the app), which sends people on to the game.

const GAME_PREFIX = "game:";

/** "/g/elden-ring" for game:elden-ring; other kinds keep their prefix ("/g/hardware:dualsense"). */
export const sharePath = (id: string) => `/g/${encodeURIComponent(id.startsWith(GAME_PREFIX) ? id.slice(GAME_PREFIX.length) : id)}`;

/** The game id a share slug stands for. */
export const idFromShareSlug = (slug: string) => (slug.includes(":") ? slug : GAME_PREFIX + slug);

const rupees = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const price = (n: number) => `Rs ${rupees.format(Math.round(n))}`;
const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export interface ShareText {
  /** Link-preview title: "Elden Ring: Rs 9,000 at Games4U". */
  title: string;
  /** Link-preview description. */
  description: string;
  /** A chat message to go before the link: "Elden Ring is Rs 9,000 at Games4U (PS5, new), down from Rs 12,000." */
  message: string;
}

/** What a shared game says about itself: its cheapest in-stock offer, as the game page shows first. */
export function shareText(game: Pick<Game, "title" | "listings">, storeName: (id: string) => string): ShareText {
  const offers = game.listings.toSorted(byStockThenPrice);
  const best = offers[0]?.in_stock ? offers[0] : null;
  const stores = new Set(offers.map((l) => l.store)).size;
  const compared =
    offers.length > 1
      ? `${offers.length} offers from ${stores} Pakistani ${stores === 1 ? "store" : "stores"}, compared on LootLedger.`
      : "Pakistani game store prices, compared on LootLedger.";
  if (!best) {
    return {
      title: `${game.title} on LootLedger`,
      description: `Out of stock everywhere right now. ${compared}`,
      message: `${game.title} on LootLedger, with every store's price:`,
    };
  }

  const at = `${price(best.price)} at ${storeName(best.store)}`;
  const version = [best.platform, best.condition, best.format === "digital" ? "digital" : null].filter(Boolean).join(", ");
  const down = best.was && best.was > best.price ? `, down from ${price(best.was)}` : "";
  return {
    title: `${game.title}: ${at}`,
    description: `${capitalize(version)}${down}. ${offers.length > 1 ? `The cheapest of ${compared}` : compared}`,
    message: `${game.title} is ${at} (${version})${down}. Every store's price:`,
  };
}
