import { useSyncExternalStore } from "react"
import type { CartWant, Zone } from "@ugs/shared"

/**
 * The reader's cart for the optimizer: games they plan to buy together, which copies
 * will do for each, and where it's delivered. Kept in this browser and synced across tabs.
 */
export interface CartItem {
  gameId: string
  title: string
  image: string | null
  want: CartWant
  addedAt: string
}

export interface Cart {
  items: CartItem[]
  zone: Zone
}

const KEY = "lootledger-cart"
const EVENT = "lootledger-cart-change"
// Fees outside Karachi are the same or higher, so an unknown address plans on the safe side.
const EMPTY: Cart = { items: [], zone: "elsewhere" }

const isWant = (w: unknown): w is CartWant => {
  const v = w as CartWant | null
  return (
    typeof v === "object" &&
    v !== null &&
    (v.platform === null || typeof v.platform === "string") &&
    (v.condition === null || v.condition === "new" || v.condition === "used") &&
    (v.format === null || v.format === "disc" || v.format === "digital")
  )
}

const isItem = (i: unknown): i is CartItem => {
  const v = i as CartItem | null
  return typeof v === "object" && v !== null && typeof v.gameId === "string" && typeof v.title === "string" && isWant(v.want) && typeof v.addedAt === "string"
}

/** Only well-formed entries, so a hand-edited or corrupt value can't break the page. */
function parse(raw: string | null): Cart {
  try {
    const data = JSON.parse(raw ?? "null") as Partial<Cart> | null
    if (!data || typeof data !== "object") return EMPTY
    return {
      items: Array.isArray(data.items) ? data.items.filter(isItem).map((i) => ({ ...i, image: typeof i.image === "string" ? i.image : null })) : [],
      zone: data.zone === "karachi" ? "karachi" : "elsewhere",
    }
  } catch {
    return EMPTY
  }
}

let lastRaw: string | null | undefined
let lastCart: Cart = EMPTY
// Storage can be blocked (private windows, strict settings); then the cart lives in memory.
let memory: string | null = null

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memory
  }
}

function snapshot(): Cart {
  const raw = readRaw()
  if (raw !== lastRaw) [lastRaw, lastCart] = [raw, parse(raw)]
  return lastCart
}

function save(cart: Cart) {
  const raw = JSON.stringify(cart)
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    memory = raw
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange() // another tab
  window.addEventListener("storage", onStorage)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(EVENT, onChange)
  }
}

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, snapshot)
}

/** Add games not in the cart yet (newest last, so the cart reads in the order they came in). */
export function addToCart(games: { id: string; title: string; image: string | null }[], want: CartWant) {
  const cart = snapshot()
  const have = new Set(cart.items.map((i) => i.gameId))
  const now = new Date().toISOString()
  const added = games.filter((g) => !have.has(g.id)).map((g) => ({ gameId: g.id, title: g.title, image: g.image, want, addedAt: now }))
  if (added.length) save({ ...cart, items: [...cart.items, ...added] })
}

export function removeFromCart(gameId: string) {
  const cart = snapshot()
  save({ ...cart, items: cart.items.filter((i) => i.gameId !== gameId) })
}

export function setCartWant(gameId: string, patch: Partial<CartWant>) {
  const cart = snapshot()
  save({ ...cart, items: cart.items.map((i) => (i.gameId === gameId ? { ...i, want: { ...i.want, ...patch } } : i)) })
}

export function setCartZone(zone: Zone) {
  save({ ...snapshot(), zone })
}

export function clearCart() {
  save({ ...snapshot(), items: [] })
}
