/**
 * Ask each store's own checkout what delivery costs, for carts of 1 to 6 different
 * games, delivered in Karachi and in Lahore (for "elsewhere in Pakistan"). Prints a
 * `delivery` entry per store to paste into stores.json. Nothing is ordered: the
 * carts are anonymous and abandoned.
 *
 *   pnpm --filter @ugs/server check:delivery [store-id ...]
 *
 * Shopify: /cart/add.js then /cart/shipping_rates.json (the cart's own rate lookup).
 * WooCommerce: the Store API cart (/wc/store/v1/cart/...), the same one its checkout uses.
 */
import fs from "node:fs";
import type { Delivery } from "@ugs/shared";
import { config } from "../src/config.ts";

const MAX_GAMES = 6;
const PAUSE_MS = 300; // between requests to the same store, to be polite
const UA = "Mozilla/5.0 (compatible; LootLedger delivery check)";

interface StoreEntry {
  id: string;
  name: string;
  platform: "shopify" | "woocommerce";
  base: string;
}

interface City {
  zone: keyof Omit<Delivery, "checked" | "note">;
  city: string;
  province: string;
  state: string;
  zip: string;
}

const CITIES: City[] = [
  { zone: "karachi", city: "Karachi", province: "Sindh", state: "SD", zip: "74000" },
  { zone: "elsewhere", city: "Lahore", province: "Punjab", state: "PB", zip: "54000" },
];

interface Rate {
  name: string;
  price: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A tiny HTTP session: keeps cookies (Shopify's cart) and the Store API's cart token. */
function session() {
  const cookies = new Map<string, string>();
  let cartToken: string | null = null;
  return async <T>(url: string, init: { method?: string; json?: unknown; form?: Record<string, string>; headers?: Record<string, string> } = {}) => {
    await sleep(PAUSE_MS);
    const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/json", ...init.headers };
    if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (cartToken) headers["Cart-Token"] = cartToken;
    let body: string | undefined;
    if (init.json !== undefined) [body, headers["Content-Type"]] = [JSON.stringify(init.json), "application/json"];
    if (init.form) [body, headers["Content-Type"]] = [new URLSearchParams(init.form).toString(), "application/x-www-form-urlencoded"];
    const res = await fetch(url, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair!.indexOf("=");
      cookies.set(pair!.slice(0, i), pair!.slice(i + 1));
    }
    cartToken = res.headers.get("cart-token") ?? cartToken;
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}: ${(await res.text()).slice(0, 200)}`);
    return { data: (await res.json()) as T, headers: res.headers };
  };
}

/** Delivery options a shopper in this city can actually pick, cheapest first. */
function usable(rates: Rate[], city: City): number | null {
  const prices = rates
    // "Rates given on call" and similar placeholders aren't a price.
    .filter((r) => r.price > 0)
    // Games4U offers "Karachi Only" to every address; it only applies in Karachi.
    .filter((r) => city.zone === "karachi" || !/karachi/i.test(r.name))
    .map((r) => r.price);
  return prices.length ? Math.min(...prices) : null;
}

/** Games (not consoles or accessories) that are in stock, as a store's cart wants them. */
async function shopifyGames(store: StoreEntry): Promise<string[]> {
  const get = session();
  const { data } = await get<{ products: { title: string; product_type: string; variants: { id: number; available: boolean; price: string }[] }[] }>(
    `${store.base}/products.json?limit=250`,
  );
  return data.products
    .filter((p) => !/console|controller|headset|card/i.test(`${p.title} ${p.product_type}`))
    .flatMap((p) => p.variants.slice(0, 1))
    .filter((v) => v.available && +v.price > 1000 && +v.price < 15000)
    .map((v) => String(v.id));
}

async function shopifyRates(store: StoreEntry, ids: string[], city: City): Promise<Rate[]> {
  const call = session();
  for (const id of ids) await call(`${store.base}/cart/add.js`, { form: { id, quantity: "1" } });
  const cart = await call<{ item_count: number }>(`${store.base}/cart.js`);
  if (cart.data.item_count !== ids.length) throw new Error(`cart holds ${cart.data.item_count} of ${ids.length} games`);
  const q = new URLSearchParams({
    "shipping_address[country]": "Pakistan",
    "shipping_address[province]": city.province,
    "shipping_address[city]": city.city,
    "shipping_address[zip]": city.zip,
  });
  const { data } = await call<{ shipping_rates: { name: string; price: string }[] }>(`${store.base}/cart/shipping_rates.json?${q}`);
  return data.shipping_rates.map((r) => ({ name: r.name, price: Number(r.price) }));
}

interface WooProduct {
  id: number;
  name: string;
  type: string;
  is_in_stock: boolean;
  is_purchasable: boolean;
  categories: { name: string }[];
  prices: { price: string; currency_minor_unit: number };
}

// ?rest_route= works even where /wp-json/ pretty URLs are blocked (as in the fetcher).
const storeApi = (store: StoreEntry, route: string) => `${store.base}/?rest_route=/wc/store/v1/${route}`;
const wooPrice = (p: { price: string; currency_minor_unit: number }) => Number(p.price) / 10 ** p.currency_minor_unit;

async function wooGames(store: StoreEntry): Promise<string[]> {
  const get = session();
  const { data } = await get<WooProduct[]>(`${storeApi(store, "products")}&per_page=100&stock_status=instock`);
  return data
    // Only simple products: a variable one needs an edition picked before it can go in a cart.
    .filter((p) => p.type === "simple" && p.is_in_stock && p.is_purchasable && !/console|controller|headset|card/i.test(`${p.name} ${p.categories.map((c) => c.name).join(" ")}`))
    .filter((p) => wooPrice(p.prices) > 1000 && wooPrice(p.prices) < 15000)
    .map((p) => String(p.id));
}

async function wooRates(store: StoreEntry, ids: string[], city: City): Promise<Rate[]> {
  const call = session();
  // Cache-busted: a cached GET /cart hands back someone else's cart token (and its items).
  const { headers } = await call(`${storeApi(store, "cart")}&fresh=${Date.now()}${Math.random()}`);
  const nonce = { Nonce: headers.get("nonce") ?? "" };
  for (const id of ids) await call(storeApi(store, "cart/add-item"), { json: { id: Number(id), quantity: 1 }, headers: nonce });
  const { data } = await call<{ items: unknown[]; shipping_rates: { shipping_rates: { name: string; price: string; currency_minor_unit: number }[] }[] }>(
    storeApi(store, "cart/update-customer"),
    {
      json: { shipping_address: { first_name: "A", last_name: "B", address_1: "Main Road", city: city.city, state: city.state, postcode: city.zip, country: "PK" } },
      headers: nonce,
    },
  );
  if (data.items.length !== ids.length) throw new Error(`cart holds ${data.items.length} of ${ids.length} games`);
  return data.shipping_rates.flatMap((pkg) => pkg.shipping_rates.map((r) => ({ name: r.name, price: wooPrice(r) })));
}

async function check(store: StoreEntry): Promise<Delivery> {
  const games = store.platform === "shopify" ? await shopifyGames(store) : await wooGames(store);
  if (games.length < MAX_GAMES) throw new Error(`only ${games.length} games in stock to try`);
  const delivery: Delivery = { karachi: [], elsewhere: [], checked: new Date().toLocaleDateString("en-CA") }; // YYYY-MM-DD, local
  for (const city of CITIES) {
    for (let n = 1; n <= MAX_GAMES; n++) {
      const rates = store.platform === "shopify" ? await shopifyRates(store, games.slice(0, n), city) : await wooRates(store, games.slice(0, n), city);
      const fee = usable(rates, city);
      console.log(`  ${store.id} ${city.city} ${n} game(s): ${rates.map((r) => `${r.name} ${r.price}`).join(", ") || "no rates"} -> ${fee ?? "?"}`);
      if (fee === null) throw new Error(`no usable delivery rate for ${n} games to ${city.city}`);
      delivery[city.zone].push(fee);
    }
  }
  // Trailing repeats add nothing: the last fee applies to bigger orders.
  for (const zone of ["karachi", "elsewhere"] as const)
    while (delivery[zone].length > 1 && delivery[zone].at(-1) === delivery[zone].at(-2)) delivery[zone].pop();
  return delivery;
}

const only = process.argv.slice(2);
const stores = (JSON.parse(fs.readFileSync(config.STORES_FILE, "utf-8")) as StoreEntry[]).filter((s) => !only.length || only.includes(s.id));
const found: Record<string, Delivery> = {};
for (const store of stores) {
  console.log(`${store.name}:`);
  try {
    found[store.id] = await check(store);
  } catch (e) {
    console.log(`  failed: ${(e as Error).message}`);
  }
}
console.log("\nPaste into stores.json:");
for (const [id, d] of Object.entries(found)) console.log(`  ${id}: "delivery": ${JSON.stringify(d)}`);
