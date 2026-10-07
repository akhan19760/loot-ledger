// Store adapters: one raw product from a store feed -> one listing per variant.

import { unescape } from "./titles.ts";

export interface StoreConfig {
  id: string;
  name: string;
  platform: "shopify" | "woocommerce" | "payload" | "venture";
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

// ---------------------------------------------------------------- Payload CMS (/api/products)

type PayloadCondition = "new" | "used" | "both";
interface PayloadMedia { url?: string | null }
interface PayloadVariant {
  label: string;
  /** Unset: the product's condition. */
  condition?: PayloadCondition | null;
  price: number | null;
  compareAtPrice?: number | null;
  stock?: number | null;
  image?: PayloadMedia | null;
}
/** Fetched with depth=1, so platform, categories and images are objects, not ids. */
export interface PayloadProduct {
  title: string;
  slug: string;
  condition?: PayloadCondition | null;
  platform?: { name: string } | null;
  category?: { name: string }[] | null;
  price: number | null;
  compareAtPrice?: number | null;
  usedPrice?: number | null;
  usedCompareAtPrice?: number | null;
  stock?: number | null;
  images?: { image?: PayloadMedia | null }[] | null;
  variants?: PayloadVariant[] | null;
}

export function* payloadListings(store: StoreConfig, p: PayloadProduct): Generator<RawListing> {
  const title = unescape(p.title.trim());
  const meta = [p.platform?.name ?? "", ...(p.category ?? []).map((c) => c.name)];
  const media = (m: PayloadMedia | null | undefined) => (m?.url ? new URL(m.url, store.base).href : null);
  const image = media(p.images?.[0]?.image);
  const url = `${store.base}/products/${p.slug}`;
  const condition = p.condition ?? "new";
  // Condition is a field here, not text in the title, so it goes into the variant for build's
  // detectCondition. A plain "new" product needs no label: build assumes new.
  const tag = (c: PayloadCondition) => (c === "used" ? "Used" : c === "new" && condition !== "new" ? "New" : "");
  // A "both" product sells new at price and used at usedPrice. On a "used" product, price is
  // the used price and usedPrice is a leftover the storefront ignores.
  const offer =(variant: string, price: number | null, compareAt: number | null | undefined, stock: number | null | undefined, img = image): RawListing => {
    const compare = Number(compareAt || 0);
    return { raw_title: title, variant, meta, price: Number(price || 0), was: compare > Number(price || 0) ? compare : null, in_stock: Number(stock || 0) > 0, url, image: img };
  };

  if (p.variants?.length) {
    for (const v of p.variants) {
      const label = [v.label.trim(), tag(v.condition ?? condition)].filter(Boolean).join(" / ");
      yield offer(label, v.price, v.compareAtPrice, v.stock, media(v.image) || image);
    }
  } else if (condition === "both" && p.usedPrice) {
    yield offer("New", p.price, p.compareAtPrice, p.stock);
    yield offer("Used", p.usedPrice, p.usedCompareAtPrice, p.stock);
  } else {
    yield offer(tag(condition), p.price, p.compareAtPrice, p.stock);
  }
}

// ---------------------------------------------------------------- Venture Games (its own PHP site)

/** One product card from a category page, as the fetcher reads it (ventureCards). */
export interface VentureProduct {
  id: number;
  name: string;
  /** What the customer pays. */
  price: number;
  /** List price: 0 when unset, the pre-sale price when on sale. */
  mrp: number;
  stock: number;
  category: string;
  /** Site-relative: /product/<id>?cat=<slug> */
  url: string;
  /** Site-relative: uploads/<file> */
  image: string | null;
}

export function* ventureListings(store: StoreConfig, p: VentureProduct): Generator<RawListing> {
  yield {
    raw_title: unescape(p.name.trim()),
    variant: "",
    meta: [unescape(p.category.trim())],
    price: p.price,
    was: p.mrp > p.price ? p.mrp : null,
    in_stock: p.stock > 0,
    url: new URL(p.url, store.base).href,
    image: p.image ? new URL(p.image, `${store.base}/`).href : null,
  };
}

export const ADAPTERS = {
  shopify: (store: StoreConfig, p: unknown) => shopifyListings(store, p as ShopifyProduct),
  woocommerce: (store: StoreConfig, p: unknown) => wooListings(store, p as WooProduct),
  payload: (store: StoreConfig, p: unknown) => payloadListings(store, p as PayloadProduct),
  venture: (store: StoreConfig, p: unknown) => ventureListings(store, p as VentureProduct),
};
