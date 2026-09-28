import { useSyncExternalStore } from "react"

/**
 * The reader's wishlist and collection. Kept in this browser (no accounts), synced
 * across tabs, and backed up by exporting to a file. A game is on one list at most:
 * marking a wished-for game as owned moves it to the collection.
 */
export type ShelfList = "wishlist" | "collection"

export interface ShelfItem {
  list: ShelfList
  /** Kept so a game can still be named after no store lists it any more. */
  title: string
  image: string | null
  addedAt: string
}

export type Shelf = Record<string, ShelfItem>

const KEY = "lootledger-shelf"
const EVENT = "lootledger-shelf-change"
const EMPTY: Shelf = {}

const isItem = (v: unknown): v is ShelfItem => {
  const i = v as ShelfItem | null
  return (
    typeof i === "object" &&
    i !== null &&
    (i.list === "wishlist" || i.list === "collection") &&
    typeof i.title === "string" &&
    (typeof i.image === "string" || i.image === null) &&
    typeof i.addedAt === "string"
  )
}

/** Only well-formed entries, so a hand-edited or corrupt value can't break the page. */
function parse(raw: string | null): Shelf {
  try {
    const data = JSON.parse(raw ?? "null") as unknown
    if (typeof data !== "object" || data === null) return EMPTY
    return Object.fromEntries(Object.entries(data).filter(([, v]) => isItem(v))) as Shelf
  } catch {
    return EMPTY
  }
}

let lastRaw: string | null | undefined
let lastShelf: Shelf = EMPTY
// Storage can be blocked (private windows, strict settings); then the shelf lives in memory.
let memory: string | null = null

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memory
  }
}

function snapshot(): Shelf {
  const raw = readRaw()
  if (raw !== lastRaw) [lastRaw, lastShelf] = [raw, parse(raw)]
  return lastShelf
}

function save(shelf: Shelf) {
  const raw = JSON.stringify(shelf)
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

export function useShelf(): Shelf {
  return useSyncExternalStore(subscribe, snapshot)
}

/** Ids on a list, most recently added first. */
export const idsOn = (shelf: Shelf, list: ShelfList) =>
  Object.entries(shelf)
    .filter(([, item]) => item.list === list)
    .sort((a, b) => b[1].addedAt.localeCompare(a[1].addedAt))
    .map(([id]) => id)

/** Put a game on a list (moving it off the other one), or take it off with null. */
export function setShelf(game: { id: string; title: string; image: string | null }, list: ShelfList | null) {
  const { [game.id]: current, ...rest } = snapshot()
  if (!list) return save(rest)
  save({ ...rest, [game.id]: { list, title: game.title, image: game.image, addedAt: current?.list === list ? current.addedAt : new Date().toISOString() } })
}

export function removeFromShelf(ids: string[]) {
  const next = { ...snapshot() }
  for (const id of ids) delete next[id]
  save(next)
}

/** A backup file: the shelf plus enough to recognise it on import. */
export function exportShelf() {
  const file = { app: "lootledger", version: 1, exportedAt: new Date().toISOString(), items: snapshot() }
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }))
  const a = Object.assign(document.createElement("a"), { href: url, download: `lootledger-${new Date().toISOString().slice(0, 10)}.json` })
  a.click()
  URL.revokeObjectURL(url)
}

/** Merge a backup into the shelf (the backup wins for games on both). Returns how many games it had. */
export async function importShelf(file: File): Promise<number> {
  let data: { app?: unknown; items?: unknown }
  try {
    data = JSON.parse(await file.text()) as typeof data
  } catch {
    throw new Error("That file isn't a LootLedger backup.")
  }
  if (data?.app !== "lootledger") throw new Error("That file isn't a LootLedger backup.")
  const items = parse(JSON.stringify(data.items ?? null))
  save({ ...snapshot(), ...items })
  return Object.keys(items).length
}
