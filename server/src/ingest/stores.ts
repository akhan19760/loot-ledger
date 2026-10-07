/**
 * Download a store's whole catalog from its public product feed.
 *
 * Shopify stores expose /products.json; WooCommerce stores expose the Store API
 * (wc/store/v1/products); Payload CMS stores expose /api/products. All are public,
 * read-only feeds the stores' own sites use. Venture Games' own PHP site has no
 * feed, so its category pages are read instead (fetchVenture).
 */
import type { StoreConfig, VentureProduct } from "../catalog/adapters.ts";
import { getJson, getText, sleep, type Log } from "./http.ts";

export interface FetchOptions {
  /** Pause between page requests, to be polite. */
  delayMs: number;
  log: Log;
}

const UA = "Mozilla/5.0 (personal game price library)";

async function fetchShopify(base: string, { delayMs, log }: FetchOptions): Promise<unknown[]> {
  const items: unknown[] = [];
  for (let page = 1; ; page++) {
    const { products } = await getJson<{ products: unknown[] }>(`${base}/products.json?limit=250&page=${page}`, { userAgent: UA, log });
    if (!products.length) return items;
    items.push(...products);
    log.info(`    page ${page}: ${items.length} products`);
    await sleep(delayMs);
  }
}

interface WooRow { id: number; parent: number }

async function fetchWooCommerce(base: string, { delayMs, log }: FetchOptions): Promise<unknown[]> {
  // ?rest_route= works even where /wp-json/ pretty URLs are blocked (gamepark.pk).
  // The default listing returns simple + variable products; variable products only
  // carry their cheapest price, so variations (new/used, PS4/PS5, disc/digital)
  // are fetched separately with type=variation and attached to their parent.
  async function pages(extra: string) {
    const items: WooRow[] = [];
    for (let page = 1; ; page++) {
      const batch = (await getJson<WooRow[] | null>(`${base}/?rest_route=/wc/store/v1/products&per_page=100&page=${page}${extra}`, { userAgent: UA, log })) ?? [];
      items.push(...batch);
      log.info(`    page ${page}: ${items.length} ${extra ? "variations" : "products"}`);
      if (batch.length < 100) return items;
      await sleep(delayMs);
    }
  }

  const products = await pages("");
  const variations = await pages("&type=variation");
  const byParent = Map.groupBy(variations, (v) => v.parent);
  return products.map((p) => ({ ...p, _variations: byParent.get(p.id) ?? [] }));
}

// Only the fields payloadListings reads; the rest (rich-text descriptions) is most of the weight.
const PAYLOAD_FIELDS = ["title", "slug", "condition", "platform", "category", "price", "compareAtPrice", "usedPrice", "usedCompareAtPrice", "stock", "images", "variants"];

async function fetchPayload(base: string, { delayMs, log }: FetchOptions): Promise<unknown[]> {
  // depth=1 resolves platform, category and image ids to their names and URLs.
  const query = `limit=100&depth=1&where[status][equals]=active&${PAYLOAD_FIELDS.map((f) => `select[${f}]=true`).join("&")}`;
  const items: unknown[] = [];
  for (let page = 1; ; page++) {
    const { docs, hasNextPage } = await getJson<{ docs: unknown[]; hasNextPage: boolean }>(`${base}/api/products?${query}&page=${page}`, { userAgent: UA, log });
    items.push(...docs);
    log.info(`    page ${page}: ${items.length} products`);
    if (!hasNextPage) return items;
    await sleep(delayMs);
  }
}

/**
 * The product cards on a Venture Games category page. Each card carries its details in
 * hidden inputs for the add-to-cart script (addToCardName, addToCardPrice, ...), which
 * are steadier to read than the visible text.
 */
export function ventureCards(html: string): VentureProduct[] {
  return html.split('class="product-cart"').slice(1).flatMap((card) => {
    const field = (name: string) => card.match(new RegExp(`class="addToCard${name}" value="([^"]*)"`))?.[1];
    const id = Number(field("HiddenId"));
    const name = field("Name");
    const url = card.match(/data-url="([^"]*)"/)?.[1];
    if (!id || !name || !url) return [];
    return [{
      id,
      name,
      price: Number(field("Price") || 0),
      mrp: Number(field("MRP") || 0),
      stock: Number(field("Stock") || 0),
      category: field("Category") ?? "",
      url,
      image: field("Image") || null,
    }];
  });
}

async function fetchVenture(base: string, { delayMs, log }: FetchOptions): Promise<VentureProduct[]> {
  // The menu links every category as /product?id=<category>; each lists 20 products a page.
  const home = await getText(`${base}/`, { userAgent: UA, log });
  const categories = [...new Set(Array.from(home.matchAll(/href="\/product\?id=(\d+)/g), (m) => m[1]!))];
  if (!categories.length) throw new Error("no category links on the home page (has the site changed?)");
  const items = new Map<number, VentureProduct>();
  for (const category of categories) {
    const seen = new Set<number>();
    for (let page = 1; ; page++) {
      const cards = ventureCards(await getText(`${base}/product?id=${category}&page=${page}`, { userAgent: UA, log }));
      await sleep(delayMs);
      // Past the last page the list is empty; stop too if a page only repeats earlier ones.
      const fresh = cards.filter((c) => !seen.has(c.id));
      if (!fresh.length) break;
      for (const c of fresh) {
        seen.add(c.id);
        if (!items.has(c.id)) items.set(c.id, c);
      }
    }
    log.info(`    category ${category}: ${seen.size} products, ${items.size} in all`);
  }
  // An empty catalog would wipe the store's listings; failing keeps the previous feed.
  if (!items.size) throw new Error("no product cards on the category pages (has the site changed?)");
  return [...items.values()];
}

const FETCHERS = { shopify: fetchShopify, woocommerce: fetchWooCommerce, payload: fetchPayload, venture: fetchVenture };

export function fetchStore(store: StoreConfig, options: FetchOptions): Promise<unknown[]> {
  return FETCHERS[store.platform](store.base, options);
}
