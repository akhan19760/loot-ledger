/**
 * Download a store's whole catalog from its public product feed.
 *
 * Shopify stores expose /products.json; WooCommerce stores expose the Store API
 * (wc/store/v1/products); Payload CMS stores expose /api/products. All are public,
 * read-only feeds the stores' own sites use, so no HTML scraping is needed.
 */
import type { StoreConfig } from "../catalog/adapters.ts";
import { getJson, sleep, type Log } from "./http.ts";

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

const FETCHERS = { shopify: fetchShopify, woocommerce: fetchWooCommerce, payload: fetchPayload };

export function fetchStore(store: StoreConfig, options: FetchOptions): Promise<unknown[]> {
  return FETCHERS[store.platform](store.base, options);
}
