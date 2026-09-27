// Store adapters: one raw product from a store feed -> one listing per variant.

import { unescape } from "./titles.ts";

export interface StoreConfig {
  id: string;
  name: string;
  platform: "shopify" | "woocommerce";
  base: string;
  linkStyle: "query" | null;
}

/** A listing before classification (platform, condition, ... are added by build). */
export interface RawListing {
  raw_title: string;
  variant: string;
  meta: string[];
  price: number;
  was: number | null;
  in_stock: boolean;
  url: string;
  image: string | null;
}

// ---------------------------------------------------------------- Shopify (/products.json)

interface ShopifyImage { src?: string }
export interface ShopifyProduct {
  title: string;
  handle: string;
  product_type?: string | null;
  tags?: string[] | null;
  images?: ShopifyImage[] | null;
  variants: {
    id: number;
    title: string;
    price: string | null;
    compare_at_price?: string | null;
    available?: boolean;
    featured_image?: ShopifyImage | null;
  }[];
}

export function* shopifyListings(store: StoreConfig, p: ShopifyProduct): Generator<RawListing> {
  const title = unescape(p.title);
  const meta = [p.product_type || "", ...(p.tags || [])];
  const image = p.images?.length ? (p.images[0]!.src ?? null) : null;
  const single = p.variants.length === 1;
  for (const v of p.variants) {
    const price = Number(v.price || 0);
    const compare = Number(v.compare_at_price || 0);
    yield {
      raw_title: title,
      variant: v.title === "Default Title" ? "" : v.title,
      meta,
      price,
      was: compare > price ? compare : null,
      in_stock: Boolean(v.available),
      url: `${store.base}/products/${p.handle}` + (single ? "" : `?variant=${v.id}`),
      image: v.featured_image?.src || image,
    };
  }
}

// ---------------------------------------------------------------- WooCommerce (Store API)

interface WooPrices { price?: string | null; regular_price?: string | null; currency_minor_unit?: number | null }
interface WooItem {
  permalink?: string;
  prices: WooPrices;
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  images?: { src: string }[];
  variation?: string;
}
export interface WooProduct extends WooItem {
  id: number;
  name: string;
  permalink: string;
  categories?: { name: string }[];
  tags?: { name: string }[];
  /** Attached by the fetcher: this product's variations (new/used, PS4/PS5, ...). */
  _variations?: WooItem[];
}

function wooPrice(prices: WooPrices): [price: number, regular: number] {
  const scale = 10 ** Number(prices.currency_minor_unit || 0);
  return [Number(prices.price || 0) / scale, Number(prices.regular_price || 0) / scale];
}

/**
 * Some stores' pretty product URLs 404 (gamepark.pk, as of Sept 2026) while
 * ?product=<slug> works; stores.json sets "link_style": "query" for those.
 */
function wooLink(store: StoreConfig, permalink: string): string {
  if (store.linkStyle !== "query") return permalink;
  const q = permalink.indexOf("?");
  const [path, query] = q < 0 ? [permalink, ""] : [permalink.slice(0, q), permalink.slice(q + 1)];
  const slug = path.replace(/\/+$/, "").split("/").at(-1);
  return `${store.base}/?product=${slug}` + (query ? `&${query}` : "");
}

export function* wooListings(store: StoreConfig, p: WooProduct): Generator<RawListing> {
  const title = unescape(p.name);
  const meta = [...(p.categories ?? []), ...(p.tags ?? [])].map((c) => unescape(c.name));
  const image = p.images?.length ? p.images[0]!.src : null;
  const rows: WooItem[] = p._variations?.length ? p._variations : [p];
  for (const v of rows) {
    const [price, regular] = wooPrice(v.prices);
    yield {
      raw_title: title,
      variant: v !== p ? unescape(v.variation || "") : "",
      meta,
      price,
      was: regular > price ? regular : null,
      in_stock: Boolean(v.is_in_stock) && ("is_purchasable" in v ? Boolean(v.is_purchasable) : true),
      url: wooLink(store, v.permalink || p.permalink),
      image: (v.images?.length ? v.images[0]!.src : null) || image,
    };
  }
}

export const ADAPTERS = {
  shopify: (store: StoreConfig, p: unknown) => shopifyListings(store, p as ShopifyProduct),
  woocommerce: (store: StoreConfig, p: unknown) => wooListings(store, p as WooProduct),
};
